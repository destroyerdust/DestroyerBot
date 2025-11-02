const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js')
const {
  setLogMessageCreateAsync,
  getLogMessageCreateAsync,
  setLogMessageDeleteAsync,
  getLogMessageDeleteAsync,
} = require('../../utils/guildSettings')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logsettings')
    .setDescription('Enable or disable logging for message events')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommandGroup((group) =>
      group
        .setName('create')
        .setDescription('Settings for message creation logging')
        .addSubcommand((subcommand) =>
          subcommand.setName('enable').setDescription('Enable logging of new messages')
        )
        .addSubcommand((subcommand) =>
          subcommand.setName('disable').setDescription('Disable logging of new messages')
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('delete')
        .setDescription('Settings for message deletion logging')
        .addSubcommand((subcommand) =>
          subcommand.setName('enable').setDescription('Enable logging of deleted messages')
        )
        .addSubcommand((subcommand) =>
          subcommand.setName('disable').setDescription('Disable logging of deleted messages')
        )
    ),
  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup()
    const subcommand = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    logger.info(
      {
        guildId,
        subcommandGroup,
        subcommand,
        executedBy: interaction.user.tag,
      },
      'Updating log settings'
    )

    let enable = null
    let type = ''

    if (subcommandGroup === 'create') {
      type = 'message create'
      if (subcommand === 'enable') {
        enable = true
        await setLogMessageCreateAsync(guildId, true)
      } else if (subcommand === 'disable') {
        enable = false
        await setLogMessageCreateAsync(guildId, false)
      }
    } else if (subcommandGroup === 'delete') {
      type = 'message delete'
      if (subcommand === 'enable') {
        enable = true
        await setLogMessageDeleteAsync(guildId, true)
      } else if (subcommand === 'disable') {
        enable = false
        await setLogMessageDeleteAsync(guildId, false)
      }
    }

    const currentCreate = await getLogMessageCreateAsync(guildId)
    const currentDelete = await getLogMessageDeleteAsync(guildId)

    const statusText = `**Message Create Logging:** ${currentCreate ? '✅ Enabled' : '❌ Disabled'}\n**Message Delete Logging:** ${currentDelete ? '✅ Enabled' : '❌ Disabled'}`

    try {
      await interaction.reply({
        content: `✅ ${type} logging ${enable ? 'enabled' : 'disabled'}.\n\n${statusText}`,
        ephemeral: true,
      })

      logger.info(
        {
          guildId,
          subcommandGroup,
          subcommand,
          success: true,
        },
        'Log settings updated successfully'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId,
          subcommandGroup,
          subcommand,
        },
        'Error updating log settings'
      )
      await interaction.reply({
        content: '❌ An error occurred while updating the settings.',
        ephemeral: true,
      })
    }
  },
}
