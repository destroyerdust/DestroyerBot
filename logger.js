require('dotenv').config({ quiet: true, override: true })
const pino = require('pino')

// Determine if we're in development or production
const isDevelopment = process.env.NODE_ENV !== 'production'

// Debug: Log environment detection
console.log(`🔍 Environment Debug:`)
console.log(`   NODE_ENV: "${process.env.NODE_ENV}"`)
console.log(`   isDevelopment: ${isDevelopment}`)
console.log(`   Log Level: ${process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info')}`)
console.log(`   Using pino-pretty: ${isDevelopment}`)
console.log(`---`)

const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Use pino-pretty in development for readable logs
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
})

module.exports = logger
