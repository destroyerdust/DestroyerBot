const { Events } = require('discord.js')

module.exports = {
  name: Events.GuildDelete,
  once: false,
  execute(guild) {
    const logger = require('../logger')
    logger.info(`Left guild: ${guild.name} (${guild.id})`)
  },
}
