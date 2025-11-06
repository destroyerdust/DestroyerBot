const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js')
const { resetGuildPermissions } = require('../../../utils/guildSettings')
const logger = require('../../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetpermissions')
    .setDescription('Reset all command role permissions for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    logger.info(
      {
        guildId: interaction.guild.id,
        executedBy: interaction.user.tag,
      },
      'Resetting command permissions'
    )

    try {
      resetGuildPermissions(interaction.guild.id)

      await interaction.reply({
        content: '✅ All command permissions have been reset. Everyone can now use all commands.',
        ephemeral: true,
      })

      logger.info(
        {
          guildId: interaction.guild.id,
          success: true,
        },
        'Command permissions reset successfully'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId: interaction.guild.id,
        },
        'Error resetting command permissions'
      )
      await interaction.reply({
        content: '❌ An error occurred while resetting permissions.',
        ephemeral: true,
      })
    }
  },
}
