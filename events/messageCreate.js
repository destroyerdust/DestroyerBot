module.exports = {
  name: 'messageCreate',
  once: false,
  execute(message) {
    const logger = require('../logger')
    if (!message.author.bot) {
      logger.debug(
        `Message from ${message.author.tag} in ${message.guild ? message.guild.name : 'DM'}: ${message.content.substring(0, 100)}`
      )
    }
  },
}
