module.exports = {
  name: 'guildMemberAdd',
  once: false,
  execute(member) {
    const logger = require('../logger')
    logger.info(`Member joined: ${member.user.tag} (${member.user.id}) in ${member.guild.name}`)
  },
}
