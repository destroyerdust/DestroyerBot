/**
 * @fileoverview Server Info command - displays comprehensive server statistics
 * Shows member counts, channel statistics, roles, features, and server settings
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  MessageFlags,
  InteractionContextType,
} = require('discord.js')
const logger = require('../../../logger')

// Verification level names mapping
const VERIFICATION_LEVELS = {
  0: 'None',
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Highest',
}

// Premium tier names mapping
const PREMIUM_TIERS = {
  0: 'None',
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
}

// Feature emoji mapping
const FEATURE_EMOJIS = {
  ANIMATED_BANNER: '🎬',
  ANIMATED_ICON: '🎭',
  BANNER: '🏴',
  COMMUNITY: '🌍',
  DISCOVERABLE: '🔍',
  FEATURABLE: '⭐',
  INVITE_SPLASH: '💫',
  MEMBER_VERIFICATION_GATE_ENABLED: '✅',
  NEWS: '📰',
  PARTNERED: '🤝',
  PREVIEW_ENABLED: '👁️',
  VANITY_URL: '🔗',
  VERIFIED: '✔️',
  VIP_REGIONS: '👑',
  WELCOME_SCREEN_ENABLED: '👋',
}

// Display limits
const DISPLAY_LIMITS = {
  ROLES: 10,
  FEATURES: 10,
}

// Default embed color fallback
const DEFAULT_COLOR = 0x5865f2

/**
 * Formats a timestamp for Discord timestamp display
 * @param {number} timestamp - Millisecond timestamp
 * @param {string} format - Discord timestamp format ('F' for full date, 'R' for relative)
 * @returns {string} Formatted Discord timestamp
 */
function formatTimestamp(timestamp, format = 'F') {
  return `<t:${Math.floor(timestamp / 1000)}:${format}>`
}

/**
 * Compiles channel statistics by type
 * @param {Collection} channels - Guild channels collection
 * @returns {object} Object containing counts for each channel type
 */
function compileChannelStats(channels) {
  return {
    text: channels.filter((ch) => ch.type === ChannelType.GuildText).size,
    voice: channels.filter((ch) => ch.type === ChannelType.GuildVoice).size,
    stage: channels.filter((ch) => ch.type === ChannelType.GuildStageVoice).size,
    forum: channels.filter((ch) => ch.type === ChannelType.GuildForum).size,
    announcement: channels.filter((ch) => ch.type === ChannelType.GuildAnnouncement).size,
    category: channels.filter((ch) => ch.type === ChannelType.GuildCategory).size,
  }
}

/**
 * Compiles member status breakdown by presence
 * @param {Guild} guild - The guild object
 * @returns {object} Object containing counts for each presence status
 */
function compileMemberStatusBreakdown(guild) {
  const breakdown = {
    online: 0,
    idle: 0,
    dnd: 0,
    offline: 0,
  }

  try {
    const members = guild.members.cache
    breakdown.online = members.filter((m) => m.presence?.status === 'online').size
    breakdown.idle = members.filter((m) => m.presence?.status === 'idle').size
    breakdown.dnd = members.filter((m) => m.presence?.status === 'dnd').size
    breakdown.offline = members.filter((m) => m.presence?.status === 'offline' || !m.presence).size
  } catch (error) {
    logger.debug('Could not fetch member presence data', { error: error.message })
    breakdown.online = guild.approximatePresenceCount || 0
  }

  return breakdown
}

/**
 * Formats role list for display with color indicators
 * @param {Guild} guild - The guild object
 * @returns {string} Formatted role list
 */
function formatRoleList(guild) {
  const roles = guild.roles.cache
    .filter((role) => role.name !== '@everyone')
    .sort((a, b) => b.position - a.position)

  const displayRoles = roles.first(DISPLAY_LIMITS.ROLES)
  let roleList = displayRoles
    .map((role) => {
      const colorEmoji = role.hexColor && role.hexColor !== '#000000' ? '🔹' : '⚪'
      return `${colorEmoji} ${role.name}`
    })
    .join('\n')

  if (roles.size > DISPLAY_LIMITS.ROLES) {
    roleList += `\n... and ${roles.size - DISPLAY_LIMITS.ROLES} more roles`
  }

  return roleList
}

