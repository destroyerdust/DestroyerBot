const { Events } = require('discord.js')

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,
  execute(member) {
    const logger = require('../logger')
    logger.info(`Member left: ${member.user.tag} (${member.user.id}) from ${member.guild.name}`)
  },
}
