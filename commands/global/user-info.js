const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user-info')
    .setDescription('Display user info')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to get info about').setRequired(false)
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
      },
      `${interaction.user.username} (#${interaction.user.id}) requested user info`
    )

    const embed = new EmbedBuilder()
      .setTitle(`User Info for ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }) || null)
      .setColor(0x00ff00)

    logger.info(
      {
        userId: user.id,
        username: user.username,
        displayName: user.globalName,
        isBot: user.bot,
        isSystem: user.system,
        hasAccentColor: !!user.hexAccentColor,
        createdAt: user.createdAt.toISOString(),
      },
      'Creating user info embed'
    )

    // Basic info
    embed.addFields(
      { name: 'Username', value: user.username, inline: true },
      { name: 'Display Name', value: user.globalName || 'None', inline: true },
      { name: 'User ID', value: user.id, inline: true }
    )

    // Account info
    embed.addFields(
      { name: 'Account Type', value: user.bot ? 'Bot' : 'User', inline: true },
      { name: 'Created At', value: user.createdAt.toDateString(), inline: true },
      { name: 'Is System', value: user.system ? 'Yes' : 'No', inline: true }
    )

    // Additional info if available
    if (user.hexAccentColor) {
      embed.addFields({ name: 'Accent Color', value: user.hexAccentColor, inline: true })
      logger.debug(`User has accent color: ${user.hexAccentColor}`)
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL({ size: 64 }),
    })

    await interaction.reply({ embeds: [embed], ephemeral: true })
    logger.info(
      {
        targetUser: user.username,
        embedSent: true,
        ephemeral: true,
      },
      'User info response sent'
    )
  },
}