/**
 * Formats server features with emojis
 * @param {string[]} features - Array of feature strings
 * @returns {string|null} Formatted feature list or null if no features
 */
function formatServerFeatures(features) {
  if (!features || features.length === 0) return null

  let featureList = features
    .slice(0, DISPLAY_LIMITS.FEATURES)
    .map((feature) => {
      const emoji = FEATURE_EMOJIS[feature] || '✨'
      const formattedName = feature
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase())
      return `${emoji} ${formattedName}`
    })
    .join('\n')

  if (features.length > DISPLAY_LIMITS.FEATURES) {
    featureList += `\n... and ${features.length - DISPLAY_LIMITS.FEATURES} more`
  }

  return featureList
}

/**
 * Compiles server settings for display
 * @param {Guild} guild - The guild object
 * @returns {string[]} Array of setting strings
 */
function compileServerSettings(guild) {
  const settings = []

  if (guild.mfaLevel === 1) settings.push('🔐 2FA Required')
  if (guild.nsfwLevel > 0) settings.push(`🔞 NSFW Level ${guild.nsfwLevel}`)
  if (guild.explicitContentFilter > 0)
    settings.push(`🛡️ Content Filter Level ${guild.explicitContentFilter}`)
  if (guild.defaultMessageNotifications !== 'ALL') settings.push('🔕 Quiet Notifications')
  if (guild.systemChannelFlags?.suppressJoinNotifications)
    settings.push('👋 Join Messages Disabled')
  if (guild.systemChannelFlags?.suppressPremiumSubscriptions)
    settings.push('🚀 Boost Messages Disabled')

  return settings
}

/**
 * Builds member status breakdown display text
 * @param {object} breakdown - Member status breakdown object
 * @returns {string} Formatted status text
 */
function buildStatusBreakdownText(breakdown) {
  const statusText = []

  if (breakdown.online > 0) statusText.push(`🟢 ${breakdown.online.toLocaleString()}`)
  if (breakdown.idle > 0) statusText.push(`🟡 ${breakdown.idle.toLocaleString()}`)
  if (breakdown.dnd > 0) statusText.push(`🔴 ${breakdown.dnd.toLocaleString()}`)
  if (breakdown.offline > 0) statusText.push(`⚫ ${breakdown.offline.toLocaleString()}`)

  return statusText.join(' • ')
}

/**
 * Builds channel statistics display text
 * @param {object} stats - Channel statistics object
 * @returns {string} Formatted channel stats
 */
function buildChannelStatsText(stats) {
  const channelStats = []

  if (stats.text > 0) channelStats.push(`💬 ${stats.text} Text`)
  if (stats.voice > 0) channelStats.push(`🔊 ${stats.voice} Voice`)
  if (stats.stage > 0) channelStats.push(`🎭 ${stats.stage} Stage`)
  if (stats.forum > 0) channelStats.push(`📋 ${stats.forum} Forum`)
  if (stats.announcement > 0) channelStats.push(`📢 ${stats.announcement} Announcement`)
  if (stats.category > 0) channelStats.push(`📁 ${stats.category} Categories`)

  return channelStats.join('\n') || 'None'
}

