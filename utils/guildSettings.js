const fs = require('node:fs')
const path = require('node:path')
const logger = require('../logger')
const GuildSettings = require('../models/GuildSettings')
const { getConnectionStatus } = require('./database')

const DATA_DIR = path.join(__dirname, '../data')
const SETTINGS_FILE = path.join(DATA_DIR, 'guildSettings.json')

// Commands that are restricted to server owner by default (unless specific roles are assigned)
// NOTE: If you add/remove items here, update any admin commands that reference the same set
// (for example `commands/admin/listpermissions.js`) so the UI/reporting stays consistent.
const DEFAULT_RESTRICTED_COMMANDS = new Set(['kick', 'clean', 'setnick'])

// Ensure data directory exists for backup JSON file
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  logger.info('Created data directory')
}

// Ensure settings file exists as backup
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2))
  logger.info('Created guildSettings.json backup file')
}

/**
 * Load all guild settings from JSON file
 * @returns {Object} All guild settings
 */
function loadSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    logger.error({ error: error.message }, 'Error loading guild settings')
    return {}
  }
}

/**
 * Save all guild settings to JSON file
 * @param {Object} settings - Settings object to save
 */
function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    logger.debug('Guild settings saved successfully')
  } catch (error) {
    logger.error({ error: error.message }, 'Error saving guild settings')
  }
}

/**
 * Migrate existing JSON data from flat structures to nested objects
 */
function migrateSettings() {
  try {
    const settings = loadSettings()
    let hasChanges = false

    for (const guildId in settings) {
      const guild = settings[guildId]

      // Migrate log settings from flat to nested
      if (guild.logChannel !== undefined || guild.logMessageCreate !== undefined || guild.logMessageDelete !== undefined) {
        // Initialize logs object if it doesn't exist
        if (!guild.logs) {
          guild.logs = {}
        }

        // Migrate flat properties to nested
        if (guild.logChannel !== undefined) {
          guild.logs.channelId = guild.logChannel
          delete guild.logChannel
        }
        if (guild.logMessageCreate !== undefined) {
          guild.logs.messageCreate = guild.logMessageCreate
          delete guild.logMessageCreate
        }
        if (guild.logMessageDelete !== undefined) {
          guild.logs.messageDelete = guild.logMessageDelete
          delete guild.logMessageDelete
        }

        hasChanges = true
        logger.info({ guildId }, 'Migrated log settings from flat to nested structure')
      }

      // Migrate welcome settings from flat to nested
      if (guild.welcomeEnabled !== undefined || guild.welcomeChannel !== undefined || guild.welcomeMessage !== undefined) {
        // Initialize welcome object if it doesn't exist
        if (!guild.welcome) {
          guild.welcome = {}
        }

        // Migrate flat properties to nested
        if (guild.welcomeEnabled !== undefined) {
          guild.welcome.enabled = guild.welcomeEnabled
          delete guild.welcomeEnabled
        }
        if (guild.welcomeChannel !== undefined) {
          guild.welcome.channelId = guild.welcomeChannel
          delete guild.welcomeChannel
        }
        if (guild.welcomeMessage !== undefined) {
          guild.welcome.message = guild.welcomeMessage
          delete guild.welcomeMessage
        }

        hasChanges = true
        logger.info({ guildId }, 'Migrated welcome settings from flat to nested structure')
      }
    }

    if (hasChanges) {
      saveSettings(settings)
      logger.info('Completed migration of settings to nested structures')
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error migrating settings')
  }
}

// Run migration on module load
migrateSettings()

/**
 * Get settings for a specific guild
 * @param {string} guildId - Guild ID
 * @returns {Object} Guild settings
 */
function getGuildSettings(guildId) {
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
      logs: {
        channelId: null,
        messageCreate: true,
        messageDelete: true,
      },
      welcomeEnabled: false,
      welcomeChannel: null,
      welcomeMessage: 'Welcome to the server!',
    }
    saveSettings(settings)
  }

  // Ensure logs object exists and has defaults
  if (!settings[guildId].logs) {
    settings[guildId].logs = {}
  }
  if (!settings[guildId].logs.channelId) {
    settings[guildId].logs.channelId = null
  }
  if (typeof settings[guildId].logs.messageCreate !== 'boolean') {
    settings[guildId].logs.messageCreate = true
  }
  if (typeof settings[guildId].logs.messageDelete !== 'boolean') {
    settings[guildId].logs.messageDelete = true
  }

  // Ensure welcome object exists and has defaults
  if (!settings[guildId].welcome) {
    settings[guildId].welcome = {}
  }
  if (typeof settings[guildId].welcome.enabled !== 'boolean') {
    settings[guildId].welcome.enabled = false
  }
  if (!settings[guildId].welcome.channelId) {
    settings[guildId].welcome.channelId = null
  }
  if (!settings[guildId].welcome.message) {
    settings[guildId].welcome.message = 'Welcome to the server!'
  }

  return settings[guildId]
}

