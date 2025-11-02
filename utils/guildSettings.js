const fs = require('node:fs')
const path = require('node:path')
const logger = require('../logger')

const DATA_DIR = path.join(__dirname, '../data')
const SETTINGS_FILE = path.join(DATA_DIR, 'guildSettings.json')

// Commands that are restricted to server owner by default (unless specific roles are assigned)
// NOTE: If you add/remove items here, update any admin commands that reference the same set
// (for example `commands/admin/listpermissions.js`) so the UI/reporting stays consistent.
const DEFAULT_RESTRICTED_COMMANDS = new Set(['kick', 'clean'])

// Ensure data directory exists. This module creates `data/guildSettings.json` on first run.
// Keep this behavior — other parts of the code assume the file exists.
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  logger.info('Created data directory')
}

// Ensure settings file exists
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2))
  logger.info('Created guildSettings.json file')
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
      logChannel: null,
    }
    saveSettings(settings)
  }
  if (!settings[guildId].logChannel) {
    settings[guildId].logChannel = null
  }
  if (typeof settings[guildId].logMessageCreate !== 'boolean') {
    settings[guildId].logMessageCreate = true
  }
  if (typeof settings[guildId].logMessageDelete !== 'boolean') {
    settings[guildId].logMessageDelete = true
  }
  return settings[guildId]
}

/**
 * Set role permissions for a command in a guild
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {string} roleId - Role ID to add
 */
function setCommandRole(guildId, commandName, roleId) {
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
 * Remove role permissions for a command in a guild
 * @param {string} guildId - Guild ID
 * @param {string} commandName - Command name
 * @param {string} roleId - Role ID to remove
 */
function removeCommandRole(guildId, commandName, roleId) {
  const settings = loadSettings()
  if (settings[guildId]?.commandPermissions?.[commandName]) {
    settings[guildId].commandPermissions[commandName] = settings[guildId].commandPermissions[
      commandName
    ].filter((id) => id !== roleId)
    saveSettings(settings)
    logger.info({ guildId, commandName, roleId }, 'Command role permission removed')
  }
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
 * Reset all permissions for a guild
 * @param {string} guildId - Guild ID
 */
function resetGuildPermissions(guildId) {
  const settings = loadSettings()
  if (settings[guildId]) {
    settings[guildId].commandPermissions = {}
    saveSettings(settings)
    logger.info({ guildId }, 'Guild permissions reset')
  }
}

/**
 * Set the log channel for a guild
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID to set as log channel
 */
function setLogChannel(guildId, channelId) {
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
      logChannel: null,
    }
  }
  settings[guildId].logChannel = channelId
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
  return guildSettings.logChannel
}

/**
 * Set whether to log message creates for a guild
 * @param {string} guildId - Guild ID
 * @param {boolean} enable - True to enable, false to disable
 */
function setLogMessageCreate(guildId, enable) {
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
      logChannel: null,
      logMessageCreate: true,
      logMessageDelete: true,
    }
  }
  settings[guildId].logMessageCreate = enable
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
  return guildSettings.logMessageCreate
}

/**
 * Set whether to log message deletes for a guild
 * @param {string} guildId - Guild ID
 * @param {boolean} enable - True to enable, false to disable
 */
function setLogMessageDelete(guildId, enable) {
  const settings = loadSettings()
  if (!settings[guildId]) {
    settings[guildId] = {
      guildId: guildId,
      commandPermissions: {},
      logChannel: null,
      logMessageCreate: true,
      logMessageDelete: true,
    }
  }
  settings[guildId].logMessageDelete = enable
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
  return guildSettings.logMessageDelete
}

module.exports = {
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
}
