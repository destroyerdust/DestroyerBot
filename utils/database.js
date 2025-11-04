const mongoose = require('mongoose')
const logger = require('../logger')
const mongoConnectionString = process.env.MONGO_CONNECTION_STRING
const mongoDatabaseName = process.env.MONGO_DATABASE_NAME

let isConnected = false

/**
 * Connect to MongoDB
 * @returns {Promise<void>}
 */
async function connectToDatabase() {
  try {
    if (isConnected) {
      logger.debug('MongoDB already connected')
      return
    }

    await mongoose.connect(mongoConnectionString, {
      dbName: mongoDatabaseName,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    })

    isConnected = true
    logger.info('Connected to MongoDB successfully')
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to connect to MongoDB')
    throw error
  }
}

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
async function disconnectFromDatabase() {
  try {
    await mongoose.disconnect()
    isConnected = false
    logger.info('Disconnected from MongoDB')
  } catch (error) {
    logger.error({ error: error.message }, 'Error disconnecting from MongoDB')
    throw error
  }
}

/**
 * Get connection status
 * @returns {boolean} True if connected
 */
function getConnectionStatus() {
  return isConnected && mongoose.connection.readyState === 1
}

// Handle connection events
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB')
})

mongoose.connection.on('error', (err) => {
  logger.error({ error: err.message }, 'Mongoose connection error')
})

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB')
  isConnected = false
})

// Handle application termination
process.on('SIGINT', async () => {
  await disconnectFromDatabase()
  process.exit(0)
})

/**
 * Analyze index usage statistics
 * @returns {Promise<Array>} Index usage statistics
 */
async function analyzeIndexUsage() {
  try {
    if (!getConnectionStatus()) {
      logger.warn('Database not connected, cannot analyze index usage')
      return []
    }

    const db = mongoose.connection.db
    const collection = db.collection('guildsettings')

    // Get index usage statistics
    const indexStats = await collection.aggregate([{ $indexStats: {} }]).toArray()

    // Log usage patterns for monitoring
    indexStats.forEach((stat) => {
      logger.info(
        {
          index: stat.name,
          usageCount: stat.accesses?.ops || 0,
          since: stat.accesses?.since || null,
        },
        'Index usage statistics'
      )
    })

    return indexStats
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to analyze index usage')
    return []
  }
}

/**
 * Rebuild all indexes on the guildsettings collection
 * @returns {Promise<void>}
 */
async function rebuildIndexes() {
  try {
    if (!getConnectionStatus()) {
      throw new Error('Database not connected')
    }

    const collection = mongoose.connection.db.collection('guildsettings')

    logger.info('Starting index rebuild...')
    const result = await collection.reIndex()
    logger.info({ result }, 'Index rebuild completed')

    return result
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to rebuild indexes')
    throw error
  }
}

/**
 * Validate database indexes and collection integrity
 * @returns {Promise<Object>} Validation results
 */
async function validateIndexes() {
  try {
    if (!getConnectionStatus()) {
      throw new Error('Database not connected')
    }

    const collection = mongoose.connection.db.collection('guildsettings')

    const validation = await collection.validate()
    if (!validation.valid) {
      logger.error({ validation }, 'Index validation failed')
      throw new Error('Database indexes are corrupted')
    }

    logger.info({ validation }, 'Index validation passed')
    return validation
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to validate indexes')
    throw error
  }
}

/**
 * Get database performance metrics
 * @returns {Promise<Object>} Database metrics
 */
async function getDatabaseMetrics() {
  try {
    if (!getConnectionStatus()) {
      throw new Error('Database not connected')
    }

    const db = mongoose.connection.db
    const stats = await db.stats()

    const metrics = {
      collections: stats.collections,
      indexes: stats.indexes,
      indexSize: stats.indexSize,
      avgObjSize: stats.avgObjSize,
      storageSize: stats.storageSize,
      totalSize: stats.totalSize,
      db: stats.db,
    }

    logger.debug(metrics, 'Database metrics retrieved')
    return metrics
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get database metrics')
    throw error
  }
}

/**
 * Enable database query profiling for performance monitoring
 * @param {number} level - Profiling level (0=off, 1=slow operations, 2=all operations)
 * @returns {Promise<Object>} Profiling status
 */
async function setProfilingLevel(level = 1) {
  try {
    if (!getConnectionStatus()) {
      throw new Error('Database not connected')
    }

    const db = mongoose.connection.db
    // MongoDB Node.js driver uses string values for profiling levels
    const levelMap = {
      0: 'off',
      1: 'slow_only',
      2: 'all',
    }

    const stringLevel = levelMap[level]
    if (!stringLevel) {
      throw new Error(`Invalid profiling level: ${level}. Must be 0, 1, or 2`)
    }

    const result = await db.setProfilingLevel(stringLevel)

    logger.info({ level, stringLevel, result }, 'Database profiling level set')
    return result
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to set profiling level')
    throw error
  }
}

/**
 * Get slow query statistics from system.profile
 * @param {number} limit - Maximum number of queries to return
 * @returns {Promise<Array>} Slow query statistics
 */
async function getSlowQueries(limit = 10) {
  try {
    if (!getConnectionStatus()) {
      throw new Error('Database not connected')
    }

    const db = mongoose.connection.db
    const profileCollection = db.collection('system.profile')

    const slowQueries = await profileCollection
      .find({ millis: { $gt: 100 } }) // Queries slower than 100ms
      .sort({ ts: -1 })
      .limit(limit)
      .toArray()

    logger.info({ count: slowQueries.length }, 'Retrieved slow query statistics')
    return slowQueries
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get slow queries')
    return []
  }
}

module.exports = {
  connectToDatabase,
  disconnectFromDatabase,
  getConnectionStatus,
  analyzeIndexUsage,
  rebuildIndexes,
  validateIndexes,
  getDatabaseMetrics,
  setProfilingLevel,
  getSlowQueries,
}
