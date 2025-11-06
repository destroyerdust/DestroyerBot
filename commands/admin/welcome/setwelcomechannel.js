const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js')
const { setWelcomeChannelAsync } = require('../../../utils/guildSettings')
const logger = require('../../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcomechannel')
    .setDescription('Set the channel for welcome messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption(
      (option) =>
        option
          .setName('channel')
          .setDescription('The channel to send welcome messages to')
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
      'Setting welcome channel'
    )

    try {
      await setWelcomeChannelAsync(interaction.guild.id, channel.id)

      await interaction.reply({
        content: `✅ Welcome channel set to ${channel}. Welcome messages will be sent here.`,
        ephemeral: true,
      })

      logger.info(
        {
          guildId: interaction.guild.id,
          channelId: channel.id,
          success: true,
        },
        'Welcome channel set successfully'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId: interaction.guild.id,
          channelId: channel.id,
        },
        'Error setting welcome channel'
      )
      await interaction.reply({
        content: '❌ An error occurred while setting the welcome channel.',
        ephemeral: true,
      })
    }
  },
}
