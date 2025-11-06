/**
 * Channel Info Command
 * Displays comprehensive information about a server channel
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  InteractionContextType,
  ChannelType,
} = require('discord.js')
const logger = require('../../../logger')

/**
 * Get channel type name with emoji
 * @param {import('discord.js').Channel} channel - The channel to get type for
 * @returns {string} - Type name with emoji
 */
function getChannelTypeName(channel) {
  const typeMap = {
    [ChannelType.GuildText]: '💬 Text Channel',
    [ChannelType.GuildVoice]: '🔊 Voice Channel',
    [ChannelType.GuildCategory]: '📁 Category',
    [ChannelType.GuildAnnouncement]: '📢 Announcement Channel',
    [ChannelType.GuildStageVoice]: '🎭 Stage Channel',
    [ChannelType.GuildForum]: '📋 Forum Channel',
    [ChannelType.GuildMedia]: '🖼️ Media Channel',
    [ChannelType.PublicThread]: '🧵 Public Thread',
    [ChannelType.PrivateThread]: '🔒 Private Thread',
    [ChannelType.GuildDirectory]: '📚 Directory Channel',
  }

  return typeMap[channel.type] || `❓ Unknown (${channel.type})`
}

/**
 * Format slowmode delay into readable string
 * @param {number} delaySeconds - Delay in seconds
 * @returns {string} - Formatted delay string
 */
function formatSlowmode(delaySeconds) {
  if (delaySeconds === 0) return 'None'

  const hours = Math.floor(delaySeconds / 3600)
  const minutes = Math.floor((delaySeconds % 3600) / 60)
  const seconds = delaySeconds % 60

  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 && parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

/**
 * Get channel statistics
 * @param {import('discord.js').GuildChannel} channel - The channel to analyze
 * @returns {Object} - Channel statistics
 */
function getChannelStats(channel) {
  const stats = {
    memberCount: 0,
    messageCount: 'Unknown',
    lastActivity: null,
    permissionOverwrites: channel.permissionOverwrites?.cache?.size || 0,
  }

  // Voice channel member count
  if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
    stats.memberCount = channel.members?.size || 0
  }

  // Last message/activity (if available)
  if (channel.lastMessageId) {
    try {
      const lastMessage = channel.messages?.cache?.get(channel.lastMessageId)
      if (lastMessage) {
        stats.lastActivity = lastMessage.createdTimestamp
      }
    } catch (error) {
      // Ignore errors when fetching last message
    }
  }

  return stats
}

/**
 * Channel info command definition and handler
 * @type {Object}
 */