/**
 * Set role permissions for a command in a guild (saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {string} roleId - Role ID to add
 */
function setCommandRole(guildId, commandName, roleId) {
  // Always save to MongoDB first if connected
  if (getConnectionStatus()) {
    GuildSettings.findOrCreate(guildId)
      .then((guildSettings) => {
        const permissions = guildSettings.commandPermissions || new Map()
        const roleIds = permissions.get(commandName) || []
        if (!roleIds.includes(roleId)) {
          roleIds.push(roleId)
          permissions.set(commandName, roleIds)
          guildSettings.commandPermissions = permissions
          return guildSettings.save()
        }
      })
      .then(() => {
        logger.info(
          { guildId, commandName, roleId },
          'Command role permission added (MongoDB + JSON)'
        )
      })
      .catch((error) => {
        logger.error(
          { error: error.message, guildId, commandName, roleId },
          'Error saving to MongoDB, JSON backup preserved'
        )
      })
  } else {
    logger.debug(
      { guildId, commandName, roleId },
      'Command role permission added (JSON only - MongoDB not connected)'
    )
  }

  // Then save to JSON as backup
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
    }
  }
  if (!settings[guildId].commandPermissions[commandName]) {
    settings[guildId].commandPermissions[commandName] = []
  }
  if (!settings[guildId].commandPermissions[commandName].includes(roleId)) {
    settings[guildId].commandPermissions[commandName].push(roleId)
  }
  saveSettings(settings)

  logger.info({ guildId, commandName, roleId }, 'Command role permission added')
}

/**
 * Remove role permissions for a command in a guild (saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {string} roleId - Role ID to remove
 */
function removeCommandRole(guildId, commandName, roleId) {
  // Always save to MongoDB first if connected
  if (getConnectionStatus()) {
    GuildSettings.findOne({ guildId })
      .then((guildSettings) => {
        if (guildSettings?.commandPermissions?.has(commandName)) {
          const permissions = guildSettings.commandPermissions
          const roleIds = permissions.get(commandName).filter((id) => id !== roleId)
          permissions.set(commandName, roleIds)
          guildSettings.commandPermissions = permissions
          return guildSettings.save()
        }
      })
      .then(() => {
        logger.info(
          { guildId, commandName, roleId },
          'Command role permission removed (MongoDB + JSON)'
        )
      })
      .catch((error) => {
        logger.error(
          { error: error.message, guildId, commandName, roleId },
          'Error saving to MongoDB, JSON backup preserved'
        )
      })
  } else {
    logger.debug(
      { guildId, commandName, roleId },
      'Command role permission removed (JSON only - MongoDB not connected)'
    )
  }

  // Then save to JSON as backup
  const settings = loadSettings()
  if (settings[guildId]?.commandPermissions?.[commandName]) {
    settings[guildId].commandPermissions[commandName] = settings[guildId].commandPermissions[
      commandName
    ].filter((id) => id !== roleId)
    saveSettings(settings)
  }

  logger.info({ guildId, commandName, roleId }, 'Command role permission removed')
}

/**
 * Check if a member has permission to use a command
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {Object} member - Discord GuildMember object
 * @returns {boolean} True if member has permission
 */
function hasCommandPermission(guildId, commandName, member) {
  // Server owner always has permission to use any command
  if (member.id === member.guild.ownerId) {
    return true
  }

  const guildSettings = getGuildSettings(guildId)
  const allowedRoles = guildSettings.commandPermissions[commandName]

  // If command is in default-restricted list AND no specific roles are configured,
  // deny access (only owner can use, but we already checked that above)
  if (
    DEFAULT_RESTRICTED_COMMANDS.has(commandName) &&
    (!allowedRoles || allowedRoles.length === 0)
  ) {
    return false
  }

  // If no roles are configured (and command is not default-restricted), allow everyone
  if (!allowedRoles || allowedRoles.length === 0) {
    return true
  }

  // Check if member has any of the allowed roles
  const memberRoles = member.roles.cache.map((role) => role.id)
  return allowedRoles.some((roleId) => memberRoles.includes(roleId))
}

/**
 * Reset all permissions for a guild (saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 */
