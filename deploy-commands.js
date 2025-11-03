// Script to collect local command modules and push their definitions to Discord
// Run with: `node deploy-commands.js` (see README.md). This updates guild and global slash commands.
// Deploys guild commands to all guilds specified in .env GUILD_IDS, and global commands application-wide.
require('dotenv').config()
const { REST, Routes, InteractionContextType } = require('discord.js')
const clientId = process.env.CLIENT_ID
const guildIds = process.env.GUILD_IDS.split(',')
const token = process.env.TOKEN
const fs = require('node:fs')
const path = require('node:path')
const logger = require('./logger')

const commands = []
const globalCommands = []

function getCommandFiles(dir) {
  const files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    logger.debug(`Scanning ${entry.isDirectory() ? 'directory' : 'file'}: ${fullPath}`)
    if (entry.isDirectory()) {
      files.push(...getCommandFiles(fullPath))
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath)
    }
  }
  return files
}

const commandFiles = getCommandFiles(path.join(__dirname, 'commands'))
logger.info('Found command files:', commandFiles.length)

for (const file of commandFiles) {
  logger.debug(`Loading command from ${file}`)
  const command = require(file)
  if ('data' in command && 'execute' in command) {
    // `InteractionContextType.Guild` is 1 — commands that include context 1 are considered global here
    // (this project encodes the global decision via `data.contexts?.includes(1)`).
    const isGlobal = command.data.contexts?.includes(1)
    const commandName = command.data.name
    logger.debug(`Command ${commandName}, isGlobal: ${isGlobal}`)
    const commandData = command.data.toJSON()
    commands.push(commandData) // Add to guild commands
    if (isGlobal) {
      globalCommands.push(commandData) // Also add to global if it should be global
    }
  } else {
    logger.warn(`The command at ${file} is missing a required "data" or "execute" property.`)
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token)

// and deploy your commands!
;(async () => {
  try {
    logger.info(
      `Started refreshing ${commands.length} guild commands and ${globalCommands.length} global commands.`
    )

    // Deploy guild commands to each guild
    for (const guildId of guildIds) {
      try {
        const guildData = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: commands,
        })
        logger.info(
          `Successfully reloaded ${guildData.length} guild (/) commands for guild ${guildId}.`
        )
      } catch (error) {
        logger.error(`Failed to deploy guild commands for guild ${guildId}:`, error.message)
      }
    }

    // Deploy global commands
    const globalData = await rest.put(Routes.applicationCommands(clientId), {
      body: globalCommands,
    })
    logger.info(`Successfully reloaded ${globalData.length} global (/) commands.`)
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    logger.error('Deploy commands error:', error.message, error.stack)
  }
})()
