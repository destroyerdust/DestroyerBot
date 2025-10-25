require('dotenv').config({ quiet: true, override: true })
const pino = require('pino')
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
})
module.exports = logger