function resetGuildPermissions(guildId) {
  // Always save to MongoDB first if connected
  if (getConnectionStatus()) {
    GuildSettings.findOne({ guildId })
      .then((guildSettings) => {
        if (guildSettings) {
          guildSettings.commandPermissions = new Map()
          return guildSettings.save()
        }
      })
      .then(() => {
        logger.info({ guildId }, 'Guild permissions reset (MongoDB + JSON)')
      })
      .catch((error) => {
        logger.error(
          { error: error.message, guildId },
          'Error saving to MongoDB, JSON backup preserved'
        )
      })
  } else {
    logger.debug({ guildId }, 'Guild permissions reset (JSON only - MongoDB not connected)')
  }

  // Then save to JSON as backup
  const settings = loadSettings()
  if (settings[guildId]) {
    settings[guildId].commandPermissions = {}
    saveSettings(settings)
  }

  logger.info({ guildId }, 'Guild permissions reset')
}

/**
 * Set the log channel for a guild (saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID to set as log channel
 */
function setLogChannel(guildId, channelId) {
  // Always save to MongoDB first if connected
  if (getConnectionStatus()) {
    GuildSettings.findOrCreate(guildId)
      .then((guildSettings) => {
        guildSettings.logs = guildSettings.logs || {}
        guildSettings.logs.channelId = channelId
        return guildSettings.save()
      })
      .then(() => {
        logger.info({ guildId, channelId }, 'Log channel set (MongoDB + JSON)')
      })
      .catch((error) => {
        logger.error(
          { error: error.message, guildId, channelId },
          'Error saving to MongoDB, JSON backup preserved'
        )
      })
  } else {
    logger.debug({ guildId, channelId }, 'Log channel set (JSON only - MongoDB not connected)')
  }

  // Then save to JSON as backup
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
      logs: {
        channelId: null,
        messageCreate: true,
        messageDelete: true,
      },
    }
  }
  settings[guildId].logs = settings[guildId].logs || {}
  settings[guildId].logs.channelId = channelId
  saveSettings(settings)

  logger.info({ guildId, channelId }, 'Log channel set')
}

/**
 * Get the log channel for a guild
 * @param {string} guildId - Guild ID
 * @returns {string|null} Log channel ID or null if not set
 */
function getLogChannel(guildId) {
  const guildSettings = getGuildSettings(guildId)
  return guildSettings.logs?.channelId || null
}

/**
 * Set whether to log message creates for a guild (saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {boolean} enable - True to enable, false to disable
 */
function setLogMessageCreate(guildId, enable) {
  // Always save to MongoDB first if connected
  if (getConnectionStatus()) {
    GuildSettings.findOrCreate(guildId)
      .then((guildSettings) => {
        guildSettings.logs = guildSettings.logs || {}
        guildSettings.logs.messageCreate = enable
        return guildSettings.save()
      })
      .then(() => {
        logger.info({ guildId, enable }, 'Log message create setting updated (MongoDB + JSON)')
      })
      .catch((error) => {
        logger.error(
          { error: error.message, guildId, enable },
          'Error saving to MongoDB, JSON backup preserved'
        )
      })
  } else {
    logger.debug(
      { guildId, enable },
      'Log message create setting updated (JSON only - MongoDB not connected)'
    )
  }

  // Then save to JSON as backup
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
      logs: {
        channelId: null,
        messageCreate: true,
        messageDelete: true,
      },
    }
  }
  settings[guildId].logs = settings[guildId].logs || {}
  settings[guildId].logs.messageCreate = enable
  saveSettings(settings)

  logger.info({ guildId, enable }, 'Log message create setting updated')
}

/**
 * Get whether to log message creates for a guild
 * @param {string} guildId - Guild ID
 * @returns {boolean} True if enabled
 */
function getLogMessageCreate(guildId) {
  const guildSettings = getGuildSettings(guildId)
  return guildSettings.logs?.messageCreate ?? true
}

/**
 * Set whether to log message deletes for a guild (saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {boolean} enable - True to enable, false to disable
 */
function setLogMessageDelete(guildId, enable) {
  // Always save to MongoDB first if connected
  if (getConnectionStatus()) {
    GuildSettings.findOrCreate(guildId)
      .then((guildSettings) => {
        guildSettings.logs = guildSettings.logs || {}
        guildSettings.logs.messageDelete = enable
        return guildSettings.save()
      })
      .then(() => {
        logger.info({ guildId, enable }, 'Log message delete setting updated (MongoDB + JSON)')
      })
      .catch((error) => {
        logger.error(
          { error: error.message, guildId, enable },
          'Error saving to MongoDB, JSON backup preserved'
        )
      })
  } else {
    logger.debug(
      { guildId, enable },
      'Log message delete setting updated (JSON only - MongoDB not connected)'
    )
  }

  // Then save to JSON as backup
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
      logs: {
        channelId: null,
        messageCreate: true,
        messageDelete: true,
      },
    }
  }
  settings[guildId].logs = settings[guildId].logs || {}
  settings[guildId].logs.messageDelete = enable
  saveSettings(settings)

  logger.info({ guildId, enable }, 'Log message delete setting updated')
}

