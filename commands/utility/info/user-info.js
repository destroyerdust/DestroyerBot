const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../../logger')

// Key permissions to display in user info
const KEY_PERMISSIONS = [
  'Administrator',
  'ManageGuild',
  'ManageRoles',
  'ManageChannels',
  'KickMembers',
  'BanMembers',
]

// Emoji mapping for user badges/flags
const FLAG_EMOJIS = {
  Staff: '👨‍💼',
  Partner: '🤝',
  Hypesquad: '🎉',
  BugHunterLevel1: '🐛',
  BugHunterLevel2: '🐛🐛',
  HypeSquadOnlineHouse1: '🏠',
  HypeSquadOnlineHouse2: '🏠',
  HypeSquadOnlineHouse3: '🏠',
  PremiumEarlySupporter: '⭐',
  VerifiedBot: '✅',
  VerifiedDeveloper: '🔧',
  CertifiedModerator: '🛡️',
  BotHTTPInteractions: '🌐',
  ActiveDeveloper: '💻',
}

// Default color fallback
const DEFAULT_COLOR = 0x00ff00

/**
 * Determines account type (Bot, System, or User)
 * @param {User} user - The Discord user object
 * @returns {object} Object with emoji and type string
 */
function getAccountType(user) {
  if (user.bot) return { emoji: '🤖', type: 'Bot' }
  if (user.system) return { emoji: '⚙️', type: 'System' }
  return { emoji: '👤', type: 'User' }
}

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
 * Formats member roles for display
 * @param {GuildMember} member - The guild member object
 * @param {Guild} guild - The guild object
 * @returns {string} Formatted role list
 */
function formatRoles(member, guild) {
  const roles = member.roles.cache
    .filter((role) => role.id !== guild.id) // Exclude @everyone
    .sort((a, b) => b.position - a.position)
    .map((role) => role.toString())
    .slice(0, 10)

  let roleText = roles.length > 0 ? roles.join(', ') : 'None'
  if (roles.length > 10) roleText += ` (+${roles.length - 10} more)`

  return roleText.length > 1024 ? roleText.substring(0, 1021) + '...' : roleText
}

/**
 * Filters and formats user badges/flags
 * @param {User} user - The Discord user object
 * @returns {string} Formatted badge list
 */
function formatBadges(user) {
  const flags = user.flags?.toArray() || []
  if (flags.length === 0) return null

  return flags.map((flag) => `${FLAG_EMOJIS[flag] || '🏷️'} ${flag}`).join('\n')
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user-info')
    .setDescription('Display detailed information about a user')
    .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM])
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to get info about').setRequired(false)
    ),
  async execute(interaction) {
    const requestedUser = interaction.options.getUser('user')
    const user = requestedUser || interaction.user

    // Get member information if in a guild
    const member = interaction.guild ? interaction.guild.members.cache.get(user.id) : null

    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
        targetUser: user.id,
        targetUserName: user.username,
        isSelfLookup: !requestedUser,
        isGuildContext: !!interaction.guild,
        hasMemberData: !!member,
      },
      `${interaction.user.username} (#${interaction.user.id}) requested user info`
    )

    const embed = new EmbedBuilder()
      .setTitle(`👤 User Info: ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setColor(member?.displayColor || user.hexAccentColor || 0x00ff00)

    // Basic user information
    embed.addFields(
      { name: '👤 Username', value: user.username, inline: true },
      { name: '📝 Display Name', value: user.globalName || 'None', inline: true },
      { name: '🆔 User ID', value: user.id, inline: true }
    )

    // Account details
    const { emoji: acctEmoji, type: acctType } = getAccountType(user)
    const accountType = `${acctEmoji} ${acctType}`
    const createdAt = formatTimestamp(user.createdTimestamp, 'F')
    const createdRelative = formatTimestamp(user.createdTimestamp, 'R')

    embed.addFields(
      { name: '🏷️ Account Type', value: accountType, inline: true },
      { name: '📅 Created', value: `${createdAt}\n${createdRelative}`, inline: true },
      { name: '🎨 Accent Color', value: user.hexAccentColor || 'None', inline: true }
    )

    // Guild member information (if available)
    if (member) {
      const joinedAt = formatTimestamp(member.joinedTimestamp, 'F')
      const joinedRelative = formatTimestamp(member.joinedTimestamp, 'R')
      const roleText = formatRoles(member, interaction.guild)

      embed.addFields(
        { name: '📥 Joined Server', value: `${joinedAt}\n${joinedRelative}`, inline: true },
        { name: '🎭 Display Name', value: member.displayName, inline: true },
        { name: '🏆 Top Role', value: member.roles.highest.toString(), inline: true }
      )

      if (roleText !== 'None') {
        embed.addFields({
          name: `👥 Roles (${member.roles.cache.size - 1})`,
          value: roleText,
          inline: false,
        })
      }

      // Member permissions (key permissions only)
      const memberPerms = KEY_PERMISSIONS.filter((perm) => member.permissions.has(perm))
      if (memberPerms.length > 0) {
        embed.addFields({
          name: '🔑 Key Permissions',
          value: memberPerms.join(', '),
          inline: false,
        })
      }
    }

    // User flags/badges (if any)
    const badgeText = formatBadges(user)
    const flagsCount = user.flags?.toArray().length || 0
    if (badgeText) {
      embed.addFields({
        name: '🏷️ Badges',
        value: badgeText,
        inline: false,
      })
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username} • ${member ? 'Guild Member' : 'User'} Info`,
      iconURL: interaction.user.displayAvatarURL({ size: 64 }),
    })

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })

    logger.info(
      {
        targetUser: user.username,
        embedSent: true,
        ephemeral: true,
        hasMemberData: !!member,
        rolesCount: member?.roles.cache.size,
        flagsCount,
      },
      'User info response sent'
    )
  },
}
