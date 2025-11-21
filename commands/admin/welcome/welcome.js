const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  MessageFlags,
  ChannelType,
  EmbedBuilder,
} = require('discord.js')
const {
  setWelcomeEnabledAsync,
  getWelcomeEnabledAsync,
  setWelcomeChannelAsync,
  getWelcomeChannelAsync,
  setWelcomeMessageAsync,
  getWelcomeMessageAsync,
} = require('../../../utils/guildSettings')
const logger = require('../../../logger')

const PLACEHOLDER_HELP = 'Use {user}, {username}, {guild} for dynamic values.'

function renderWelcomeMessage(template, member) {
  if (!template) return ''
  return template
    .replace(/{user}/g, member.user.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{guild}/g, member.guild.name)
}

function truncate(text, limit = 1900) {
  if (!text) return ''
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommandGroup((group) =>
      group
        .setName('channel')
        .setDescription('Manage the welcome channel')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('set')
            .setDescription('Set the welcome channel')
            .addChannelOption((option) =>
              option
                .setName('channel')
                .setDescription('Channel to send welcome messages')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand.setName('status').setDescription('Show the configured welcome channel')
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('message')
        .setDescription('Manage the welcome message content')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('set')
            .setDescription('Set the welcome message')
            .addStringOption((option) =>
              option
                .setName('content')
                .setDescription(PLACEHOLDER_HELP)
                .setRequired(true)
                .setMaxLength(2000)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand.setName('show').setDescription('Show the current welcome message')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable welcome messages')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable welcome messages').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Show welcome configuration summary')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('test').setDescription('Send a test welcome')
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id
    const subcommandGroup = interaction.options.getSubcommandGroup(false)
    const subcommand = interaction.options.getSubcommand()

    logger.info(
      {
        guildId,
        subcommandGroup: subcommandGroup || null,
        subcommand,
        executedBy: interaction.user.tag,
        userId: interaction.user.id,
      },
      'Updating welcome configuration'
    )

    try {
      // Channel management
      if (subcommandGroup === 'channel') {
        if (subcommand === 'set') {
          const channel = interaction.options.getChannel('channel')
          if (!channel || channel.type !== ChannelType.GuildText) {
            return interaction.reply({
              content: '❌ Welcome channel must be a text channel.',
              flags: MessageFlags.Ephemeral,
            })
          }

          await setWelcomeChannelAsync(guildId, channel.id)

          return interaction.reply({
            content: `✅ Welcome channel set to ${channel}.`,
            flags: MessageFlags.Ephemeral,
          })
        }

        if (subcommand === 'status') {
          const channelId = await getWelcomeChannelAsync(guildId)
          const status = channelId ? `<#${channelId}>` : 'Not set'
          return interaction.reply({
            content: `📨 Welcome channel: ${status}`,
            flags: MessageFlags.Ephemeral,
          })
        }
      }

      // Message management
      if (subcommandGroup === 'message') {
        if (subcommand === 'set') {
          const content = interaction.options.getString('content')
          const trimmed = content.trim()
          if (!trimmed) {
            return interaction.reply({
              content: '❌ Welcome message cannot be empty.',
              flags: MessageFlags.Ephemeral,
            })
          }

          await setWelcomeMessageAsync(guildId, trimmed)

          const preview = truncate(renderWelcomeMessage(trimmed, interaction.member))

          return interaction.reply({
            content: `✅ Welcome message updated.\n\n**Preview:**\n${preview}\n\n${PLACEHOLDER_HELP}`,
            flags: MessageFlags.Ephemeral,
          })
        }

        if (subcommand === 'show') {
          const message = await getWelcomeMessageAsync(guildId)
          const preview = truncate(renderWelcomeMessage(message, interaction.member))
          return interaction.reply({
            content: `📨 Current welcome message:\n${message || '_Not set_'}\n\n**Preview:**\n${preview}`,
            flags: MessageFlags.Ephemeral,
          })
        }
      }

      // Toggle
      if (!subcommandGroup && subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled')
        await setWelcomeEnabledAsync(guildId, enabled)
        const channelId = await getWelcomeChannelAsync(guildId)
        const message = await getWelcomeMessageAsync(guildId)
        const statusLines = [
          `Status: ${enabled ? '✅ Enabled' : '❌ Disabled'}`,
          `Channel: ${channelId ? `<#${channelId}>` : 'Not set'}`,
          `Message: ${message ? truncate(message, 80) : 'Not set'}`,
        ]
        return interaction.reply({
          content: `${enabled ? '✅' : '❌'} Welcome messages ${enabled ? 'enabled' : 'disabled'}.\n${statusLines.join('\n')}`,
          flags: MessageFlags.Ephemeral,
        })
      }

      // Status
      if (!subcommandGroup && subcommand === 'status') {
        const [enabled, channelId, message] = await Promise.all([
          getWelcomeEnabledAsync(guildId),
          getWelcomeChannelAsync(guildId),
          getWelcomeMessageAsync(guildId),
        ])

        const embed = new EmbedBuilder()
          .setTitle('Welcome Configuration')
          .addFields(
            { name: 'Status', value: enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Channel', value: channelId ? `<#${channelId}>` : 'Not set', inline: true },
            { name: 'Message', value: message ? truncate(message, 900) : 'Not set', inline: false }
          )
          .setColor('#00b894')
          .setFooter({ text: PLACEHOLDER_HELP })
          .setTimestamp()

        return interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        })
      }

      // Test
      if (!subcommandGroup && subcommand === 'test') {
        const channelId = await getWelcomeChannelAsync(guildId)
        if (!channelId) {
          return interaction.reply({
            content: '❌ No welcome channel set. Configure one with `/welcome channel set`.',
            flags: MessageFlags.Ephemeral,
          })
        }

        const channel = await interaction.guild.channels.fetch(channelId)
        if (!channel || !channel.isTextBased()) {
          return interaction.reply({
            content:
              '❌ The configured welcome channel could not be found or is not a text channel. Please set it again.',
            flags: MessageFlags.Ephemeral,
          })
        }

        const messageTemplate = await getWelcomeMessageAsync(guildId)
        const message = renderWelcomeMessage(
          messageTemplate || 'Welcome {user} to {guild}!',
          interaction.member
        )

        await channel.send(message)

        return interaction.reply({
          content: `✅ Test welcome message sent to ${channel}.\n\n**Sent message:**\n${truncate(message, 300)}`,
          flags: MessageFlags.Ephemeral,
        })
      }

      // Fallback
      return interaction.reply({
        content: '❌ Invalid welcome command usage.',
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId,
          subcommandGroup,
          subcommand,
          userId: interaction.user.id,
        },
        'Error updating welcome configuration'
      )

      try {
        await interaction.reply({
          content: '❌ An error occurred while updating welcome settings.',
          flags: MessageFlags.Ephemeral,
        })
      } catch (replyError) {
        logger.error({ error: replyError.message }, 'Failed to send error reply')
      }
    }
  },
}
