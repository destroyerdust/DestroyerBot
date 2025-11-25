const { EmbedBuilder, Events } = require('discord.js')
const { getLogChannelAsync, getLogMessageUpdateAsync } = require('../utils/guildSettings')
const logger = require('../logger')

module.exports = {
  name: Events.MessageUpdate,
  once: false,
  async execute(oldMessage, newMessage) {
    // Skip if partial (we need at least one full message to do anything useful, usually)
    // But if oldMessage is partial, we might still want to log the new content if we can?
    // Actually, if oldMessage is partial, we don't know the old content.
    // If newMessage is partial, we can fetch it.

    if (newMessage.partial) {
      try {
        await newMessage.fetch()
      } catch (error) {
        logger.error({ error: error.message }, 'Failed to fetch partial new message')
        return
      }
    }

    // Skip bot messages
    if (newMessage.author?.bot) return

    // Skip non-guild messages
    if (!newMessage.guild) return

    // Skip if content is identical (e.g. embed update only)
    if (oldMessage.content === newMessage.content) return

    const guildId = newMessage.guild.id
    const shouldLog = await getLogMessageUpdateAsync(guildId)

    if (!shouldLog) return

    const logChannelId = await getLogChannelAsync(guildId)
    if (!logChannelId) return

    const logChannel = newMessage.guild.channels.cache.get(logChannelId)
    if (!logChannel) return

    const oldContent = oldMessage.partial ? 'Unavailable (Message was not cached)' : oldMessage.content || '*No content*'
    const newContent = newMessage.content || '*No content*'

    const embed = new EmbedBuilder()
      .setTitle('Message Edited')
      .setURL(newMessage.url)
      .setAuthor({
        name: newMessage.author.tag,
        iconURL: newMessage.author.displayAvatarURL(),
      })
      .setDescription(`**Message edited in** ${newMessage.channel}`)
      .addFields(
        { name: 'Before', value: oldContent.substring(0, 1024) },
        { name: 'After', value: newContent.substring(0, 1024) }
      )
      .setFooter({ text: `User ID: ${newMessage.author.id}` })
      .setTimestamp()
      .setColor('#FFA500') // Orange

    try {
      await logChannel.send({ embeds: [embed] })
    } catch (error) {
      logger.error({ error: error.message, guildId }, 'Failed to send message update log')
    }
  },
}
