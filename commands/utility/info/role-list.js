const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../../logger')

/**
 * Chunk array into smaller arrays of specified size
 * @param {Array} array - Array to chunk
 * @param {number} size - Size of each chunk
 * @returns {Array[]} - Array of chunks
 */
function chunkArray(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Format a role for display in the list
 * @param {import('discord.js').Role} role - The role to format
 * @param {number} position - The display position (1-based)
 * @returns {string} - Formatted role string
 */
function formatRole(role, position) {
  const colorEmoji = role.hexColor && role.hexColor !== '#000000' ? '🔹' : '⚪'
  const memberCount = role.members.size
  return `#${position} ${colorEmoji} ${role.name} (${memberCount} member${memberCount !== 1 ? 's' : ''})`
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role-list')
    .setDescription('Display a comprehensive list of all server roles')
    .setContexts([InteractionContextType.Guild]),
  async execute(interaction) {
    const guild = interaction.guild

    logger.info(`${interaction.user.username} (#${interaction.user.id}) requested role list`, {
      requestedBy: interaction.user.id,
      requestedByName: interaction.user.username,
      server: guild.id,
      serverName: guild.name,
    })

    if (!guild) {
      logger.warn('Role list command used outside of guild', {
        user: interaction.user.id,
        channel: interaction.channel?.id,
        channelType: interaction.channel?.type,
      })
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      })
    }

    try {
      // Get and process roles
      const roles = guild.roles.cache
        .filter((role) => role.name !== '@everyone')
        .sort((a, b) => b.position - a.position)

      const totalRoles = roles.size

      if (totalRoles === 0) {
        return interaction.reply({
          content: 'This server has no custom roles.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Convert to array for chunking
      const roleArray = Array.from(roles.values())

      // Calculate statistics
      const rolesWithMembers = roleArray.filter((role) => role.members.size > 0).length
      const coloredRoles = roleArray.filter(
        (role) => role.hexColor && role.hexColor !== '#000000'
      ).length

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`🎭 ${guild.name} - Role List`)
        .setColor(guild.members.me?.displayColor || 0x5865f2)
        .setThumbnail(guild.iconURL({ size: 256 }))

      // Add summary field
      embed.addFields({
        name: '📊 Role Summary',
        value: `**Total Roles:** ${totalRoles}\n**With Members:** ${rolesWithMembers}\n**Colored Roles:** ${coloredRoles}`,
        inline: true,
      })

      // Chunk roles for display (15 roles per field to stay under 1024 char limit)
      const roleChunks = chunkArray(roleArray, 15)

      // Add role chunks as separate fields
      roleChunks.forEach((chunk, index) => {
        const startPosition = index * 15 + 1
        const endPosition = Math.min((index + 1) * 15, totalRoles)
        const fieldName = `🎯 Roles ${startPosition}-${endPosition}`

        const roleList = chunk
          .map((role, chunkIndex) => formatRole(role, startPosition + chunkIndex))
          .join('\n')

        embed.addFields({
          name: fieldName,
          value: roleList,
          inline: false,
        })
      })

      embed.setFooter({
        text: `Requested by ${interaction.user.username} • ${totalRoles} total roles`,
        iconURL: interaction.user.displayAvatarURL({
          size: 64,
          extension: 'png',
        }),
      })

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })

      logger.info('Role list response sent successfully', {
        serverId: guild.id,
        serverName: guild.name,
        totalRoles,
        rolesWithMembers,
        coloredRoles,
        embedFields: roleChunks.length + 1, // +1 for summary field
        ephemeral: true,
      })
    } catch (error) {
      logger.error('Role list command failed', {
        error: error.message,
        stack: error.stack,
        userId: interaction.user.id,
        guildId: guild.id,
        timestamp: new Date().toISOString(),
      })

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Role List Unavailable')
        .setColor(0xff0000)
        .setDescription('Unable to load role list at this time.')
        .addFields({
          name: '🔍 Try Again',
          value: 'Please try the role-list command again in a few moments.',
          inline: false,
        })
        .setTimestamp()
        .setFooter({ text: 'Role List System' })

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
