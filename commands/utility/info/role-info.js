/**
 * Role Info Command
 * Displays comprehensive information about a server role
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  InteractionContextType,
  PermissionFlagsBits,
} = require('discord.js')
const logger = require('../../../logger')

/**
 * Permission categories for better organization
 * @type {Object.<string, string[]>}
 */
const PERMISSION_CATEGORIES = {
  General: [
    'Administrator',
    'ManageGuild',
    'ManageRoles',
    'ManageChannels',
    'ManageMessages',
    'ManageNicknames',
    'ManageEmojisAndStickers',
    'ManageWebhooks',
    'ManageThreads',
    'ViewAuditLog',
  ],
  Membership: ['KickMembers', 'BanMembers', 'ModerateMembers'],
  Text: [
    'SendMessages',
    'SendMessagesInThreads',
    'CreatePublicThreads',
    'CreatePrivateThreads',
    'SendTTSMessages',
    'ManageMessages',
    'EmbedLinks',
    'AttachFiles',
    'ReadMessageHistory',
    'UseExternalEmojis',
    'UseExternalStickers',
    'MentionEveryone',
    'ManageThreads',
  ],
  Voice: [
    'Connect',
    'Speak',
    'Stream',
    'UseVAD',
    'PrioritySpeaker',
    'MuteMembers',
    'DeafenMembers',
    'MoveMembers',
  ],
}

/**
 * Convert permission bitfield to human-readable names
 * @param {import('discord.js').PermissionsBitField} permissions - The permissions bitfield
 * @returns {Object.<string, string[]>} - Permissions grouped by category
 */
function formatPermissions(permissions) {
  const result = {}

  for (const [category, permissionNames] of Object.entries(PERMISSION_CATEGORIES)) {
    const categoryPerms = []

    for (const permName of permissionNames) {
      if (permissions.has(PermissionFlagsBits[permName])) {
        // Convert camelCase to Title Case
        const readableName = permName
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase())
          .trim()
        categoryPerms.push(readableName)
      }
    }

    if (categoryPerms.length > 0) {
      result[category] = categoryPerms
    }
  }

  return result
}

/**
 * Get role color as hex string
 * @param {import('discord.js').Role} role - The role to get color from
 * @returns {string} - Hex color string
 */
function getRoleColorHex(role) {
  return role.hexColor === '#000000' ? 'Default' : role.hexColor.toUpperCase()
}

/**
 * Role info command definition and handler
 * @type {Object}
 */
