module.exports = {
  name: 'messageDelete',
  once: false,
  execute(message) {
    const logger = require('../logger')
    if (message.guild && message.author) {
      logger.info(`Message deleted by ${message.author.tag} in ${message.guild.name}`)
    } else {
      logger.info(`Message deleted: incomplete data`)
    }
  },
}
