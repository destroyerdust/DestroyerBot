const { EmbedBuilder } = require('discord.js')
const { getLogChannel, getLogMessageCreate } = require('../utils/guildSettings')
const logger = require('../logger')

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    logger.debug('Message create event fired', {
      hasGuild: !!message.guild,
      guildId: message.guild?.id,
      channelId: message.channel?.id,
      messageId: message.id,
      authorId: message.author?.id,
      isBot: message.author?.bot,
    })

    // Skip bot messages and messages not in guilds
    if (message.author.bot) {
      logger.debug({ messageId: message.id, authorId: message.author?.id }, 'Skipping bot message')
      return
    }
    if (!message.guild) {
      logger.debug({ messageId: message.id }, 'Skipping non-guild message')
      return
    }

    logger.info({ guildId: message.guild.id }, 'Handling message create in guild')

    const logChannelId = getLogChannel(message.guild.id)
    logger.debug({ guildId: message.guild.id, logChannelId }, 'Retrieved log channel ID')

    if (!logChannelId) {
      logger.debug({ guildId: message.guild.id }, 'No log channel set, skipping')
      return
    }

    const logChannel = message.guild.channels.cache.get(logChannelId)
    if (!logChannel) {
      logger.warn({ guildId: message.guild.id, logChannelId }, 'Log channel not found in cache')
      return
    }

    if (!getLogMessageCreate(message.guild.id)) {
      logger.debug({ guildId: message.guild.id }, 'Message create logging disabled, skipping')
      return
    }

    const author = message.author.tag
    const messageId = message.id
    const channelName = message.channel.name
    const timestamp = new Date(message.createdTimestamp).toISOString()

    logger.debug(
      {
        guildId: message.guild.id,
        messageId: message.id,
        hasContent: !!message.content,
        contentLength: message.content ? message.content.length : 0,
      },
      'Message content details'
    )

    const embed = new EmbedBuilder()
      .setTitle('Message Created')
      .addFields(
        { name: 'Channel', value: `#${channelName}`, inline: true },
        { name: 'Author', value: `${author} (${message.author.id})`, inline: true },
        { name: 'Message ID', value: messageId, inline: false },
        { name: 'Timestamp', value: timestamp, inline: false },
        { name: 'Content', value: message.content, inline: false }
      )
      .setColor('#00ff00')
      .setTimestamp()

    try {
      await logChannel.send({ embeds: [embed] })
      logger.info(
        {
          guildId: message.guild.id,
          channelId: message.channel.id,
          messageId: message.id,
          authorId: message.author.id,
        },
        'Message create logged to channel'
      )
    } catch (error) {
      logger.error(
        { error: error.message, guildId: message.guild.id },
        'Failed to send message create log'
      )
    }
  },
}
