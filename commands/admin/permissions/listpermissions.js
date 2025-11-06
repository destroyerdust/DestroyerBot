const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  InteractionContextType,
} = require('discord.js')
const { getGuildSettingsAsync } = require('../../../utils/guildSettings')
const logger = require('../../../logger')

// Import the default restricted commands (should match utils/guildSettings.js)
const DEFAULT_RESTRICTED_COMMANDS = new Set(['kick', 'clean', 'setnick'])

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listpermissions')
    .setDescription('List all command role permissions for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    logger.info(
      {
        guildId: interaction.guild.id,
        executedBy: interaction.user.tag,
      },
      'Listing command permissions'
    )

    try {
      const guildSettings = await getGuildSettingsAsync(interaction.guild.id)
      const permissions = guildSettings.commandPermissions
      const disabledCommands = guildSettings.disabledCommands

      const embed = new EmbedBuilder()
        .setTitle('📋 Command Permissions & Status')
        .setDescription('Role restrictions and enable/disable status for commands in this server')
        .setColor(0x5865f2)
        .setTimestamp()

      // Collect all commands with permissions, disabled status, or that are default-restricted
      const allCommands = new Map()

      // Add configured commands
      for (const [commandName, roleIds] of Object.entries(permissions)) {
        allCommands.set(commandName, {
          roles: roleIds,
          disabled: disabledCommands.includes(commandName),
        })
      }

      // Add disabled commands that don't have role configurations
      for (const commandName of disabledCommands) {
        if (!allCommands.has(commandName)) {
          allCommands.set(commandName, { roles: [], disabled: true })
        }
      }

      // Add default-restricted commands that aren't already configured
      for (const commandName of DEFAULT_RESTRICTED_COMMANDS) {
        if (!allCommands.has(commandName)) {
          allCommands.set(commandName, { roles: null, disabled: false }) // null means default-restricted, no roles
        }
      }

      if (allCommands.size === 0) {
        embed.setDescription(
          'No command permissions have been configured yet. Default-restricted commands (like `/kick` and `/clean`) are owner-only.'
        )
      } else {
        // Sort commands: disabled first, then by name
        const sortedCommands = Array.from(allCommands.entries()).sort((a, b) => {
          if (a[1].disabled && !b[1].disabled) return -1
          if (!a[1].disabled && b[1].disabled) return 1
          return a[0].localeCompare(b[0])
        })

        for (const [commandName, config] of sortedCommands) {
          const { roles, disabled } = config
          let statusEmoji = ''
          let statusText = ''

          if (disabled) {
            statusEmoji = '🚫'
            statusText = ' **DISABLED**'
          } else {
            statusEmoji = '✅'
          }

          if (roles === null) {
            // Default-restricted command with no specific roles
            embed.addFields({
              name: `${statusEmoji} /${commandName}${statusText}`,
              value: '🔒 Server owner only (default restriction)',
              inline: false,
            })
          } else if (roles.length === 0) {
            embed.addFields({
              name: `${statusEmoji} /${commandName}${statusText}`,
              value: '✅ Everyone can use this command',
              inline: false,
            })
          } else {
            const rolesMentions = roles
              .map((roleId) => {
                const role = interaction.guild.roles.cache.get(roleId)
                return role ? `<@&${roleId}>` : `Unknown Role (${roleId})`
              })
              .join(', ')
            embed.addFields({
              name: `${statusEmoji} /${commandName}${statusText}`,
              value: `🔒 Restricted to: ${rolesMentions}`,
              inline: false,
            })
          }
        }
      }

      embed.setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })

      await interaction.reply({ embeds: [embed], ephemeral: true })

      logger.info(
        {
          guildId: interaction.guild.id,
          permissionCount: Object.keys(permissions).length,
        },
        'Command permissions listed successfully'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId: interaction.guild.id,
        },
        'Error listing command permissions'
      )
      await interaction.reply({
        content: '❌ An error occurred while listing permissions.',
        ephemeral: true,
      })
    }
  },
}
