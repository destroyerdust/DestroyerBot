const fs = require('node:fs')
const path = require('node:path')
const { Client, Collection, GatewayIntentBits } = require('discord.js')
const { token } = require('./config.json')
const logger = require('./logger')

logger.info('Starting DestroyerBot...')

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
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
    client.once(event.name, (...args) => event.execute(...args))
  } else {
    client.on(event.name, (...args) => event.execute(...args))
  }
}

logger.info(`Loaded ${eventFiles.length} events.`)

client.once('clientReady', () => {
  logger.info('The bot is online')
})

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const command = client.commands.get(interaction.commandName)

  if (!command) return

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
client.login(token)
