module.exports = {
  name: 'guildCreate',
  once: false,
  execute(guild) {
    const logger = require('../logger')
    logger.info(`Joined new guild: ${guild.name} (${guild.id}) with ${guild.memberCount} members`)
  },
}
