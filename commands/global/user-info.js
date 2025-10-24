const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user-info')
    .setDescription('Display user info')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to get info about')
        .setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user

    const embed = new EmbedBuilder()
      .setTitle(`User Info for ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }) || null)
      .setColor(0x00ff00)

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
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL({ size: 64 })
    })

    await interaction.reply({ embeds: [embed], ephemeral: true })
  },
}
