const { EmbedBuilder, Events } = require('discord.js')
const { getLogChannelAsync, getLogInviteCreateAsync } = require('../utils/guildSettings')
const logger = require('../logger')

module.exports = {
  name: Events.InviteCreate,
  once: false,
  async execute(invite) {
    logger.info('inviteCreate event triggered')
    const guild = invite.guild
    if (!guild) return

    logger.info(
      {
        guildId: guild.id,
        inviteCode: invite.code,
        channelId: invite.channelId,
        inviterId: invite.inviter ? invite.inviter.id : null,
        maxUses: invite.maxUses,
        maxAge: invite.maxAge,
      },
      'inviteCreate event received'
    )

    const shouldLog = await getLogInviteCreateAsync(guild.id)
    if (!shouldLog) return

    const logChannelId = await getLogChannelAsync(guild.id)
    if (!logChannelId) return

    const logChannel = guild.channels.cache.get(logChannelId)
    if (!logChannel) return

    const inviter = invite.inviter
    const uses = invite.maxUses === 0 ? 'Unlimited' : invite.maxUses
    const age = invite.maxAge === 0 ? 'Forever' : `${invite.maxAge}s`

    const embed = new EmbedBuilder()
      .setTitle('Invite Created')
      .setDescription(`**Invite created for** ${invite.channel}`)
      .addFields(
        { name: 'Code', value: invite.code, inline: true },
        { name: 'Inviter', value: inviter ? `${inviter.tag}` : 'Unknown', inline: true },
        { name: 'Max Uses', value: `${uses}`, inline: true },
        { name: 'Expires', value: `${age}`, inline: true }
      )
      .setFooter({ text: `User ID: ${inviter ? inviter.id : 'Unknown'}` })
      .setTimestamp()
      .setColor('#00FFFF') // Cyan

    try {
      await logChannel.send({ embeds: [embed] })
    } catch (error) {
      logger.error({ error: error.message, guildId: guild.id }, 'Failed to send invite create log')
    }
  },
}
