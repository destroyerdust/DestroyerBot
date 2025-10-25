module.exports = {
  name: 'guildMemberRemove',
  once: false,
  execute(member) {
    const logger = require('../logger')
    logger.info(`Member left: ${member.user.tag} (${member.user.id}) from ${member.guild.name}`)
  },
}
