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

module.exports = {
  connectToDatabase,
  disconnectFromDatabase,
  getConnectionStatus,
}
