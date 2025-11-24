const { Events } = require('discord.js')

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    const logger = require('../logger')
    const {
      getWelcomeEnabledAsync,
      getWelcomeChannelAsync,
      getWelcomeMessageAsync,
    } = require('../utils/guildSettings')

    logger.info(`Member joined: ${member.user.tag} (${member.user.id}) in ${member.guild.name}`)

    try {
      // Check if welcome messages are enabled for this guild
      const welcomeEnabled = await getWelcomeEnabledAsync(member.guild.id)
      if (!welcomeEnabled) {
        return
      }

      // Get welcome channel and message
      const welcomeChannelId = await getWelcomeChannelAsync(member.guild.id)
      const welcomeMessage = await getWelcomeMessageAsync(member.guild.id)

      if (!welcomeChannelId) {
        logger.warn({ guildId: member.guild.id }, 'Welcome enabled but no channel set')
        return
      }

      // Fetch the channel
      const channel = await member.guild.channels.fetch(welcomeChannelId)
      if (!channel || !channel.isTextBased()) {
        logger.warn(
          { guildId: member.guild.id, channelId: welcomeChannelId },
          'Welcome channel not found or not text-based'
        )
        return
      }

      // Replace placeholders in the message
      let message = welcomeMessage
        .replace(/{user}/g, member.user.toString())
        .replace(/{username}/g, member.user.username)
        .replace(/{guild}/g, member.guild.name)

      // Send the welcome message
      await channel.send(message)
      logger.info({ guildId: member.guild.id, channelId: welcomeChannelId }, 'Welcome message sent')
    } catch (error) {
      logger.error(
        { error: error.message, guildId: member.guild.id },
        'Error sending welcome message'
      )
    }
  },
}