/**
 * Get whether to log message deletes for a guild
 * @param {string} guildId - Guild ID
 * @returns {boolean} True if enabled
 */
function getLogMessageDelete(guildId) {
  const guildSettings = getGuildSettings(guildId)
  return guildSettings.logs?.messageDelete ?? true
}

/**
 * Set whether welcome messages are enabled for a guild (saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {boolean} enable - True to enable, false to disable
 */
function setWelcomeEnabled(guildId, enable) {
  // Always save to MongoDB first if connected
  if (getConnectionStatus()) {
    GuildSettings.findOrCreate(guildId)
      .then((guildSettings) => {
        guildSettings.welcome = guildSettings.welcome || {}
        guildSettings.welcome.enabled = enable
        return guildSettings.save()
      })
      .then(() => {
        logger.info({ guildId, enable }, 'Welcome enabled setting updated (MongoDB + JSON)')
      })
      .catch((error) => {
        logger.error(
          { error: error.message, guildId, enable },
          'Error saving to MongoDB, JSON backup preserved'
        )
      })
  } else {
    logger.debug(
      { guildId, enable },
      'Welcome enabled setting updated (JSON only - MongoDB not connected)'
    )
  }

  // Then save to JSON as backup
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
      logs: {
        channelId: null,
        messageCreate: true,
        messageDelete: true,
      },
      welcome: {
        enabled: false,
        channelId: null,
        message: 'Welcome to the server!',
      },
    }
  }
  settings[guildId].welcome = settings[guildId].welcome || {}
  settings[guildId].welcome.enabled = enable
  saveSettings(settings)

  logger.info({ guildId, enable }, 'Welcome enabled setting updated')
}

/**
 * Get whether welcome messages are enabled for a guild
 * @param {string} guildId - Guild ID
 * @returns {boolean} True if enabled
 */
function getWelcomeEnabled(guildId) {
  const guildSettings = getGuildSettings(guildId)
  return guildSettings.welcome?.enabled ?? false
}

/**
 * Set the welcome channel for a guild (saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID to set as welcome channel
 */
function setWelcomeChannel(guildId, channelId) {
  // Always save to MongoDB first if connected
  if (getConnectionStatus()) {
    GuildSettings.findOrCreate(guildId)
      .then((guildSettings) => {
        guildSettings.welcome = guildSettings.welcome || {}
        guildSettings.welcome.channelId = channelId
        return guildSettings.save()
      })
      .then(() => {
        logger.info({ guildId, channelId }, 'Welcome channel set (MongoDB + JSON)')
      })
      .catch((error) => {
        logger.error(
          { error: error.message, guildId, channelId },
          'Error saving to MongoDB, JSON backup preserved'
        )
      })
  } else {
    logger.debug({ guildId, channelId }, 'Welcome channel set (JSON only - MongoDB not connected)')
  }

  // Then save to JSON as backup
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
      logs: {
        channelId: null,
        messageCreate: true,
        messageDelete: true,
      },
      welcome: {
        enabled: false,
        channelId: null,
        message: 'Welcome to the server!',
      },
    }
  }
  settings[guildId].welcome = settings[guildId].welcome || {}
  settings[guildId].welcome.channelId = channelId
  saveSettings(settings)

  logger.info({ guildId, channelId }, 'Welcome channel set')
}

/**
 * Get the welcome channel for a guild
 * @param {string} guildId - Guild ID
 * @returns {string|null} Welcome channel ID or null if not set
 */
function getWelcomeChannel(guildId) {
  const guildSettings = getGuildSettings(guildId)
  return guildSettings.welcome?.channelId || null
}

/**
 * Set the welcome message for a guild (saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} message - Welcome message to set
 */
function setWelcomeMessage(guildId, message) {
  // Always save to MongoDB first if connected
  if (getConnectionStatus()) {
    GuildSettings.findOrCreate(guildId)
      .then((guildSettings) => {
        guildSettings.welcome = guildSettings.welcome || {}
        guildSettings.welcome.message = message
        return guildSettings.save()
      })
      .then(() => {
        logger.info({ guildId, message }, 'Welcome message set (MongoDB + JSON)')
      })
      .catch((error) => {
        logger.error(
          { error: error.message, guildId, message },
          'Error saving to MongoDB, JSON backup preserved'
        )
      })
  } else {
    logger.debug({ guildId, message }, 'Welcome message set (JSON only - MongoDB not connected)')
  }

  // Then save to JSON as backup
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
      logs: {
        channelId: null,
        messageCreate: true,
        messageDelete: true,
      },
      welcome: {
        enabled: false,
        channelId: null,
        message: 'Welcome to the server!',
      },
    }
  }
  settings[guildId].welcome = settings[guildId].welcome || {}
  settings[guildId].welcome.message = message
  saveSettings(settings)

  logger.info({ guildId, message }, 'Welcome message set')
}

