const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  InteractionContextType,
} = require('discord.js')
const {
  getGuildSettingsAsync,
  resetGuildPermissionsAsync,
  setCommandRole,
  removeCommandRoleAsync,
  DEFAULT_RESTRICTED_COMMANDS,
} = require('../../utils/guildSettings')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('permission')
    .setDescription('Manage command role permissions for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List all command role permissions for this server')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('reset').setDescription('Reset all command role permissions to defaults')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set which role can use a specific command')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('Select a command from the list')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('The role that should have access to this command')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a role from a specific command')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('Select a command from the list')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('The role to remove from this command')
            .setRequired(true)
        )
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase()

    // Get all command names from the bot, excluding the permission command itself
    const commands = interaction.client.commands
    const excludedCommands = ['permission']
    const commandNames = Array.from(commands.keys()).filter(
      (name) => !excludedCommands.includes(name)
    )

    // Filter commands based on user input
    const filtered = commandNames
      .filter((name) => name.toLowerCase().includes(focusedValue))
      .slice(0, 25) // Discord limits to 25 choices
      .map((name) => ({ name: name, value: name }))

    await interaction.respond(filtered)
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()

    switch (subcommand) {
      case 'list':
        return await handleList(interaction)
      case 'reset':
        return await handleReset(interaction)
      case 'set':
        return await handleSet(interaction)
      case 'remove':
        return await handleRemove(interaction)
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand.',
          ephemeral: true,
        })
    }
  },
}

async function handleList(interaction) {
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
}

async function handleReset(interaction) {
  logger.info(
    {
      guildId: interaction.guild.id,
      executedBy: interaction.user.tag,
    },
    'Resetting command permissions'
  )

  try {
    await resetGuildPermissionsAsync(interaction.guild.id)

    await interaction.reply({
      content: '✅ All command permissions have been reset. Everyone can now use all commands.',
      ephemeral: true,
    })

    logger.info(
      {
        guildId: interaction.guild.id,
        success: true,
      },
      'Command permissions reset successfully'
    )
  } catch (error) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        guildId: interaction.guild.id,
      },
      'Error resetting command permissions'
    )
    await interaction.reply({
      content: '❌ An error occurred while resetting permissions.',
      ephemeral: true,
    })
  }
}

async function handleSet(interaction) {
  const commandName = interaction.options.getString('command')
  const role = interaction.options.getRole('role')

  logger.info(
    {
      guildId: interaction.guild.id,
      commandName,
      roleId: role.id,
      roleName: role.name,
      executedBy: interaction.user.tag,
    },
    'Setting command role permission'
  )

  try {
    setCommandRole(interaction.guild.id, commandName, role.id)

    await interaction.reply({
      content: `✅ Role ${role} can now use the \`/${commandName}\` command.`,
      ephemeral: true,
    })

    logger.info(
      {
        guildId: interaction.guild.id,
        commandName,
        roleId: role.id,
        success: true,
      },
      'Command role permission set successfully'
    )
  } catch (error) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        guildId: interaction.guild.id,
        commandName,
        roleId: role.id,
      },
      'Error setting command role permission'
    )
    await interaction.reply({
      content: '❌ An error occurred while setting the permission.',
      ephemeral: true,
    })
  }
}

async function handleRemove(interaction) {
  const commandName = interaction.options.getString('command')
  const role = interaction.options.getRole('role')

  logger.info(
    {
      guildId: interaction.guild.id,
      commandName,
      roleId: role.id,
      roleName: role.name,
      executedBy: interaction.user.tag,
    },
    'Removing command role permission'
  )

  try {
    await removeCommandRoleAsync(interaction.guild.id, commandName, role.id)

    await interaction.reply({
      content: `✅ Role ${role} has been removed from the \`/${commandName}\` command.`,
      ephemeral: true,
    })

    logger.info(
      {
        guildId: interaction.guild.id,
        commandName,
        roleId: role.id,
        success: true,
      },
      'Command role permission removed successfully'
    )
  } catch (error) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        guildId: interaction.guild.id,
        commandName,
        roleId: role.id,
      },
      'Error removing command role permission'
    )
    await interaction.reply({
      content: '❌ An error occurred while removing the permission.',
      ephemeral: true,
    })
  }
}
