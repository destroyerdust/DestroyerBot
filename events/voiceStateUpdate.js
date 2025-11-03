module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  execute(oldState, newState) {
    const logger = require('../logger')
    const user = newState.member?.user || oldState.member?.user
    if (!user?.bot) {
      let action = ''
      if (!oldState.channelId && newState.channelId) {
        action = `joined ${newState.channel.name}`
      } else if (oldState.channelId && !newState.channelId) {
        action = `left ${oldState.channel.name}`
      } else if (oldState.channelId !== newState.channelId) {
        action = `moved from ${oldState.channel.name || 'unknown'} to ${newState.channel.name || 'unknown'}`
      }
      if (action) logger.info(`Voice: ${user.tag} ${action}`)
    }
  },
}
