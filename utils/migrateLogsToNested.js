const logger = require('../logger')
const { connectToDatabase } = require('./database')
const GuildSettings = require('../models/GuildSettings')

/**
 * Check if log migration is needed
 * @returns {Promise<boolean>} True if migration should run
 */
async function shouldRunLogMigration() {
  try {
    // Check if any documents have the old flat log fields
    const count = await GuildSettings.countDocuments({
      $or: [
        { logChannel: { $exists: true } },
        { logMessageCreate: { $exists: true } },
        { logMessageDelete: { $exists: true } },
      ],
    })

    if (count > 0) {
      logger.info(`${count} documents found with old log structure, migration needed`)
      return true
    }

    logger.info('No documents with old log structure found, skipping migration')
    return false
  } catch (error) {
    logger.error({ error: error.message }, 'Error checking log migration status')
    return false
  }
}

/**
 * Migrate existing guild settings to use nested logs object
 * @returns {Promise<void>}
 */
async function migrateLogsToNested() {
  try {
    logger.info('Starting log structure migration...')

    const migrationResults = {
      total: 0,
      migrated: 0,
      errors: 0,
    }

    // Find all documents with old log fields
    const cursor = GuildSettings.find({
      $or: [
        { logChannel: { $exists: true } },
        { logMessageCreate: { $exists: true } },
        { logMessageDelete: { $exists: true } },
      ],
    })

    for await (const settings of cursor) {
      try {
        migrationResults.total++

        // Initialize logs object if it doesn't exist
        if (!settings.logs) {
          settings.logs = {}
        }

        // Move old fields to nested structure
        if (settings.logChannel !== undefined) {
          settings.logs.channelId = settings.logChannel
        }
        if (settings.logMessageCreate !== undefined) {
          settings.logs.messageCreate = settings.logMessageCreate
        }
        if (settings.logMessageDelete !== undefined) {
          settings.logs.messageDelete = settings.logMessageDelete
        }

        // Remove old fields
        settings.logChannel = undefined
        settings.logMessageCreate = undefined
        settings.logMessageDelete = undefined

        await settings.save()
        migrationResults.migrated++

        logger.debug({ guildId: settings.guildId }, 'Migrated log settings to nested structure')
      } catch (error) {
        migrationResults.errors++
        logger.error(
          { error: error.message, guildId: settings.guildId },
          'Error migrating log settings'
        )
      }
    }

    logger.info(
      {
        total: migrationResults.total,
        migrated: migrationResults.migrated,
        errors: migrationResults.errors,
      },
      'Log structure migration completed'
    )
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Log migration failed')
    throw error
  }
}

/**
 * Run the log migration process
 * @returns {Promise<boolean>} True if migration ran successfully
 */
async function runLogMigration() {
  try {
    // Connect to database
    await connectToDatabase()

    // Check if migration is needed
    if (!(await shouldRunLogMigration())) {
      return false
    }

    // Run migration
    await migrateLogsToNested()
    logger.info('Log structure migration completed successfully')
    return true
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Log migration process failed')
    throw error
  }
}

module.exports = {
  runLogMigration,
  shouldRunLogMigration,
}
