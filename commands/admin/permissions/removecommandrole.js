const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js')
const { removeCommandRole } = require('../../../utils/guildSettings')
const logger = require('../../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removecommandrole')
    .setDescription('Remove a role from a specific command')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
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
    ),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase()

    // Get all command names from the bot, excluding admin commands
    const commands = interaction.client.commands
    const adminCommands = [
      'setcommandrole',
      'removecommandrole',
      'listpermissions',
      'resetpermissions',
    ]
    const commandNames = Array.from(commands.keys()).filter((name) => !adminCommands.includes(name))

    // Filter commands based on user input
    const filtered = commandNames
      .filter((name) => name.toLowerCase().includes(focusedValue))
      .slice(0, 25) // Discord limits to 25 choices
      .map((name) => ({ name: name, value: name }))

    await interaction.respond(filtered)
  },
  async execute(interaction) {
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
      removeCommandRole(interaction.guild.id, commandName, role.id)

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
  },
}
