const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user-info')
    .setDescription('Display detailed information about a user')
    .setContexts(
      InteractionContextType.Guild | InteractionContextType.DM | InteractionContextType.BotDM
    )
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
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setColor(member?.displayColor || user.hexAccentColor || 0x00ff00)

    // Basic user information
    embed.addFields(
      { name: '👤 Username', value: user.username, inline: true },
      { name: '📝 Display Name', value: user.globalName || 'None', inline: true },
      { name: '🆔 User ID', value: user.id, inline: true }
    )

    // Account details
    const accountType = user.bot ? '🤖 Bot' : user.system ? '⚙️ System' : '👤 User'
    const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`
    const createdRelative = `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`

    embed.addFields(
      { name: '🏷️ Account Type', value: accountType, inline: true },
      { name: '📅 Created', value: `${createdAt}\n${createdRelative}`, inline: true },
      { name: '🎨 Accent Color', value: user.hexAccentColor || 'None', inline: true }
    )

    // Guild member information (if available)
    if (member) {
      const joinedAt = `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
      const joinedRelative = `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`

      const roles = member.roles.cache
        .filter(role => role.id !== interaction.guild.id) // Exclude @everyone
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString())
        .slice(0, 10) // Limit to first 10 roles

      const roleText = roles.length > 0 ? roles.join(', ') : 'None'
      if (roles.length > 10) roleText += ` (+${roles.length - 10} more)`

      embed.addFields(
        { name: '📥 Joined Server', value: `${joinedAt}\n${joinedRelative}`, inline: true },
        { name: '🎭 Display Name', value: member.displayName, inline: true },
        { name: '🏆 Top Role', value: member.roles.highest.toString(), inline: true }
      )

      if (roles.length > 0) {
        embed.addFields({
          name: `👥 Roles (${member.roles.cache.size - 1})`,
          value: roleText.length > 1024 ? roleText.substring(0, 1021) + '...' : roleText,
          inline: false
        })
      }

      // Member permissions (key permissions only)
      const keyPermissions = ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'KickMembers', 'BanMembers']
      const memberPerms = keyPermissions.filter(perm => member.permissions.has(perm))
      if (memberPerms.length > 0) {
        embed.addFields({
          name: '🔑 Key Permissions',
          value: memberPerms.join(', '),
          inline: false
        })
      }
    }

    // User flags/badges (if any)
    const flags = user.flags?.toArray() || []
    if (flags.length > 0) {
      const flagEmojis = {
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
        ActiveDeveloper: '💻'
      }

      const flagText = flags.map(flag => `${flagEmojis[flag] || '🏷️'} ${flag}`).join('\n')
      embed.addFields({
        name: '🏷️ Badges',
        value: flagText,
        inline: false
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
        flagsCount: flags.length,
      },
      'User info response sent'
    )
  },
}
