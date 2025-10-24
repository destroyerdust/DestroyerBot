const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-info')
    .setDescription('Display info about this server.'),
  async execute(interaction) {
    const guild = interaction.guild

    if (!guild) {
      return interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      })
    }

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
    const tierNames = ['None', 'Tier 1', 'Tier 2', 'Tier 3']
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
    const textChannels = guild.channels.cache.filter((ch) => ch.type === ChannelType.GuildText).size
    const voiceChannels = guild.channels.cache.filter(
      (ch) => ch.type === ChannelType.GuildVoice
    ).size
    const categories = guild.channels.cache.filter(
      (ch) => ch.type === ChannelType.GuildCategory
    ).size

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
    }

    await interaction.reply({ embeds: [embed], ephemeral: true })
  },
}
