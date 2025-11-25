const { EmbedBuilder, Events } = require('discord.js')
const { getLogChannelAsync, getLogInviteDeleteAsync } = require('../utils/guildSettings')
const logger = require('../logger')

module.exports = {
  name: Events.InviteDelete,
  once: false,
  async execute(invite) {
    const guild = invite.guild
    if (!guild) return

    const shouldLog = await getLogInviteDeleteAsync(guild.id)
    if (!shouldLog) return

    const logChannelId = await getLogChannelAsync(guild.id)
    if (!logChannelId) return

    const logChannel = guild.channels.cache.get(logChannelId)
    if (!logChannel) return

    const inviter = invite.inviter
    const uses = invite.maxUses === 0 ? 'Unlimited' : invite.maxUses
    const age = invite.maxAge === 0 ? 'Forever' : `${invite.maxAge}s`

    const embed = new EmbedBuilder()
      .setTitle('Invite Deleted')
      .setDescription(`**Invite deleted for** ${invite.channel}`)
      .addFields(
        { name: 'Code', value: invite.code, inline: true },
        { name: 'Inviter', value: inviter ? `${inviter.tag}` : 'Unknown', inline: true },
        { name: 'Max Uses', value: `${uses}`, inline: true },
        { name: 'Expires', value: `${age}`, inline: true }
      )
      .setFooter({ text: `User ID: ${inviter ? inviter.id : 'Unknown'}` })
      .setTimestamp()
      .setColor('#FF4500') // Orange Red

    try {
      await logChannel.send({ embeds: [embed] })
    } catch (error) {
      logger.error({ error: error.message, guildId: guild.id }, 'Failed to send invite delete log')
    }
  },
}
