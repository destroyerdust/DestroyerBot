const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  MessageFlags,
  InteractionContextType,
} = require('discord.js')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-info')
    .setDescription('Display info about this server.')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const guild = interaction.guild

    logger.info(`${interaction.user.username} (#${interaction.user.id}) requested server info`, {
      requestedBy: interaction.user.id,
      requestedByName: interaction.user.username,
      server: guild ? guild.id : 'not in guild',
      serverName: guild ? guild.name : 'N/A',
      isDM: !guild,
    })

    if (!guild) {
      logger.warn('Server info command used outside of guild', {
        user: interaction.user.id,
        channel: interaction.channel?.id,
        channelType: interaction.channel?.type,
      })
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      })
    }

    const tierNames = ['None', 'Tier 1', 'Tier 2', 'Tier 3']
    const textChannels = guild.channels.cache.filter((ch) => ch.type === ChannelType.GuildText).size
    const voiceChannels = guild.channels.cache.filter(
      (ch) => ch.type === ChannelType.GuildVoice
    ).size
    const categories = guild.channels.cache.filter(
      (ch) => ch.type === ChannelType.GuildCategory
    ).size

    logger.info('Compiling server statistics', {
      serverId: guild.id,
      serverName: guild.name,
      memberCount: guild.memberCount,
      approximatePresenceCount: guild.approximatePresenceCount,
      premiumTier: guild.premiumTier,
      textChannels,
      voiceChannels,
      categories,
      roleCount: guild.roles.cache.size,
      verificationLevel: guild.verificationLevel,
      premiumSubscriptionCount: guild.premiumSubscriptionCount,
      createdAt: guild.createdAt.toISOString(),
      ownerId: guild.ownerId,
      hasDescription: !!guild.description,
      hasIcon: !!guild.iconURL(),
    })

    const embed = new EmbedBuilder()
      .setTitle(`${guild.name} Server Info`)
      .setColor(0x00ff00)
      .setThumbnail(guild.iconURL() || null)

    // Basic info fields
    embed.addFields(
      { name: 'ID', value: guild.id, inline: true },
      { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Created', value: guild.createdAt.toDateString(), inline: true }
    )

    // Member info
    embed.addFields(
      { name: 'Total Members', value: guild.memberCount.toString(), inline: true },
      {
        name: 'Online Members',
        value: (guild.approximatePresenceCount ?? 0).toString(),
        inline: true,
      },
      { name: 'Boost Level', value: tierNames[guild.premiumTier] || 'Unknown', inline: true }
    )

    // Channel counts
    embed.addFields(
      { name: 'Text Channels', value: textChannels.toString(), inline: true },
      { name: 'Voice Channels', value: voiceChannels.toString(), inline: true },
      { name: 'Categories', value: categories.toString(), inline: true }
    )

    // Other info
    embed.addFields(
      { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
      { name: 'Verification Level', value: guild.verificationLevel.toString(), inline: true },
      { name: 'Boosts', value: guild.premiumSubscriptionCount.toString(), inline: true }
    )

    if (guild.description) {
      embed.setDescription(guild.description)
      logger.debug(
        `Server has custom description: ${guild.description.substring(0, 100)}${guild.description.length > 100 ? '...' : ''}`
      )
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
    logger.info('Server info response sent', {
      serverId: guild.id,
      serverName: guild.name,
      embedSent: true,
      ephemeral: true,
    })
  },
}