/**
 * Get the welcome message for a guild
 * @param {string} guildId - Guild ID
 * @returns {string} Welcome message
 */
function getWelcomeMessage(guildId) {
  const guildSettings = getGuildSettings(guildId)
  return guildSettings.welcome?.message || 'Welcome to the server!'
}

// ===== MONGO DB FUNCTIONS =====

/**
 * Get settings for a specific guild (async, MongoDB primary)
 * @param {string} guildId - Guild ID
 * @returns {Promise<Object>} Guild settings
 */
async function getGuildSettingsAsync(guildId) {
  try {
    if (getConnectionStatus()) {
      // Try MongoDB first
      const settings = await GuildSettings.findOrCreate(guildId)
      return {
        guildId: settings.guildId,
        commandPermissions: Object.fromEntries(settings.commandPermissions || new Map()),
        disabledCommands: settings.disabledCommands || [],
        logChannel: settings.logs?.channelId,
        logMessageCreate: settings.logs?.messageCreate,
        logMessageDelete: settings.logs?.messageDelete,
        welcomeEnabled: settings.welcome?.enabled,
        welcomeChannel: settings.welcome?.channelId,
        welcomeMessage: settings.welcome?.message,
      }
    } else {
      // Fallback to JSON
      logger.warn('MongoDB not connected, falling back to JSON')
      return getGuildSettings(guildId)
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId },
      'Error getting guild settings from MongoDB, falling back to JSON'
    )
    return getGuildSettings(guildId)
  }
}

/**
 * Set role permissions for a command in a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {string} roleId - Role ID to add
 */
async function setCommandRoleAsync(guildId, commandName, roleId) {
  try {
    // Save to MongoDB first if connected
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOrCreate(guildId)
      const permissions = settings.commandPermissions || new Map()
      const roleIds = permissions.get(commandName) || []
      if (!roleIds.includes(roleId)) {
        roleIds.push(roleId)
        permissions.set(commandName, roleIds)
        settings.commandPermissions = permissions
        await settings.save()
      }
      logger.info(
        { guildId, commandName, roleId },
        'Command role permission added (MongoDB + JSON)'
      )
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }

    // Then update JSON backup
    const settings = loadSettings()
    if (!settings[guildId]) {
      settings[guildId] = {
        guildId: guildId,
        commandPermissions: {},
      }
    }
    if (!settings[guildId].commandPermissions[commandName]) {
      settings[guildId].commandPermissions[commandName] = []
    }
    if (!settings[guildId].commandPermissions[commandName].includes(roleId)) {
      settings[guildId].commandPermissions[commandName].push(roleId)
    }
    saveSettings(settings)
  } catch (error) {
    logger.error(
      { error: error.message, guildId, commandName, roleId },
      'Error setting command role, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    const settings = loadSettings()
    if (!settings[guildId]) {
      settings[guildId] = {
        guildId: guildId,
        commandPermissions: {},
      }
    }
    if (!settings[guildId].commandPermissions[commandName]) {
      settings[guildId].commandPermissions[commandName] = []
    }
    if (!settings[guildId].commandPermissions[commandName].includes(roleId)) {
      settings[guildId].commandPermissions[commandName].push(roleId)
    }
    saveSettings(settings)
  }
}

/**
 * Remove role permissions for a command in a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {string} roleId - Role ID to remove
 */
async function removeCommandRoleAsync(guildId, commandName, roleId) {
  try {
    // Always update JSON backup first
    removeCommandRole(guildId, commandName, roleId)

    // Then update MongoDB if connected
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOne({ guildId })
      if (settings?.commandPermissions?.has(commandName)) {
        const permissions = settings.commandPermissions
        const roleIds = permissions.get(commandName).filter((id) => id !== roleId)
        permissions.set(commandName, roleIds)
        settings.commandPermissions = permissions
        await settings.save()
      }
      logger.info(
        { guildId, commandName, roleId },
        'Command role permission removed (MongoDB + JSON)'
      )
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId, commandName, roleId },
      'Error removing command role, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    removeCommandRole(guildId, commandName, roleId)
  }
}

/**
 * Check if a command is disabled in a guild (async, MongoDB primary)
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @returns {Promise<boolean>} True if command is disabled
 */
async function isCommandDisabledAsync(guildId, commandName) {
  try {
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOne({ guildId })
      return settings?.disabledCommands?.includes(commandName) || false
    } else {
      // Fallback to JSON - check if disabledCommands exists
      const settings = loadSettings()
      return settings[guildId]?.disabledCommands?.includes(commandName) || false
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId, commandName },
      'Error checking command disabled status in MongoDB, falling back to JSON'
    )
    const settings = loadSettings()
    return settings[guildId]?.disabledCommands?.includes(commandName) || false
  }
}

