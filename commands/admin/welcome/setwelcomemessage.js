const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js')
const { setWelcomeMessageAsync } = require('../../../utils/guildSettings')
const logger = require('../../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcomemessage')
    .setDescription('Set the welcome message for new members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The welcome message (use {user}, {username}, {guild} as placeholders)')
        .setRequired(true)
        .setMaxLength(2000)
    ),
  async execute(interaction) {
    const message = interaction.options.getString('message')

    // Input validation
    if (!message || message.trim().length === 0) {
      return interaction.reply({
        content: '❌ Welcome message cannot be empty.',
        flags: MessageFlags.Ephemeral,
      })
    }

    logger.info(
      {
        guildId: interaction.guild.id,
        messageLength: message.length,
        executedBy: interaction.user.tag,
        userId: interaction.user.id,
      },
      'Setting welcome message'
    )

    try {
      await setWelcomeMessageAsync(interaction.guild.id, message)

      // Generate preview with placeholder replacements
      const preview = message
        .replace(/{user}/g, interaction.user.toString())
        .replace(/{username}/g, interaction.user.username)
        .replace(/{guild}/g, interaction.guild.name)

      // Truncate preview if it exceeds Discord's limit
      const previewContent = preview.length > 1900 ? `${preview.substring(0, 1897)}...` : preview

      await interaction.reply({
        content: `✅ Welcome message set successfully!\n\n**Preview:**\n${previewContent}`,
        flags: MessageFlags.Ephemeral,
      })

      logger.info(
        {
          guildId: interaction.guild.id,
          messageLength: message.length,
          previewLength: preview.length,
          success: true,
          userId: interaction.user.id,
        },
        'Welcome message set successfully'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId: interaction.guild.id,
          messageLength: message.length,
          userId: interaction.user.id,
        },
        'Error setting welcome message'
      )

      try {
        await interaction.reply({
          content: '❌ An error occurred while setting the welcome message.',
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
