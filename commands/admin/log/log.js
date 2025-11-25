const {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js')
const {
  getLogChannelAsync,
  setLogChannelAsync,
  getLogMessageCreateAsync,
  setLogMessageCreateAsync,
  getLogMessageDeleteAsync,
  setLogMessageDeleteAsync,
  getLogMessageUpdateAsync,
  setLogMessageUpdateAsync,
  getLogInviteCreateAsync,
  setLogInviteCreateAsync,
  getLogInviteDeleteAsync,
  setLogInviteDeleteAsync,
} = require('../../../utils/guildSettings')
const logger = require('../../../logger')

const LOG_EVENTS = [
  {
    key: 'message.create',
    label: 'Message Create',
    description: 'Log when members create new messages',
    getStatus: getLogMessageCreateAsync,
    setStatus: setLogMessageCreateAsync,
  },
  {
    key: 'message.delete',
    label: 'Message Delete',
    description: 'Log when messages are deleted',
    getStatus: getLogMessageDeleteAsync,
    setStatus: setLogMessageDeleteAsync,
  },
  {
    key: 'message.update',
    label: 'Message Update',
    description: 'Log when messages are edited',
    getStatus: getLogMessageUpdateAsync,
    setStatus: setLogMessageUpdateAsync,
  },
  {
    key: 'invite.create',
    label: 'Invite Create',
    description: 'Log when new invites are created',
    getStatus: getLogInviteCreateAsync,
    setStatus: setLogInviteCreateAsync,
  },
  {
    key: 'invite.delete',
    label: 'Invite Delete',
    description: 'Log when invites are deleted',
    getStatus: getLogInviteDeleteAsync,
    setStatus: setLogInviteDeleteAsync,
  },
]

function getEventConfig(key) {
  return LOG_EVENTS.find((event) => event.key === key)
}

async function getStatusText(guildId, eventKeys) {
  const statuses = []
  for (const key of eventKeys) {
    const event = getEventConfig(key)
    if (!event) continue
    const enabled = await event.getStatus(guildId)
    statuses.push(`${enabled ? '✅' : '❌'} ${event.label} \`${event.key}\``)
  }
  return statuses.join('\n')
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log')
    .setDescription('Configure logging destinations and events')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommandGroup((group) =>
      group
        .setName('channel')
        .setDescription('Manage the log destination channel')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('set')
            .setDescription('Set the channel used for logging')
            .addChannelOption((option) =>
              option
                .setName('channel')
                .setDescription('Text channel to send logs to')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand.setName('status').setDescription('Show the configured log channel')
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('events')
        .setDescription('Enable, disable, or view logging for specific events')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('enable')
            .setDescription('Enable logging for an event')
            .addStringOption((option) =>
              option
                .setName('event')
                .setDescription('Event to enable logging for')
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('disable')
            .setDescription('Disable logging for an event')
            .addStringOption((option) =>
              option
                .setName('event')
                .setDescription('Event to disable logging for')
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('status')
            .setDescription('Show logging status for events')
            .addStringOption((option) =>
              option
                .setName('event')
                .setDescription('Specific event to check (leave empty for all)')
                .setRequired(false)
                .setAutocomplete(true)
            )
        )
    )
    .addSubcommand((subcommand) => subcommand.setName('test').setDescription('Send a test log')),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase()
    const choices = LOG_EVENTS.filter(
      (event) =>
        event.key.toLowerCase().includes(focusedValue) ||
        event.label.toLowerCase().includes(focusedValue)
    )
      .slice(0, 25)
      .map((event) => ({
        name: `${event.label} (${event.key})`,
        value: event.key,
      }))

    await interaction.respond(choices)
  },

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
      'Updating logging configuration'
    )

    try {
      // Channel configuration
      if (subcommandGroup === 'channel') {
        if (subcommand === 'set') {
          const channel = interaction.options.getChannel('channel')
          if (!channel || !channel.isTextBased()) {
            return interaction.reply({
              content: '❌ Log channel must be a text channel.',
              flags: MessageFlags.Ephemeral,
            })
          }
          await setLogChannelAsync(guildId, channel.id)
          return interaction.reply({
            content: `✅ Log channel set to ${channel}.`,
            flags: MessageFlags.Ephemeral,
          })
        }

        if (subcommand === 'status') {
          const channelId = await getLogChannelAsync(guildId)
          const status = channelId ? `<#${channelId}>` : 'Not set'
          return interaction.reply({
            content: `📜 Current log channel: ${status}`,
            flags: MessageFlags.Ephemeral,
          })
        }
      }

      // Event toggles
      if (subcommandGroup === 'events') {
        const eventKey = interaction.options.getString('event')
        const config = eventKey ? getEventConfig(eventKey) : null

        if (eventKey && !config) {
          return interaction.reply({
            content: '❌ Unknown event. Please pick from the autocomplete list.',
            flags: MessageFlags.Ephemeral,
          })
        }

        if (subcommand === 'enable' || subcommand === 'disable') {
          const enable = subcommand === 'enable'
          await config.setStatus(guildId, enable)
          const status = await getStatusText(guildId, [config.key])
          return interaction.reply({
            content: `📝 ${config.label} logging ${enable ? 'enabled' : 'disabled'}.\n${status}`,
            flags: MessageFlags.Ephemeral,
          })
        }

        if (subcommand === 'status') {
          const keys = config ? [config.key] : LOG_EVENTS.map((event) => event.key)
          const status = await getStatusText(guildId, keys)
          return interaction.reply({
            content: `📊 Logging status:\n${status}`,
            flags: MessageFlags.Ephemeral,
          })
        }
      }

      // Test send
      if (!subcommandGroup && subcommand === 'test') {
        const channelId = await getLogChannelAsync(guildId)
        if (!channelId) {
          return interaction.reply({
            content: '❌ No log channel set. Configure one with `/log channel set`.',
            flags: MessageFlags.Ephemeral,
          })
        }

        const channel = interaction.guild.channels.cache.get(channelId)
        if (!channel) {
          try {
            const fetched = await interaction.guild.channels.fetch(channelId)
            if (!fetched || !fetched.isTextBased()) {
              return interaction.reply({
                content:
                  '❌ The configured log channel could not be found or is not a text channel. Please set it again.',
                flags: MessageFlags.Ephemeral,
              })
            }
            await fetched.send({ embeds: [embed] })
            return interaction.reply({
              content: `✅ Test log sent to ${fetched}.`,
              flags: MessageFlags.Ephemeral,
            })
          } catch (fetchError) {
            logger.error(
              { error: fetchError.message, guildId, channelId },
              'Failed to fetch log channel'
            )
            return interaction.reply({
              content:
                '❌ The configured log channel could not be found or is not a text channel. Please set it again.',
              flags: MessageFlags.Ephemeral,
            })
          }
        }

        const embed = new EmbedBuilder()
          .setTitle('Logging Test')
          .setDescription('This is a test log to confirm configuration.')
          .addFields(
            { name: 'Triggered by', value: interaction.user.tag, inline: true },
            { name: 'User ID', value: interaction.user.id, inline: true }
          )
          .setColor('#5865f2')
          .setTimestamp()

        await channel.send({ embeds: [embed] })

        return interaction.reply({
          content: `✅ Test log sent to ${channel}.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      // Fallback for unhandled paths
      return interaction.reply({
        content: '❌ Invalid logging command usage.',
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
        'Error updating logging configuration'
      )

      try {
        await interaction.reply({
          content: '❌ An error occurred while updating logging settings.',
          flags: MessageFlags.Ephemeral,
        })
      } catch (replyError) {
        logger.error({ error: replyError.message }, 'Failed to send error reply')
      }
    }
  },
}
