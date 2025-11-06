const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  MessageFlags,
  ChannelType,
} = require('discord.js')
const { setWelcomeChannelAsync } = require('../../../utils/guildSettings')
const logger = require('../../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcomechannel')
    .setDescription('Set the channel for welcome messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to send welcome messages to')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel')

    // Input validation
    if (!channel) {
      return interaction.reply({
        content: '❌ Invalid channel selected.',
        flags: MessageFlags.Ephemeral,
      })
    }

    // Channel type validation
    if (channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: '❌ Welcome channel must be a text channel.',
        flags: MessageFlags.Ephemeral,
      })
    }

    logger.info(
      {
        guildId: interaction.guild.id,
        channelId: channel.id,
        channelName: channel.name,
        executedBy: interaction.user.tag,
        userId: interaction.user.id,
      },
      'Setting welcome channel'
    )

    try {
      await setWelcomeChannelAsync(interaction.guild.id, channel.id)

      await interaction.reply({
        content: `✅ Welcome channel set to ${channel}. Welcome messages will be sent here.`,
        flags: MessageFlags.Ephemeral,
      })

      logger.info(
        {
          guildId: interaction.guild.id,
          channelId: channel.id,
          channelName: channel.name,
          success: true,
          userId: interaction.user.id,
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
          userId: interaction.user.id,
        },
        'Error setting welcome channel'
      )

      try {
        await interaction.reply({
          content: '❌ An error occurred while setting the welcome channel.',
          flags: MessageFlags.Ephemeral,
        })
      } catch (replyError) {
        logger.error({ error: replyError.message }, 'Failed to send error reply')
      }
    }
  },
}
