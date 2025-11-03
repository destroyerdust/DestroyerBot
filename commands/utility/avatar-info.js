const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar-info')
    .setDescription('Get information about a user\'s avatar')
    .setContexts(
      InteractionContextType.Guild | InteractionContextType.DM | InteractionContextType.BotDM
    )
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to get avatar info for').setRequired(false)
    ),
  async execute(interaction) {
    const requestedUser = interaction.options.getUser('user')
    const user = requestedUser || interaction.user

    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
        targetUser: user.id,
        targetUserName: user.username,
        isSelfLookup: !requestedUser,
        isGuildContext: !!interaction.guild,
      },
      `${interaction.user.username} (#${interaction.user.id}) requested avatar info`
    )

    // Get avatar URLs with different options
    const avatarURL = user.displayAvatarURL({ extension: 'png', size: 1024 })
    const avatarURLDynamic = user.displayAvatarURL({ extension: 'png', size: 1024, forceStatic: false })
    const avatarThumbnail = user.displayAvatarURL({ extension: 'png', size: 256 })

    // Check if avatar is animated (GIF)
    const isAnimated = user.avatar?.startsWith('a_') || false

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${user.username}'s Avatar`)
      .setImage(avatarURL)
      .setThumbnail(avatarThumbnail)
      .setColor(user.hexAccentColor || 0x5865f2)

    // Basic user information
    embed.addFields(
      { name: '👤 Username', value: user.username, inline: true },
      { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
      { name: '🎨 Animated', value: isAnimated ? 'Yes (GIF)' : 'No (PNG)', inline: true }
    )

    // Avatar links
    const avatarLinks = [
      `[PNG (1024px)](${avatarURL})`,
      `[Dynamic](${avatarURLDynamic})`,
    ].join(' • ')

    embed.addFields({
      name: '🔗 Direct Links',
      value: avatarLinks,
      inline: false,
    })

    embed.setFooter({
      text: `Requested by ${interaction.user.username} • Avatar Info`,
      iconURL: interaction.user.displayAvatarURL({ size: 64 }),
    })

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })

    logger.info(
      {
        targetUser: user.username,
        avatarURL: avatarURL,
        isAnimated,
        embedSent: true,
        ephemeral: true,
      },
      'Avatar info response sent'
    )
  },
}
