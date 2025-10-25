const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  InteractionContextType,
} = require('discord.js')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display all available commands')
    .setContexts(
      InteractionContextType.Guild | InteractionContextType.DM | InteractionContextType.BotDM
    ),
  async execute(interaction) {
    const client = interaction.client

    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
      },
      `${interaction.user.username} (#${interaction.user.id}) requested help`
    )

    // Map command names to categories
    const categoryMap = {
      ping: 'Utility',
      'server-info': 'Utility',
      'user-info': 'Utility',
      'bot-stats': 'Utility',
      help: 'Utility',
      kick: 'Moderation',
      weather: 'Weather',
      rio: 'Games',
      '3d-print-status': 'Hardware',
      pokemon: 'Pokemon',
    }

    // Group commands by category
    const categories = {}
    client.commands.forEach((command, name) => {
      const category = categoryMap[name] || 'Other'
      if (!categories[category]) categories[category] = []
      categories[category].push(`\`/${name}\`: ${command.data.description}`)
    })

    const embed = new EmbedBuilder()
      .setTitle('Bot Commands')
      .setDescription('Here are all available slash commands organized by category:')
      .setColor(0x00ff00)
      .setFooter({
        text: `Total commands: ${client.commands.size}`,
      })

    // Sort categories for consistent order
    const categoryOrder = ['Utility', 'Moderation', 'Weather', 'Games', 'Hardware', 'Other']

    categoryOrder.forEach((cat) => {
      if (categories[cat]) {
        embed.addFields({
          name: `${cat} (${categories[cat].length})`,
          value: categories[cat].join('\n'),
          inline: false,
        })
      }
    })

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })

    logger.info(
      {
        requestedBy: interaction.user.username,
        embedSent: true,
        ephemeral: true,
      },
      'Help embed sent'
    )
  },
}
