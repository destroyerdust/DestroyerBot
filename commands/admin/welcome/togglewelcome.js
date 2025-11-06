const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js')
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
        userId: interaction.user.id,
      },
      'Toggling welcome messages'
    )

    try {
      await setWelcomeEnabledAsync(interaction.guild.id, enabled)

      await interaction.reply({
        content: `✅ Welcome messages ${enabled ? 'enabled' : 'disabled'}.`,
        flags: MessageFlags.Ephemeral,
      })

      logger.info(
        {
          guildId: interaction.guild.id,
          enabled,
          success: true,
          userId: interaction.user.id,
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
          userId: interaction.user.id,
        },
        'Error toggling welcome messages'
      )

      try {
        await interaction.reply({
          content: '❌ An error occurred while toggling welcome messages.',
          flags: MessageFlags.Ephemeral,
        })
      } catch (replyError) {
        logger.error(
          { error: replyError.message },
          'Failed to send error reply'
        )
      }
    }
  },
}