/**
 * Server info command module
 * @type {import('discord.js').Command}
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-info')
    .setDescription('Display comprehensive information about this server.')
    .setContexts([InteractionContextType.Guild]),
  /**
   * Executes the server-info command
   * @async
   * @param {import('discord.js').CommandInteraction} interaction - The command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const guild = interaction.guild

    logger.info(`${interaction.user.username} (#${interaction.user.id}) requested server info`, {
      requestedBy: interaction.user.id,
      requestedByName: interaction.user.username,
      server: guild ? guild.id : 'not in guild',
      serverName: guild ? guild.name : 'N/A',
      isDM: !guild,
    })

    if (!guild) {
      logger.warn('Server info command used outside of guild', {
        user: interaction.user.id,
        channel: interaction.channel?.id,
        channelType: interaction.channel?.type,
      })
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      })
    }

    // Compile all server statistics
    const channelStats = compileChannelStats(guild.channels.cache)
    const memberStatusBreakdown = compileMemberStatusBreakdown(guild)
    const features = guild.features || []
    const serverSettings = compileServerSettings(guild)

    logger.info('Compiling comprehensive server statistics', {
      serverId: guild.id,
      serverName: guild.name,
      memberCount: guild.memberCount,
      approximatePresenceCount: guild.approximatePresenceCount,
      premiumTier: guild.premiumTier,
      ...channelStats,
      roleCount: guild.roles.cache.size,
      verificationLevel: guild.verificationLevel,
      premiumSubscriptionCount: guild.premiumSubscriptionCount,
      createdAt: guild.createdAt.toISOString(),
      ownerId: guild.ownerId,
      hasDescription: !!guild.description,
      hasIcon: !!guild.iconURL(),
      hasBanner: !!guild.bannerURL(),
      hasSplash: !!guild.splashURL(),
      featuresCount: features.length,
      mfaLevel: guild.mfaLevel,
      nsfwLevel: guild.nsfwLevel,
      explicitContentFilter: guild.explicitContentFilter,
    })

    // Create embed with server information
    const embed = new EmbedBuilder()
      .setTitle(`🏠 ${guild.name}`)
      .setColor(guild.members.me?.displayColor || DEFAULT_COLOR)
      .setThumbnail(guild.iconURL({ size: 256 }))

    // Set banner if available
    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }))
    }

    // Server description
    if (guild.description) {
      embed.setDescription(`📝 ${guild.description}`)
    }

    // Basic Information
    const createdAt = formatTimestamp(guild.createdTimestamp, 'F')
    const createdRelative = formatTimestamp(guild.createdTimestamp, 'R')

    embed.addFields(
      { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
      { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
      { name: '📅 Created', value: `${createdAt}\n${createdRelative}`, inline: true }
    )

    // Member Statistics
    const totalMembers = guild.memberCount.toLocaleString()
    const onlineMembers = memberStatusBreakdown.online.toLocaleString()
    const boostLevel = PREMIUM_TIERS[guild.premiumTier] || 'None'
    const boosts = guild.premiumSubscriptionCount.toLocaleString()

    embed.addFields(
      { name: '👥 Total Members', value: totalMembers, inline: true },
      { name: '🟢 Online Members', value: onlineMembers, inline: true },
      { name: '🚀 Boost Level', value: `${boostLevel} (${boosts} boosts)`, inline: true }
    )

    // Member Status Breakdown
    const statusBreakdownText = buildStatusBreakdownText(memberStatusBreakdown)
    if (statusBreakdownText) {
      embed.addFields({
        name: '📊 Member Status Breakdown',
        value: statusBreakdownText,
        inline: false,
      })
    }

    // Channel Breakdown
    const channelStatsText = buildChannelStatsText(channelStats)
    embed.addFields(
      { name: '📺 Channels', value: channelStatsText, inline: true },
      { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
      {
        name: '🛡️ Verification',
        value: VERIFICATION_LEVELS[guild.verificationLevel] || 'Unknown',
        inline: true,
      }
    )

    // Role List
    const roleList = formatRoleList(guild)
    embed.addFields({
      name: '📋 Role List',
      value: roleList,
      inline: false,
    })

    // Server Features (if any)
    const featureList = formatServerFeatures(features)
    if (featureList) {
      embed.addFields({
        name: '✨ Server Features',
        value: featureList,
        inline: false,
      })
    }

    // Additional Server Settings
    if (serverSettings.length > 0) {
      embed.addFields({
        name: '⚙️ Server Settings',
        value: serverSettings.join('\n'),
        inline: false,
      })
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username} • Server Info`,
      iconURL: interaction.user.displayAvatarURL({ size: 64 }),
    })

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })

    logger.info('Comprehensive server info response sent', {
      serverId: guild.id,
      serverName: guild.name,
      embedSent: true,
      ephemeral: true,
      featuresCount: features.length,
      channelsCount: guild.channels.cache.size,
      rolesCount: guild.roles.cache.size,
    })
  },
}
