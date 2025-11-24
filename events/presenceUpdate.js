const { Events } = require('discord.js')

module.exports = {
  name: Events.PresenceUpdate,
  once: false,
  execute(oldPresence, newPresence) {
    const logger = require('../logger')
    if (oldPresence?.status !== newPresence?.status) {
      logger.debug(
        `Presence: ${newPresence.user?.tag || 'unknown'} is now ${newPresence.status} in ${newPresence.guild?.name || newPresence.guild?.id || 'unknown guild'}`
      )
    }
  },
}
