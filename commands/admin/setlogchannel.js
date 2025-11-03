const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js')
const { setLogChannelAsync } = require('../../utils/guildSettings')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('Set the channel for moderation and action logging')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption(
      (option) =>
        option
          .setName('channel')
          .setDescription('The channel to use for logging moderation actions')
          .setRequired(true)
          .addChannelTypes(0) // GuildCategory, basically text channels
    ),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel')

    logger.info(
      {
        guildId: interaction.guild.id,
        channelId: channel.id,
        channelName: channel.name,
        executedBy: interaction.user.tag,
      },
      'Setting log channel'
    )

    try {
      await setLogChannelAsync(interaction.guild.id, channel.id)

      await interaction.reply({
        content: `✅ Log channel set to ${channel}. Moderation actions will be logged here.`,
        ephemeral: true,
      })

      logger.info(
        {
          guildId: interaction.guild.id,
          channelId: channel.id,
          success: true,
        },
        'Log channel set successfully'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId: interaction.guild.id,
          channelId: channel.id,
        },
        'Error setting log channel'
      )
      await interaction.reply({
        content: '❌ An error occurred while setting the log channel.',
        ephemeral: true,
      })
    }
  },
}
