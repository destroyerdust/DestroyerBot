const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js')
const { setWelcomeEnabledAsync } = require('../../../utils/guildSettings')
const logger = require('../../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('togglewelcome')
    .setDescription('Enable or disable welcome messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('action')
        .setDescription('Enable or disable welcome messages')
        .setRequired(true)
        .addChoices(
          { name: 'enable', value: 'enable' },
          { name: 'disable', value: 'disable' }
        )
    ),
  async execute(interaction) {
    const action = interaction.options.getString('action')
    const enabled = action === 'enable'

    logger.info(
      {
        guildId: interaction.guild.id,
        action,
        enabled,
        executedBy: interaction.user.tag,
        userId: interaction.user.id,
      },
      'Toggling welcome messages'
    )

    try {
      await setWelcomeEnabledAsync(interaction.guild.id, enabled)

      await interaction.reply({
        content: `✅ Welcome messages ${action}d.`,
        flags: MessageFlags.Ephemeral,
      })

      logger.info(
        {
          guildId: interaction.guild.id,
          action,
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
          action,
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
