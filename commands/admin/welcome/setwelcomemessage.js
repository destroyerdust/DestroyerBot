const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js')
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

    logger.info(
      {
        guildId: interaction.guild.id,
        message,
        executedBy: interaction.user.tag,
      },
      'Setting welcome message'
    )

    try {
      await setWelcomeMessageAsync(interaction.guild.id, message)

      await interaction.reply({
        content: `✅ Welcome message set to: "${message}"\n\n**Preview:** ${message
          .replace(/{user}/g, interaction.user.toString())
          .replace(/{username}/g, interaction.user.username)
          .replace(/{guild}/g, interaction.guild.name)}`,
        ephemeral: true,
      })

      logger.info(
        {
          guildId: interaction.guild.id,
          message,
          success: true,
        },
        'Welcome message set successfully'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId: interaction.guild.id,
          message,
        },
        'Error setting welcome message'
      )
      await interaction.reply({
        content: '❌ An error occurred while setting the welcome message.',
        ephemeral: true,
      })
    }
  },
}
