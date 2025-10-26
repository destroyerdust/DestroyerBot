module.exports = {
  name: 'presenceUpdate',
  once: false,
  execute(oldPresence, newPresence) {
    const logger = require('../logger')
    if (oldPresence?.status !== newPresence?.status) {
      logger.debug(`Presence: ${newPresence.user?.tag || 'unknown'} is now ${newPresence.status}`)
    }
  },
}
