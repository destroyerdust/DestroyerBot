const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  MessageFlags,
  InteractionContextType,
} = require('discord.js')
const logger = require('../../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-info')
    .setDescription('Display comprehensive information about this server.')
    .setContexts(InteractionContextType.Guild),
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

    // Comprehensive channel counting
    const channels = guild.channels.cache
    const textChannels = channels.filter((ch) => ch.type === ChannelType.GuildText).size
    const voiceChannels = channels.filter((ch) => ch.type === ChannelType.GuildVoice).size
    const stageChannels = channels.filter((ch) => ch.type === ChannelType.GuildStageVoice).size
    const forumChannels = channels.filter((ch) => ch.type === ChannelType.GuildForum).size
    const announcementChannels = channels.filter(
      (ch) => ch.type === ChannelType.GuildAnnouncement
    ).size
    const categories = channels.filter((ch) => ch.type === ChannelType.GuildCategory).size

    // Member status breakdown (now available with GuildPresences intent)
    let onlineCount = 0
    let idleCount = 0
    let dndCount = 0
    let offlineCount = 0

    try {
      // Count members by presence status
      const members = guild.members.cache
      onlineCount = members.filter((m) => m.presence?.status === 'online').size
      idleCount = members.filter((m) => m.presence?.status === 'idle').size
      dndCount = members.filter((m) => m.presence?.status === 'dnd').size
      offlineCount = members.filter((m) => m.presence?.status === 'offline' || !m.presence).size
    } catch (error) {
      logger.debug('Could not fetch member presence data', { error: error.message })
      // Fallback to approximate count if detailed breakdown fails
      onlineCount = guild.approximatePresenceCount || 0
    }

    // Server features and capabilities
    const features = guild.features || []
    const hasFeatures = features.length > 0

    // Verification level names
    const verificationLevels = {
      0: 'None',
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Highest',
    }

    // Premium tier names
    const premiumTiers = {
      0: 'None',
      1: 'Level 1',
      2: 'Level 2',
      3: 'Level 3',
    }

    // Process roles for display
    const roles = guild.roles.cache
      .filter((role) => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)

    const displayRoles = roles.first(10)
    let roleList = displayRoles
      .map((role) => {
        const colorEmoji = role.hexColor && role.hexColor !== '#000000' ? '🔹' : '⚪'
        return `${colorEmoji} ${role.name}`
      })
      .join('\n')

    if (roles.size > 10) {
      roleList += `\n... and ${roles.size - 10} more roles`
    }

    logger.info('Compiling comprehensive server statistics', {
      serverId: guild.id,
      serverName: guild.name,
      memberCount: guild.memberCount,
      approximatePresenceCount: guild.approximatePresenceCount,
      premiumTier: guild.premiumTier,
      textChannels,
      voiceChannels,
      stageChannels,
      forumChannels,
      announcementChannels,
      categories,
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

    const embed = new EmbedBuilder()
      .setTitle(`🏠 ${guild.name}`)
      .setColor(guild.members.me?.displayColor || 0x5865f2)
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
    const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`
    const createdRelative = `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`

    embed.addFields(
      { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
      { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
      { name: '📅 Created', value: `${createdAt}\n${createdRelative}`, inline: true }
    )

    // Member Statistics - using accurate presence data with GuildPresences intent
    const totalMembers = guild.memberCount.toLocaleString()
    const onlineMembers = onlineCount.toLocaleString() // Use actual count from presence data
    const boostLevel = premiumTiers[guild.premiumTier] || 'None'
    const boosts = guild.premiumSubscriptionCount.toLocaleString()

    embed.addFields(
      { name: '👥 Total Members', value: totalMembers, inline: true },
      { name: '🟢 Online Members', value: onlineMembers, inline: true },
      { name: '🚀 Boost Level', value: `${boostLevel} (${boosts} boosts)`, inline: true }
    )

    // Member Status Breakdown (now available with GuildPresences intent)
    const statusText = []
    if (onlineCount > 0) statusText.push(`🟢 ${onlineCount.toLocaleString()}`)
    if (idleCount > 0) statusText.push(`🟡 ${idleCount.toLocaleString()}`)
    if (dndCount > 0) statusText.push(`🔴 ${dndCount.toLocaleString()}`)
    if (offlineCount > 0) statusText.push(`⚫ ${offlineCount.toLocaleString()}`)

    if (statusText.length > 0) {
      embed.addFields({
        name: '📊 Member Status Breakdown',
        value: statusText.join(' • '),
        inline: false,
      })
    }

    // Channel Breakdown
    const channelStats = []
    if (textChannels > 0) channelStats.push(`💬 ${textChannels} Text`)
    if (voiceChannels > 0) channelStats.push(`🔊 ${voiceChannels} Voice`)
    if (stageChannels > 0) channelStats.push(`🎭 ${stageChannels} Stage`)
    if (forumChannels > 0) channelStats.push(`📋 ${forumChannels} Forum`)
    if (announcementChannels > 0) channelStats.push(`📢 ${announcementChannels} Announcement`)
    if (categories > 0) channelStats.push(`📁 ${categories} Categories`)

    embed.addFields(
      { name: '📺 Channels', value: channelStats.join('\n') || 'None', inline: true },
      { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
      {
        name: '🛡️ Verification',
        value: verificationLevels[guild.verificationLevel] || 'Unknown',
        inline: true,
      }
    )

    // Role List
    embed.addFields({
      name: '📋 Role List',
      value: roleList,
      inline: false,
    })

    // Server Features (if any)
    if (hasFeatures) {
      const featureEmojis = {
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

      let featureList = features
        .slice(0, 10)
        .map((feature) => {
          const emoji = featureEmojis[feature] || '✨'
          return `${emoji} ${feature
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, (l) => l.toUpperCase())}`
        })
        .join('\n')

      if (features.length > 10) {
        featureList += `\n... and ${features.length - 10} more`
      }

      embed.addFields({
        name: '✨ Server Features',
        value: featureList,
        inline: false,
      })
    }

    // Additional Server Settings
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

    if (settings.length > 0) {
      embed.addFields({
        name: '⚙️ Server Settings',
        value: settings.join('\n'),
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
      channelsCount: channels.size,
      rolesCount: guild.roles.cache.size,
    })
  },
}
