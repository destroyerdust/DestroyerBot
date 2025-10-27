const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js')
const { hasCommandPermission } = require('../../utils/guildSettings')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clean')
    .setDescription('Delete bot messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('Number of bot messages to delete (default: 10, max: 100)')
        .setMinValue(1)
        .setMaxValue(100)
    ),
  async execute(interaction) {
    // Check bot permissions
    if (!interaction.guild.members.me.permissionsIn(interaction.channel).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: '❌ I need `Manage Messages` permission to delete messages in this channel.',
        flags: MessageFlags.Ephemeral,
      })
    }

    // Check user permissions using role system
    const hasPermission = hasCommandPermission(
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
        'User blocked from using command due to role restrictions'
      )
      return interaction.reply({
        content: "⛔ You don't have permission to use this command.",
        flags: MessageFlags.Ephemeral,
      })
    }

    const count = interaction.options.getInteger('count') || 10

    try {
      // Defer reply since this might take time
      await interaction.deferReply({ flags: MessageFlags.Ephemeral })

      // Fetch messages from the channel (limit to recent messages for performance)
      const messages = await interaction.channel.messages.fetch({ limit: 100 })

      // Filter to only bot messages
      const botMessages = messages.filter(msg => msg.author.id === interaction.guild.members.me.id)

      // Take the specified number
      const messagesToDelete = botMessages.first(count)

      if (messagesToDelete.length === 0) {
        return interaction.editReply('❌ No bot messages found in recent history to delete.')
      }

      // Bulk delete if possible (Discord allows bulk delete for messages less than 2 weeks old)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
      const recentMessages = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo)
      const oldMessages = messagesToDelete.filter(msg => msg.createdTimestamp <= twoWeeksAgo)

      let deletedCount = 0

      if (recentMessages.length > 1) {
        // Use bulk delete for recent messages
        try {
          await interaction.channel.bulkDelete(recentMessages)
          deletedCount += recentMessages.length
          logger.info(
            {
              guildId: interaction.guild.id,
              channelId: interaction.channel.id,
              deletedCount: recentMessages.length,
              executedBy: interaction.user.id,
            },
            'Bulk deleted recent bot messages'
          )
        } catch (bulkError) {
          logger.warn(
            { error: bulkError.message },
            'Bulk delete failed, falling back to individual deletes'
          )
        }
      }

      // Delete old messages individually (can't bulk delete messages older than 2 weeks)
      for (const message of oldMessages) {
        try {
          await message.delete()
          deletedCount++
          logger.info(
            {
              guildId: interaction.guild.id,
              channelId: interaction.channel.id,
              messageId: message.id,
              executedBy: interaction.user.id,
            },
            'Deleted old bot message individually'
          )
        } catch (deleteError) {
          logger.warn(
            { error: deleteError.message, messageId: message.id },
            'Failed to delete old message'
          )
        }
      }

      // Delete remaining recent messages individually (if bulk failed or single message)
      const remainingRecent = recentMessages.filter(msg => !msg.deleted)
      for (const message of remainingRecent) {
        try {
          await message.delete()
          deletedCount++
        } catch (deleteError) {
          logger.warn(
            { error: deleteError.message, messageId: message.id },
            'Failed to delete recent message'
          )
        }
      }

      // Send confirmation
      if (deletedCount === 0) {
        return interaction.editReply('❌ Failed to delete any messages.')
      }

      const responseMessage = `✅ Deleted ${deletedCount} bot message${deletedCount === 1 ? '' : 's'} in this channel.`

      logger.info(
        {
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
          deletedCount: deletedCount,
          requestedCount: count,
          executedBy: interaction.user.id,
          username: interaction.user.username,
        },
        'Clean command completed successfully'
      )

      await interaction.editReply(responseMessage)

    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
          executedBy: interaction.user.id,
        },
        'Error executing clean command'
      )

      await interaction.editReply({
        content: '❌ An error occurred while attempting to clean messages.',
      })
    }
  },
}
