module.exports = {
  name: 'guildDelete',
  once: false,
  execute(guild) {
    const logger = require('../logger')
    logger.info(`Left guild: ${guild.name} (${guild.id})`)
  },
}
