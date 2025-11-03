require('dotenv').config()
const fs = require('node:fs')
const path = require('node:path')
const { Client, Collection, GatewayIntentBits, MessageFlags } = require('discord.js')
const token = process.env.TOKEN
const logger = require('./logger')
const { hasCommandPermissionAsync } = require('./utils/guildSettings')
const { connectToDatabase } = require('./utils/database')
const { runMigration } = require('./utils/migrateToMongoDB')

logger.info('Starting DestroyerBot...')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
})

client.commands = new Collection()
const commandsPath = path.join(__dirname, 'commands')

const getAllJsFiles = (dirPath, relativePath = '') => {
  let files = []
  const items = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name)
    const relPath = path.join(relativePath, item.name)
    if (item.isDirectory()) {
      files = files.concat(getAllJsFiles(fullPath, relPath))
    } else if (item.name.endsWith('.js')) {
      files.push(relPath)
    }
  }
  return files
}

const commandFiles = getAllJsFiles(commandsPath)

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file)
  const command = require(filePath)
  client.commands.set(command.data.name, command)
}

logger.info(`Loaded ${client.commands.size} commands.`)

const eventsPath = path.join(__dirname, 'events')
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'))

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file)
  const event = require(filePath)
  if (event.once) {
    logger.debug({ eventName: event.name, eventFile: file }, 'Loading event as once')
    client.once(event.name, (...args) => event.execute(...args))
  } else {
    logger.debug({ eventName: event.name, eventFile: file }, 'Loading event as on')
    client.on(event.name, (...args) => event.execute(...args))
  }
}

logger.info(`Loaded ${eventFiles.length} events.`)

client.once('clientReady', async () => {
  const { user, guilds, ws } = client

  logger.info(
    {
      botUsername: user.username,
      botDiscriminator: user.discriminator,
      botId: user.id,
      guildCount: guilds.cache.size,
      websocketStatus: ws.status,
      websocketPing: ws.ping,
      readyAt: new Date().toISOString(),
    },
    `${user.tag} is online and ready! Serving ${guilds.cache.size} server(s)`
  )

  // Initialize database connection and run migration
  try {
    await connectToDatabase()
    const migrated = await runMigration()
    if (migrated) {
      logger.info('Database migration completed successfully')
    }
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to initialize database')
    // Continue running even if database fails - will use JSON fallback
  }
})

client.on('interactionCreate', async (interaction) => {
  // Handle autocomplete interactions
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName)
    if (!command || !command.autocomplete) return

    try {
      await command.autocomplete(interaction)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Autocomplete error')
    }
    return
  }

  if (!interaction.isChatInputCommand()) return

  const command = client.commands.get(interaction.commandName)

  if (!command) return

  // Check permissions for guild commands (skip for DMs)
  if (interaction.guild && interaction.member) {
    try {
      const hasPermission = await hasCommandPermissionAsync(
        interaction.guild.id,
        interaction.commandName,
        interaction.member
      )

      if (!hasPermission) {
        logger.warn(
          {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            username: interaction.user.tag,
            commandName: interaction.commandName,
          },
          'User blocked from using command due to permissions'
        )
        return interaction.reply({
          content: "⛔ You don't have permission to use this command.",
          flags: MessageFlags.Ephemeral,
        })
      }
    } catch (error) {
      logger.error(
        { error: error.message, guildId: interaction.guild.id },
        'Error checking command permissions'
      )
      return interaction.reply({
        content: 'There was an error checking permissions. Please try again.',
        flags: MessageFlags.Ephemeral,
      })
    }
  }

  try {
    await command.execute(interaction)
  } catch (error) {
    logger.error(error)
    await interaction.reply({
      content: 'There was an error while executing this command!',
      flags: MessageFlags.Ephemeral,
    })
  }
})

logger.info('Attempting to log in with the provided token...')

// Debug: Check if token exists and is valid format
if (!token) {
  logger.error('No TOKEN found in environment variables. Please check your .env file.')
  process.exit(1)
}

if (token === 'your_discord_bot_token_here') {
  logger.error(
    'TOKEN is still set to placeholder value. Please update .env with your real Discord bot token from https://discord.com/developers/applications'
  )
  process.exit(1)
}

if (typeof token !== 'string' || token.length < 50) {
  logger.error(
    'TOKEN appears to be invalid (wrong format or too short). Discord bot tokens should be ~59 characters long.'
  )
  process.exit(1)
}

logger.debug(`Token format validation passed (length: ${token.length})`)

client.login(token)
