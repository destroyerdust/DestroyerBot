const { EmbedBuilder, AuditLogEvent } = require('discord.js')
const { getLogChannel, getLogMessageDelete } = require('../utils/guildSettings')
const logger = require('../logger')

module.exports = {
  name: 'messageDelete',
  once: false,
  async execute(message) {
    logger.debug('Message delete event fired', {
      hasGuild: !!message.guild,
      guildId: message.guild?.id,
      channelId: message.channel?.id,
      messageId: message.id,
      authorId: message.author?.id,
    })

    if (!message.guild) return

    logger.info({ guildId: message.guild.id }, 'Handling message delete in guild')

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

    if (!getLogMessageDelete(message.guild.id)) {
      logger.debug({ guildId: message.guild.id }, 'Message delete logging disabled, skipping')
      return
    }

    let deletedBy = 'Unknown'
    const author = message.author?.tag || 'Unknown'
    const messageId = message.id
    const channelName = message.channel.name
    const timestamp = message.createdTimestamp
      ? new Date(message.createdTimestamp).toISOString()
      : 'Unknown'

    logger.debug(
      {
        guildId: message.guild.id,
        messageId: message.id,
        hasContent: !!message.content,
        contentLength: message.content ? message.content.length : 0,
      },
      'Deleted message content details'
    )

    // Try to fetch the audit log to find who deleted the message
    try {
      const auditLogs = await message.guild.fetchAuditLogs({
        type: AuditLogEvent.MessageDelete,
        limit: 1,
      })

      const deleteEntry = auditLogs.entries.first()
      if (deleteEntry && deleteEntry.extra.channel.id === message.channel.id) {
        deletedBy = deleteEntry.executor.tag
      }
    } catch (error) {
      logger.warn({ error: error.message }, 'Could not fetch audit logs for message delete')
    }

    const embed = new EmbedBuilder()
      .setTitle('Message Deleted')
      .addFields(
        { name: 'Channel', value: `#${channelName}`, inline: true },
        { name: 'Author', value: `${author} (${message.author?.id || 'Unknown'})`, inline: true },
        { name: 'Deleted By', value: deletedBy, inline: true },
        { name: 'Message ID', value: messageId, inline: false },
        { name: 'Timestamp', value: timestamp, inline: false },
        { name: 'Content', value: message.content || 'Content not cached', inline: false }
      )
      .setColor('#ff0000')
      .setTimestamp()

    try {
      await logChannel.send({ embeds: [embed] })
      logger.info(
        {
          guildId: message.guild.id,
          channelId: message.channel.id,
          messageId: message.id,
          authorId: message.author?.id,
          deletedBy,
        },
        'Message delete logged to channel'
      )
    } catch (error) {
      logger.error(
        { error: error.message, guildId: message.guild.id },
        'Failed to send message delete log'
      )
    }
  },
}
