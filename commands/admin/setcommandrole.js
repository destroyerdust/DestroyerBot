const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js')
const { setCommandRole } = require('../../utils/guildSettings')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcommandrole')
    .setDescription('Set which role can use a specific command')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('command')
        .setDescription('The command name (e.g., ping, kick, ban)')
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName('role')
        .setDescription('The role that should have access to this command')
        .setRequired(true)
    ),
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
  },
}