/**
 * Disable a command in a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 */
async function disableCommandAsync(guildId, commandName) {
  try {
    // Always update JSON backup first
    const settings = loadSettings()
    if (!settings[guildId]) {
      settings[guildId] = { guildId, commandPermissions: {}, disabledCommands: [] }
    }
    if (!settings[guildId].disabledCommands) {
      settings[guildId].disabledCommands = []
    }
    if (!settings[guildId].disabledCommands.includes(commandName)) {
      settings[guildId].disabledCommands.push(commandName)
      saveSettings(settings)
    }

    // Then update MongoDB if connected
    if (getConnectionStatus()) {
      const mongoSettings = await GuildSettings.findOrCreate(guildId)
      if (!mongoSettings.disabledCommands.includes(commandName)) {
        mongoSettings.disabledCommands.push(commandName)
        await mongoSettings.save()
      }
      logger.info({ guildId, commandName }, 'Command disabled (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId, commandName },
      'Error disabling command, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    const settings = loadSettings()
    if (!settings[guildId]) {
      settings[guildId] = { guildId, commandPermissions: {}, disabledCommands: [] }
    }
    if (!settings[guildId].disabledCommands) {
      settings[guildId].disabledCommands = []
    }
    if (!settings[guildId].disabledCommands.includes(commandName)) {
      settings[guildId].disabledCommands.push(commandName)
      saveSettings(settings)
    }
  }
}

/**
 * Enable a command in a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 */
async function enableCommandAsync(guildId, commandName) {
  try {
    // Always update JSON backup first
    const settings = loadSettings()
    if (settings[guildId]?.disabledCommands?.includes(commandName)) {
      settings[guildId].disabledCommands = settings[guildId].disabledCommands.filter(
        (cmd) => cmd !== commandName
      )
      saveSettings(settings)
    }

    // Then update MongoDB if connected
    if (getConnectionStatus()) {
      const mongoSettings = await GuildSettings.findOne({ guildId })
      if (mongoSettings?.disabledCommands?.includes(commandName)) {
        mongoSettings.disabledCommands = mongoSettings.disabledCommands.filter(
          (cmd) => cmd !== commandName
        )
        await mongoSettings.save()
      }
      logger.info({ guildId, commandName }, 'Command enabled (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId, commandName },
      'Error enabling command, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    const settings = loadSettings()
    if (settings[guildId]?.disabledCommands?.includes(commandName)) {
      settings[guildId].disabledCommands = settings[guildId].disabledCommands.filter(
        (cmd) => cmd !== commandName
      )
      saveSettings(settings)
    }
  }
}

/**
 * Check if a member has permission to use a command (async, MongoDB primary)
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {Object} member - Discord GuildMember object
 * @returns {Promise<boolean>} True if member has permission
 */
async function hasCommandPermissionAsync(guildId, commandName, member) {
  try {
    // Server owner always has permission to use any command
    if (member.id === member.guild.ownerId) {
      return true
    }

    // Check if command is disabled first
    if (await isCommandDisabledAsync(guildId, commandName)) {
      return false
    }

    // Get guild settings
    const guildSettings = await getGuildSettingsAsync(guildId)
    const allowedRoles = guildSettings.commandPermissions[commandName]

    // If command is in default-restricted list AND no specific roles are configured,
    // deny access (only owner can use, but we already checked that above)
    if (
      DEFAULT_RESTRICTED_COMMANDS.has(commandName) &&
      (!allowedRoles || allowedRoles.length === 0)
    ) {
      return false
    }

    // If no roles are configured (and command is not default-restricted), allow everyone
    if (!allowedRoles || allowedRoles.length === 0) {
      return true
    }

    // Check if member has any of the allowed roles
    const memberRoles = member.roles.cache.map((role) => role.id)
    return allowedRoles.some((roleId) => memberRoles.includes(roleId))
  } catch (error) {
    logger.error(
      { error: error.message, guildId, commandName },
      'Error checking command permission in MongoDB, falling back to JSON'
    )
    return hasCommandPermission(guildId, commandName, member)
  }
}

/**
 * Reset all permissions for a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 */
async function resetGuildPermissionsAsync(guildId) {
  try {
    // Always update JSON backup first
    resetGuildPermissions(guildId)

    // Then update MongoDB if connected
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOne({ guildId })
      if (settings) {
        settings.commandPermissions = new Map()
        await settings.save()
      }
      logger.info({ guildId }, 'Guild permissions reset (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId },
      'Error resetting guild permissions, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    resetGuildPermissions(guildId)
  }
}

/**
 * Set the log channel for a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID to set as log channel
 */
async function setLogChannelAsync(guildId, channelId) {
  try {
    // Always update JSON backup first
    setLogChannel(guildId, channelId)

    // Then update MongoDB if connected
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOrCreate(guildId)
      settings.logs = settings.logs || {}
      settings.logs.channelId = channelId
      await settings.save()
      logger.info({ guildId, channelId }, 'Log channel set (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId, channelId },
      'Error setting log channel, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    setLogChannel(guildId, channelId)
  }
}

/**
 * Get the log channel for a guild (async, MongoDB primary)
 * @param {string} guildId - Guild ID
 * @returns {Promise<string|null>} Log channel ID or null if not set
 */
async function getLogChannelAsync(guildId) {
  try {
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOne({ guildId })
      return settings?.logs?.channelId || null
    } else {
      // Fallback to JSON
      logger.warn('MongoDB not connected, using JSON fallback')
      return getLogChannel(guildId)
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId },
      'Error getting log channel from MongoDB, falling back to JSON'
    )
    return getLogChannel(guildId)
  }
}

/**
 * Set whether to log message creates for a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {boolean} enable - True to enable, false to disable
 */
async function setLogMessageCreateAsync(guildId, enable) {
  try {
    // Always update JSON backup first
    setLogMessageCreate(guildId, enable)

    // Then update MongoDB if connected
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOrCreate(guildId)
      settings.logs = settings.logs || {}
      settings.logs.messageCreate = enable
      await settings.save()
      logger.info({ guildId, enable }, 'Log message create setting updated (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId, enable },
      'Error setting log message create, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    setLogMessageCreate(guildId, enable)
  }
}

/**
 * Get whether to log message creates for a guild (async, MongoDB primary)
 * @param {string} guildId - Guild ID
 * @returns {Promise<boolean>} True if enabled
 */
async function getLogMessageCreateAsync(guildId) {
  try {
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOne({ guildId })
      return settings?.logs?.messageCreate ?? true
    } else {
      // Fallback to JSON
      logger.warn('MongoDB not connected, using JSON fallback')
      return getLogMessageCreate(guildId)
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId },
      'Error getting log message create from MongoDB, falling back to JSON'
    )
    return getLogMessageCreate(guildId)
  }
}

/**
 * Set whether to log message deletes for a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {boolean} enable - True to enable, false to disable
 */
async function setLogMessageDeleteAsync(guildId, enable) {
  try {
    // Always update JSON backup first
    setLogMessageDelete(guildId, enable)

    // Then update MongoDB if connected
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOrCreate(guildId)
      settings.logs = settings.logs || {}
      settings.logs.messageDelete = enable
      await settings.save()
      logger.info({ guildId, enable }, 'Log message delete setting updated (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId, enable },
      'Error setting log message delete, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    setLogMessageDelete(guildId, enable)
  }
}

/**
 * Get whether to log message deletes for a guild (async, MongoDB primary)
 * @param {string} guildId - Guild ID
 * @returns {Promise<boolean>} True if enabled
 */
async function getLogMessageDeleteAsync(guildId) {
  try {
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOne({ guildId })
      return settings?.logs?.messageDelete ?? true
    } else {
      // Fallback to JSON
      logger.warn('MongoDB not connected, using JSON fallback')
      return getLogMessageDelete(guildId)
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId },
      'Error getting log message delete from MongoDB, falling back to JSON'
    )
    return getLogMessageDelete(guildId)
  }
}

/**
 * Set whether welcome messages are enabled for a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {boolean} enable - True to enable, false to disable
 */
async function setWelcomeEnabledAsync(guildId, enable) {
  try {
    // Always update JSON backup first
    setWelcomeEnabled(guildId, enable)

    // Then update MongoDB if connected
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOrCreate(guildId)
      settings.welcome = settings.welcome || {}
      settings.welcome.enabled = enable
      await settings.save()
      logger.info({ guildId, enable }, 'Welcome enabled setting updated (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId, enable },
      'Error setting welcome enabled, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    setWelcomeEnabled(guildId, enable)
  }
}

/**
 * Get whether welcome messages are enabled for a guild (async, MongoDB primary)
 * @param {string} guildId - Guild ID
 * @returns {Promise<boolean>} True if enabled
 */
async function getWelcomeEnabledAsync(guildId) {
  try {
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOne({ guildId })
      return settings?.welcome?.enabled ?? false
    } else {
      // Fallback to JSON
      logger.warn('MongoDB not connected, using JSON fallback')
      return getWelcomeEnabled(guildId)
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId },
      'Error getting welcome enabled from MongoDB, falling back to JSON'
    )
    return getWelcomeEnabled(guildId)
  }
}

/**
 * Set the welcome channel for a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID to set as welcome channel
 */
async function setWelcomeChannelAsync(guildId, channelId) {
  try {
    // Save to MongoDB first if connected
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOrCreate(guildId)
      settings.welcome = settings.welcome || {}
      settings.welcome.channelId = channelId
      await settings.save()
      logger.info({ guildId, channelId }, 'Welcome channel set (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }

    // Then update JSON backup
    const settings = loadSettings()
    if (!settings[guildId]) {
      settings[guildId] = {
        guildId: guildId,
        commandPermissions: {},
        logs: {
          channelId: null,
          messageCreate: true,
          messageDelete: true,
        },
        welcome: {
          enabled: false,
          channelId: null,
          message: 'Welcome to the server!',
        },
      }
    }
    settings[guildId].welcome = settings[guildId].welcome || {}
    settings[guildId].welcome.channelId = channelId
    saveSettings(settings)
  } catch (error) {
    logger.error(
      { error: error.message, guildId, channelId },
      'Error setting welcome channel, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    const settings = loadSettings()
    if (!settings[guildId]) {
      settings[guildId] = {
        guildId: guildId,
        commandPermissions: {},
        logs: {
          channelId: null,
          messageCreate: true,
          messageDelete: true,
        },
        welcome: {
          enabled: false,
          channelId: null,
          message: 'Welcome to the server!',
        },
      }
    }
    settings[guildId].welcome = settings[guildId].welcome || {}
    settings[guildId].welcome.channelId = channelId
    saveSettings(settings)
  }
}

/**
 * Get the welcome channel for a guild (async, MongoDB primary)
 * @param {string} guildId - Guild ID
 * @returns {Promise<string|null>} Welcome channel ID or null if not set
 */
async function getWelcomeChannelAsync(guildId) {
  try {
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOne({ guildId })
      return settings?.welcome?.channelId || null
    } else {
      // Fallback to JSON
      logger.warn('MongoDB not connected, using JSON fallback')
      return getWelcomeChannel(guildId)
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId },
      'Error getting welcome channel from MongoDB, falling back to JSON'
    )
    return getWelcomeChannel(guildId)
  }
}

/**
 * Set the welcome message for a guild (async, saves to both MongoDB and JSON)
 * @param {string} guildId - Guild ID
 * @param {string} message - Welcome message to set
 */
async function setWelcomeMessageAsync(guildId, message) {
  try {
    // Always update JSON backup first
    setWelcomeMessage(guildId, message)

    // Then update MongoDB if connected
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOrCreate(guildId)
      settings.welcome = settings.welcome || {}
      settings.welcome.message = message
      await settings.save()
      logger.info({ guildId, message }, 'Welcome message set (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, saved to JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId, message },
      'Error setting welcome message, saved to JSON only'
    )
    // Ensure JSON is updated even if MongoDB fails
    setWelcomeMessage(guildId, message)
  }
}

/**
 * Get the welcome message for a guild (async, MongoDB primary)
 * @param {string} guildId - Guild ID
 * @returns {Promise<string>} Welcome message
 */
async function getWelcomeMessageAsync(guildId) {
  try {
    if (getConnectionStatus()) {
      const settings = await GuildSettings.findOne({ guildId })
      return settings?.welcome?.message || 'Welcome to the server!'
    } else {
      // Fallback to JSON
      logger.warn('MongoDB not connected, using JSON fallback')
      return getWelcomeMessage(guildId)
    }
  } catch (error) {
    logger.error(
      { error: error.message, guildId },
      'Error getting welcome message from MongoDB, falling back to JSON'
    )
    return getWelcomeMessage(guildId)
  }
}

module.exports = {
  // Legacy JSON-based functions (for backward compatibility)
  loadSettings,
  saveSettings,
  getGuildSettings,
  setCommandRole,
  removeCommandRole,
  hasCommandPermission,
  resetGuildPermissions,
  setLogChannel,
  getLogChannel,
  setLogMessageCreate,
  getLogMessageCreate,
  setLogMessageDelete,
  getLogMessageDelete,
  setWelcomeEnabled,
  getWelcomeEnabled,
  setWelcomeChannel,
  getWelcomeChannel,
  setWelcomeMessage,
  getWelcomeMessage,

  // New async MongoDB-based functions
  getGuildSettingsAsync,
  setCommandRoleAsync,
  removeCommandRoleAsync,
  isCommandDisabledAsync,
  disableCommandAsync,
  enableCommandAsync,
  hasCommandPermissionAsync,
  resetGuildPermissionsAsync,
  setLogChannelAsync,
  getLogChannelAsync,
  setLogMessageCreateAsync,
  getLogMessageCreateAsync,
  setLogMessageDeleteAsync,
  getLogMessageDeleteAsync,
  setWelcomeEnabledAsync,
  getWelcomeEnabledAsync,
  setWelcomeChannelAsync,
  getWelcomeChannelAsync,
  setWelcomeMessageAsync,
  getWelcomeMessageAsync,
}
