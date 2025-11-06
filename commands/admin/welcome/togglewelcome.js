const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js')
const { setWelcomeEnabledAsync, getWelcomeEnabledAsync } = require('../../../utils/guildSettings')
const logger = require('../../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('togglewelcome')
    .setDescription('Enable or disable welcome messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addBooleanOption((option) =>
      option
        .setName('enabled')
        .setDescription('Whether to enable welcome messages')
        .setRequired(true)
    ),
  async execute(interaction) {
    const enabled = interaction.options.getBoolean('enabled')

    logger.info(
      {
        guildId: interaction.guild.id,
        enabled,
        executedBy: interaction.user.tag,
      },
      'Toggling welcome messages'
    )

    try {
      await setWelcomeEnabledAsync(interaction.guild.id, enabled)

      await interaction.reply({
        content: `✅ Welcome messages ${enabled ? 'enabled' : 'disabled'}.`,
        ephemeral: true,
      })

      logger.info(
        {
          guildId: interaction.guild.id,
          enabled,
          success: true,
        },
        'Welcome messages toggled successfully'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId: interaction.guild.id,
          enabled,
        },
        'Error toggling welcome messages'
      )
      await interaction.reply({
        content: '❌ An error occurred while toggling welcome messages.',
        ephemeral: true,
      })
    }
  },
}