module.exports = {
  /**
   * Command data for Discord.js slash command registration
   * Uses modern SlashCommandBuilder API with context restrictions
   */
  data: new SlashCommandBuilder()
    .setName('role-info')
    .setDescription('Display detailed information about a server role')
    .setContexts([InteractionContextType.Guild])
    .addRoleOption((option) =>
      option.setName('role').setDescription('The role to get information about').setRequired(true)
    ),

  /**
   * Execute the role-info command
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    // Input validation - ensure interaction is valid
    if (!interaction || !interaction.isChatInputCommand()) {
      logger.error('Invalid interaction received in role-info command')
      return
    }

    const guild = interaction.guild
    const requestedRole = interaction.options.getRole('role')

    // Log the role info request
    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
        guildId: guild?.id,
        roleId: requestedRole?.id,
        roleName: requestedRole?.name,
      },
      `Role info requested for ${requestedRole?.name || 'unknown role'}`
    )

    try {
      // Validate guild context
      if (!guild) {
        return interaction.reply({
          content: '❌ This command can only be used in a server.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Validate role exists and is accessible
      if (!requestedRole) {
        return interaction.reply({
          content: '❌ Role not found. Please select a valid role from the list.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Get fresh role data from cache to ensure accuracy
      const role = guild.roles.cache.get(requestedRole.id)
      if (!role) {
        return interaction.reply({
          content: '❌ Role not found in this server.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Gather role statistics
      const memberCount = role.members.size
      const permissions = formatPermissions(role.permissions)
      const permissionCount = Object.values(permissions).reduce(
        (total, perms) => total + perms.length,
        0
      )

      // Build role info embed
      const embed = new EmbedBuilder()
        .setTitle(`👤 Role Information: ${role.name}`)
        .setColor(role.color || 0x5865f2)
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({
            dynamic: true,
            size: 16,
            extension: 'png',
          }),
        })
        .setTimestamp()

      // Basic role information
      const createdAt = `<t:${Math.floor(role.createdTimestamp / 1000)}:F>`
      const createdRelative = `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`

      embed.addFields(
        { name: '🆔 Role ID', value: `\`${role.id}\``, inline: true },
        { name: '🎨 Color', value: getRoleColorHex(role), inline: true },
        { name: '📊 Position', value: role.position.toString(), inline: true }
      )

      embed.addFields(
        { name: '👥 Members', value: memberCount.toLocaleString(), inline: true },
        { name: '📅 Created', value: `${createdAt}\n${createdRelative}`, inline: true },
        { name: '🔒 Permissions', value: permissionCount.toString(), inline: true }
      )

      // Role properties
      const properties = []
      if (role.hoisted) properties.push('📌 Hoisted (shows separately)')
      if (role.mentionable) properties.push('🔔 Mentionable')
      if (role.managed) properties.push('🤖 Managed (Bot/Integration)')
      if (role.tags?.botId) properties.push('🤖 Bot Role')
      if (role.tags?.integrationId) properties.push('🔗 Integration Role')
      if (role.tags?.premiumSubscriberRole) properties.push('🚀 Server Booster Role')

      if (properties.length > 0) {
        embed.addFields({
          name: '⚙️ Properties',
          value: properties.join('\n'),
          inline: false,
        })
      }

      // Permissions breakdown
      if (permissionCount > 0) {
        const permissionFields = []

        for (const [category, perms] of Object.entries(permissions)) {
          if (perms.length > 0) {
            const permList = perms.slice(0, 5).join(', ')
            const remaining = perms.length - 5
            const value = remaining > 0 ? `${permList} (+${remaining} more)` : permList

            permissionFields.push(`**${category}:**\n${value}`)
          }
        }

        // Split permissions into multiple fields if too long
        const maxFieldLength = 1024
        let currentField = ''
        let fieldCount = 0

        for (const permField of permissionFields) {
          if ((currentField + '\n\n' + permField).length > maxFieldLength && currentField) {
            embed.addFields({
              name: fieldCount === 0 ? '🔐 Key Permissions' : '🔐 Permissions (continued)',
              value: currentField,
              inline: false,
            })
            currentField = permField
            fieldCount++
          } else {
            currentField += (currentField ? '\n\n' : '') + permField
          }
        }

        if (currentField) {
          embed.addFields({
            name: fieldCount === 0 ? '🔐 Key Permissions' : '🔐 Permissions (continued)',
            value: currentField,
            inline: false,
          })
        }
      } else {
        embed.addFields({
          name: '🔐 Permissions',
          value: 'No special permissions',
          inline: false,
        })
      }

      // Send the role info embed
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })

      logger.info(
        {
          requestedBy: interaction.user.username,
          roleId: role.id,
          roleName: role.name,
          memberCount,
          permissionCount,
          embedSent: true,
          ephemeral: true,
        },
        'Role information sent successfully'
      )
    } catch (error) {
      // Enhanced error handling with structured logging
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          userId: interaction.user?.id,
          guildId: interaction.guild?.id,
          roleId: requestedRole?.id,
          timestamp: new Date().toISOString(),
        },
        'Role info command failed'
      )

      // Provide user-friendly error response
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Role Info Unavailable')
        .setColor(0xff0000)
        .setDescription('Unable to load role information at this time.')
        .addFields({
          name: '🔍 Try Again',
          value: 'Please try the role-info command again in a few moments.',
          inline: false,
        })
        .setTimestamp()
        .setFooter({ text: 'Role Info System' })

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
