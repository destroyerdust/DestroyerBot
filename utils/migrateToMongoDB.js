const fs = require('node:fs')
const path = require('node:path')
const logger = require('../logger')
const { connectToDatabase } = require('./database')
const GuildSettings = require('../models/GuildSettings')

const DATA_DIR = path.join(__dirname, '../data')
const SETTINGS_FILE = path.join(DATA_DIR, 'guildSettings.json')

/**
 * Check if migration is needed
 * @returns {boolean} True if migration should run
 */
async function shouldRunMigration() {
  try {
    // Check if JSON file exists
    if (!fs.existsSync(SETTINGS_FILE)) {
      logger.info('No JSON settings file found, skipping migration')
      return false
    }

    // Check if MongoDB already has data
    const count = await GuildSettings.countDocuments()
    if (count > 0) {
      logger.info('MongoDB already contains guild settings, skipping migration')
      return false
    }

    return true
  } catch (error) {
    logger.error({ error: error.message }, 'Error checking migration status')
    return false
  }
}

/**
 * Load settings from JSON file
 * @returns {Object} Guild settings object
 */
function loadJsonSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    logger.error({ error: error.message }, 'Error loading JSON settings')
    throw error
  }
}

/**
 * Migrate guild settings from JSON to MongoDB
 * @returns {Promise<void>}
 */
async function migrateSettings() {
  try {
    logger.info('Starting migration from JSON to MongoDB...')

    const jsonSettings = loadJsonSettings()
    const migrationResults = {
      total: 0,
      migrated: 0,
      errors: 0,
    }

    for (const [guildId, settings] of Object.entries(jsonSettings)) {
      try {
        migrationResults.total++

        // Create new GuildSettings document
        const guildSettings = new GuildSettings({
          guildId,
          commandPermissions: settings.commandPermissions || {},
          disabledCommands: settings.disabledCommands || [], // Will be empty initially
          logs: {
            channelId: settings.logChannel || null,
            messageCreate:
              settings.logMessageCreate !== undefined ? settings.logMessageCreate : true,
            messageDelete:
              settings.logMessageDelete !== undefined ? settings.logMessageDelete : true,
          },
        })

        await guildSettings.save()
        migrationResults.migrated++

        logger.debug({ guildId }, 'Migrated guild settings')
      } catch (error) {
        migrationResults.errors++
        logger.error({ error: error.message, guildId }, 'Error migrating guild settings')
      }
    }

    logger.info(
      {
        total: migrationResults.total,
        migrated: migrationResults.migrated,
        errors: migrationResults.errors,
      },
      'Migration completed'
    )

    if (migrationResults.errors === 0) {
      // Backup the original file and remove it
      const backupFile = `${SETTINGS_FILE}.backup`
      fs.renameSync(SETTINGS_FILE, backupFile)
      logger.info({ backupFile }, 'JSON settings file backed up and removed')
    }
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Migration failed')
    throw error
  }
}

/**
 * Run the migration process
 * @returns {Promise<boolean>} True if migration ran successfully
 */
async function runMigration() {
  try {
    // Connect to database
    await connectToDatabase()

    // Check if migration is needed
    if (!(await shouldRunMigration())) {
      return false
    }

    // Run migration
    await migrateSettings()
    logger.info('Migration from JSON to MongoDB completed successfully')
    return true
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Migration process failed')
    throw error
  }
}

module.exports = {
  runMigration,
  shouldRunMigration,
}
