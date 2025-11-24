const { Events } = require('discord.js')

module.exports = {
  name: Events.MessageUpdate,
  once: false,
  execute(oldMessage, newMessage) {
    const logger = require('../logger')
    if (!oldMessage.author?.bot && !newMessage.author?.bot) {
      logger.debug(
        `Message edited by ${newMessage.author.tag}: "${oldMessage.content?.substring(0, 50)}" -> "${newMessage.content?.substring(0, 50)}"`
      )
    }
  },
}