module.exports = {
  /**
   * Command data for Discord.js slash command registration
   * Uses modern SlashCommandBuilder API with context restrictions
   */
  data: new SlashCommandBuilder()
    .setName('channel-info')
    .setDescription('Display detailed information about a channel')
    .setContexts([InteractionContextType.Guild])
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to get information about (defaults to current channel)')
        .setRequired(false)
    ),

  /**
   * Execute the channel-info command
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    // Input validation - ensure interaction is valid
    if (!interaction || !interaction.isChatInputCommand()) {
      logger.error('Invalid interaction received in channel-info command')
      return
    }

    const guild = interaction.guild
    const requestedChannel = interaction.options.getChannel('channel') || interaction.channel

    // Log the channel info request
    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
        guildId: guild?.id,
        channelId: requestedChannel?.id,
        channelName: requestedChannel?.name,
        channelType: requestedChannel?.type,
      },
      `Channel info requested for ${requestedChannel?.name || 'unknown channel'}`
    )

    try {
      // Validate guild context
      if (!guild) {
        return interaction.reply({
          content: '❌ This command can only be used in a server.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Validate channel exists and is accessible
      if (!requestedChannel) {
        return interaction.reply({
          content: '❌ Channel not found. Please select a valid channel.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Get fresh channel data from cache to ensure accuracy
      const channel = guild.channels.cache.get(requestedChannel.id)
      if (!channel) {
        return interaction.reply({
          content: '❌ Channel not found in this server.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Check if bot can view the channel
      if (!channel.viewable) {
        return interaction.reply({
          content: "❌ I don't have permission to view this channel.",
          flags: MessageFlags.Ephemeral,
        })
      }

      // Gather channel statistics
      const stats = getChannelStats(channel)

      // Build channel info embed
      const embed = new EmbedBuilder()
        .setTitle(`${getChannelTypeName(channel)}: ${channel.name}`)
        .setColor(0x5865f2)
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({
            dynamic: true,
            size: 16,
            extension: 'png',
          }),
        })
        .setTimestamp()

      // Basic channel information
      const createdAt = `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>`
      const createdRelative = `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`

      embed.addFields(
        { name: '🆔 Channel ID', value: `\`${channel.id}\``, inline: true },
        { name: '📊 Position', value: channel.position?.toString() || 'N/A', inline: true },
        { name: '📅 Created', value: `${createdAt}\n${createdRelative}`, inline: true }
      )

      // Channel-specific information based on type
      const channelFields = []

      // Text-based channels
      if (
        [
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
          ChannelType.GuildMedia,
        ].includes(channel.type)
      ) {
        if (channel.topic) {
          channelFields.push({
            name: '📝 Topic',
            value:
              channel.topic.length > 1024
                ? channel.topic.substring(0, 1021) + '...'
                : channel.topic,
            inline: false,
          })
        }

        if (channel.nsfw) {
          channelFields.push({ name: '🔞 NSFW', value: 'Yes', inline: true })
        }

        if (channel.rateLimitPerUser > 0) {
          channelFields.push({
            name: '🐌 Slowmode',
            value: formatSlowmode(channel.rateLimitPerUser),
            inline: true,
          })
        }

        // Forum-specific fields
        if (channel.type === ChannelType.GuildForum) {
          if (channel.availableTags?.length > 0) {
            const tagNames = channel.availableTags.map((tag) => tag.name).join(', ')
            channelFields.push({
              name: '🏷️ Available Tags',
              value: tagNames.length > 100 ? tagNames.substring(0, 97) + '...' : tagNames,
              inline: false,
            })
          }

          if (channel.defaultReactionEmoji) {
            channelFields.push({
              name: '😀 Default Reaction',
              value: channel.defaultReactionEmoji.name || channel.defaultReactionEmoji.id,
              inline: true,
            })
          }
        }
      }

      // Voice channels
      if (channel.type === ChannelType.GuildVoice) {
        channelFields.push(
          { name: '👥 Connected Members', value: stats.memberCount.toString(), inline: true },
          { name: '🔊 Bitrate', value: `${channel.bitrate / 1000}kbps`, inline: true },
          {
            name: '👤 User Limit',
            value: channel.userLimit > 0 ? channel.userLimit.toString() : 'Unlimited',
            inline: true,
          }
        )

        if (channel.rtcRegion) {
          channelFields.push({ name: '🌍 Region', value: channel.rtcRegion, inline: true })
        }
      }

      // Stage channels
      if (channel.type === ChannelType.GuildStageVoice) {
        channelFields.push(
          { name: '👥 On Stage', value: stats.memberCount.toString(), inline: true },
          { name: '🎤 Stage Topic', value: channel.topic || 'None set', inline: false }
        )
      }

      // Thread channels
      if (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread) {
        channelFields.push(
          {
            name: '👥 Member Count',
            value: channel.memberCount?.toString() || 'Unknown',
            inline: true,
          },
          {
            name: '💬 Message Count',
            value: channel.messageCount?.toString() || 'Unknown',
            inline: true,
          },
          { name: '📌 Archived', value: channel.archived ? 'Yes' : 'No', inline: true }
        )

        if (channel.ownerId) {
          channelFields.push({
            name: '👑 Owner',
            value: `<@${channel.ownerId}>`,
            inline: true,
          })
        }
      }

      // Category channels
      if (channel.type === ChannelType.GuildCategory) {
        const childChannels = guild.channels.cache.filter((ch) => ch.parentId === channel.id)
        const textChannels = childChannels.filter((ch) => ch.type === ChannelType.GuildText).size
        const voiceChannels = childChannels.filter((ch) =>
          [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(ch.type)
        ).size

        channelFields.push(
          { name: '💬 Text Channels', value: textChannels.toString(), inline: true },
          { name: '🔊 Voice Channels', value: voiceChannels.toString(), inline: true },
          { name: '📺 Total Channels', value: childChannels.size.toString(), inline: true }
        )
      }

      // Add permission overwrites info
      if (stats.permissionOverwrites > 0) {
        channelFields.push({
          name: '🔒 Permission Overwrites',
          value: stats.permissionOverwrites.toString(),
          inline: true,
        })
      }

      // Add channel fields to embed
      channelFields.forEach((field) => embed.addFields(field))

      // Add last activity if available
      if (stats.lastActivity) {
        const lastActivity = `<t:${Math.floor(stats.lastActivity / 1000)}:F>`
        const lastActivityRelative = `<t:${Math.floor(stats.lastActivity / 1000)}:R>`

        embed.addFields({
          name: '🕒 Last Activity',
          value: `${lastActivity}\n${lastActivityRelative}`,
          inline: false,
        })
      }

      // Send the channel info embed
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })

      logger.info(
        {
          requestedBy: interaction.user.username,
          channelId: channel.id,
          channelName: channel.name,
          channelType: channel.type,
          embedSent: true,
          ephemeral: true,
        },
        'Channel information sent successfully'
      )
    } catch (error) {
      // Enhanced error handling with structured logging
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          userId: interaction.user?.id,
          guildId: interaction.guild?.id,
          channelId: requestedChannel?.id,
          timestamp: new Date().toISOString(),
        },
        'Channel info command failed'
      )

      // Provide user-friendly error response
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Channel Info Unavailable')
        .setColor(0xff0000)
        .setDescription('Unable to load channel information at this time.')
        .addFields({
          name: '🔍 Try Again',
          value: 'Please try the channel-info command again in a few moments.',
          inline: false,
        })
        .setTimestamp()
        .setFooter({ text: 'Channel Info System' })

      try {
        await interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        })
      } catch (replyError) {
        logger.error('Failed to send error response:', replyError)
      }
    }
  },
}
