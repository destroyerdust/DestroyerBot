const { Events } = require('discord.js')
const logger = require('../logger')
const { connectToDatabase, setProfilingLevel, getSlowQueries } = require('../utils/database')
const { runMigration } = require('../utils/migrateToMongoDB')

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
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

      // Enable database performance monitoring in development
      if (process.env.NODE_ENV !== 'production') {
        // Enable mongoose debug logging for query monitoring
        const mongoose = require('mongoose')
        mongoose.set('debug', (collection, method, query, doc, options) => {
          const start = Date.now()

          // Log slow queries (>100ms) for performance monitoring
          setImmediate(() => {
            const duration = Date.now() - start
            if (duration > 100) {
              logger.warn(
                {
                  collection,
                  method,
                  duration,
                  query: JSON.stringify(query).substring(0, 500), // Truncate long queries
                },
                'Slow database query detected'
              )
            }
          })
        })

        // Try to enable MongoDB profiling for detailed query analysis
        // Note: This may not be available on all MongoDB instances (e.g., Atlas)
        try {
          await setProfilingLevel(1) // Log queries slower than 100ms
          logger.info('Database profiling enabled for performance monitoring')
        } catch (profileError) {
          logger.info(
            {
              error: profileError.message,
              note: 'Database profiling not available (common with MongoDB Atlas or restricted instances). Query monitoring via mongoose debug logging is still active.',
            },
            'Database profiling unavailable - continuing without profiling'
          )
        }
      }

      // Periodic performance monitoring (every 30 minutes)
      setInterval(
        async () => {
          try {
            if (process.env.NODE_ENV !== 'production') {
              const slowQueries = await getSlowQueries(5)
              if (slowQueries.length > 0) {
                logger.info(
                  { count: slowQueries.length, queries: slowQueries },
                  'Recent slow queries detected'
                )
              }
            }
          } catch (error) {
            logger.debug({ error: error.message }, 'Performance monitoring check failed')
          }
        },
        30 * 60 * 1000
      ) // 30 minutes
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to initialize database')
      // Continue running even if database fails - will use JSON fallback
    }
  },
}
