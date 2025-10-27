const fs = require('node:fs')
const path = require('node:path')
const logger = require('../logger')

const DATA_DIR = path.join(__dirname, '../data')
const SETTINGS_FILE = path.join(DATA_DIR, 'guildSettings.json')

// Commands that are restricted to server owner by default (unless specific roles are assigned)
const DEFAULT_RESTRICTED_COMMANDS = new Set([
  'kick',
])

// Ensure data directory exists
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
    }
    saveSettings(settings)
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
  if (DEFAULT_RESTRICTED_COMMANDS.has(commandName) && (!allowedRoles || allowedRoles.length === 0)) {
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

module.exports = {
  loadSettings,
  saveSettings,
  getGuildSettings,
  setCommandRole,
  removeCommandRole,
  hasCommandPermission,
  resetGuildPermissions,
}
