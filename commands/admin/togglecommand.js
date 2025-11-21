const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js')
const {
  disableCommandAsync,
  enableCommandAsync,
  isCommandDisabledAsync,
  getGuildSettingsAsync,
} = require('../../utils/guildSettings')
const logger = require('../../logger')

// Commands that cannot be disabled (admin commands)
const PROTECTED_COMMANDS = new Set([
  'togglecommand',
  'setcommandrole',
  'removecommandrole',
  'listpermissions',
  'resetpermissions',
  'log',
  'welcome',
])

module.exports = {
  data: new SlashCommandBuilder()
    .setName('togglecommand')
    .setDescription('Enable or disable commands for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('enable')
        .setDescription('Enable a command for this server')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('Select a command to enable')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('disable')
        .setDescription('Disable a command for this server')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('Select a command to disable')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Check the status of a command')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('Select a command to check')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase()

    // Get all command names from the bot, excluding protected admin commands
    const commands = interaction.client.commands
    const commandNames = Array.from(commands.keys()).filter((name) => !PROTECTED_COMMANDS.has(name))

    // Filter commands based on user input
    const filtered = commandNames
      .filter((name) => name.toLowerCase().includes(focusedValue))
      .slice(0, 25) // Discord limits to 25 choices
      .map((name) => ({ name: name, value: name }))

    await interaction.respond(filtered)
  },
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const commandName = interaction.options.getString('command')
    const guildId = interaction.guild.id

    logger.info(
      {
        guildId,
        subcommand,
        commandName,
        executedBy: interaction.user.tag,
      },
      'Toggling command status'
    )

    // Check if command exists
    if (!interaction.client.commands.has(commandName)) {
      return interaction.reply({
        content: `❌ Command \`/${commandName}\` does not exist.`,
        ephemeral: true,
      })
    }

    // Check if command is protected
    if (PROTECTED_COMMANDS.has(commandName)) {
      return interaction.reply({
        content: `❌ Command \`/${commandName}\` cannot be disabled as it is a protected admin command.`,
        ephemeral: true,
      })
    }

    try {
      if (subcommand === 'enable') {
        await enableCommandAsync(guildId, commandName)
        await interaction.reply({
          content: `✅ Command \`/${commandName}\` has been **enabled** for this server.`,
          ephemeral: true,
        })
        logger.info({ guildId, commandName }, 'Command enabled for guild')
      } else if (subcommand === 'disable') {
        await disableCommandAsync(guildId, commandName)
        await interaction.reply({
          content: `🚫 Command \`/${commandName}\` has been **disabled** for this server.\n\n*Note: Server owners and users with appropriate role permissions can still use admin commands.*`,
          ephemeral: true,
        })
        logger.info({ guildId, commandName }, 'Command disabled for guild')
      } else if (subcommand === 'status') {
        const isDisabled = await isCommandDisabledAsync(guildId, commandName)
        const status = isDisabled ? '🚫 Disabled' : '✅ Enabled'

        // Get current permissions info
        const guildSettings = await getGuildSettingsAsync(guildId)
        const permissions = guildSettings.commandPermissions[commandName] || []

        let permissionInfo = ''
        if (permissions.length > 0) {
          permissionInfo = `\n\n**Role Restrictions:** ${permissions.map((roleId) => `<@&${roleId}>`).join(', ')}`
        } else {
          permissionInfo = '\n\n**Role Restrictions:** Everyone can use this command'
        }

        await interaction.reply({
          content: `**Command:** \`/${commandName}\`\n**Status:** ${status}${permissionInfo}`,
          ephemeral: true,
        })
      }
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId,
          subcommand,
          commandName,
        },
        'Error toggling command status'
      )
      await interaction.reply({
        content: '❌ An error occurred while updating the command status.',
        ephemeral: true,
      })
    }
  },
}
