const { MessageFlags, Events } = require('discord.js')
const logger = require('../logger')
const { hasCommandPermissionAsync } = require('../utils/guildSettings')

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {
    const client = interaction.client

    // Handle autocomplete interactions
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName)
      if (!command || !command.autocomplete) return

      try {
        await command.autocomplete(interaction)
      } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Autocomplete error')
      }
      return
    }

    if (!interaction.isChatInputCommand()) return

    const command = client.commands.get(interaction.commandName)

    if (!command) return

    // Check permissions for guild commands (skip for DMs)
    if (interaction.guild && interaction.member) {
      try {
        const hasPermission = await hasCommandPermissionAsync(
          interaction.guild.id,
          interaction.commandName,
          interaction.member
        )

        if (!hasPermission) {
          logger.warn(
            {
              guildId: interaction.guild.id,
              userId: interaction.user.id,
              username: interaction.user.tag,
              commandName: interaction.commandName,
            },
            'User blocked from using command due to permissions'
          )
          return interaction.reply({
            content: "⛔ You don't have permission to use this command.",
            flags: MessageFlags.Ephemeral,
          })
        }
      } catch (error) {
        logger.error(
          { error: error.message, guildId: interaction.guild.id },
          'Error checking command permissions'
        )
        return interaction.reply({
          content: 'There was an error checking permissions. Please try again.',
          flags: MessageFlags.Ephemeral,
        })
      }
    }

    try {
      await command.execute(interaction)
    } catch (error) {
      logger.error(error)
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        })
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        })
      }
    }
  },
}
