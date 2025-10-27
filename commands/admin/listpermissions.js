const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  InteractionContextType,
} = require('discord.js')
const { getGuildSettings } = require('../../utils/guildSettings')
const logger = require('../../logger')

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
      const guildSettings = getGuildSettings(interaction.guild.id)
      const permissions = guildSettings.commandPermissions

      const embed = new EmbedBuilder()
        .setTitle('📋 Command Permissions')
        .setDescription('Role restrictions for commands in this server')
        .setColor(0x5865f2)
        .setTimestamp()

      if (Object.keys(permissions).length === 0) {
        embed.setDescription('No command permissions have been configured yet.')
      } else {
        for (const [commandName, roleIds] of Object.entries(permissions)) {
          if (roleIds.length === 0) {
            embed.addFields({
              name: `/${commandName}`,
              value: '✅ Everyone can use this command',
              inline: false,
            })
          } else {
            const rolesMentions = roleIds
              .map((roleId) => {
                const role = interaction.guild.roles.cache.get(roleId)
                return role ? `<@&${roleId}>` : `Unknown Role (${roleId})`
              })
              .join(', ')
            embed.addFields({
              name: `/${commandName}`,
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
