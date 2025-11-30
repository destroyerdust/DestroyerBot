const {
  SlashCommandBuilder,
  MessageFlags,
  InteractionContextType,
  ApplicationIntegrationType,
  PermissionFlagsBits,
} = require('discord.js')
const logger = require('../../logger')
const { hasCommandPermissionAsync } = require('../../utils/guildSettings')

/**
 * Set Nickname Moderation Command
 * Allows authorized users to set nicknames for guild members
 */

/**
 * Set nickname command module
 * @type {import('discord.js').Command}
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setnick')
    .setDescription("Set a member's nickname in this server")
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .setContexts([InteractionContextType.Guild])
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption((option) =>
      option.setName('user').setDescription('The member to change nickname for').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('nickname')
        .setDescription('The new nickname (leave empty to reset)')
        .setRequired(false)
        .setMaxLength(32)
    ),

  /**
   * Executes the setnick command
   * @async
   * @param {import('discord.js').CommandInteraction} interaction - The command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    // Defer immediately for potentially slow operations
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const guild = interaction.guild
    const targetUser = interaction.options.getUser('user')
    const newNickname = interaction.options.getString('nickname')

    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
        targetUser: targetUser.id,
        targetUserName: targetUser.username,
        newNickname: newNickname,
        guildId: guild.id,
        guildName: guild.name,
      },
      `${interaction.user.username} (#${interaction.user.id}) attempting to set nickname for ${targetUser.username} (#${targetUser.id})`
    )

    try {
      // Validate guild context
      if (!guild) {
        return interaction.editReply({
          content: '❌ This command can only be used in a server.',
        })
      }

      // Get the member object
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null)
      if (!targetMember) {
        return interaction.editReply({
          content: '❌ The specified user is not a member of this server.',
        })
      }

      // Check bot permissions
      const botMember = guild.members.me
      if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return interaction.editReply({
          content: "❌ I don't have permission to manage nicknames in this server.",
        })
      }

      // Check user permissions using the guild settings system
      const commandMember = interaction.member
      const hasPermission = await hasCommandPermissionAsync(guild.id, 'setnick', commandMember)
      if (!hasPermission) {
        return interaction.editReply({
          content:
            "❌ You don't have permission to use this command. Only the server owner or authorized roles can use it.",
        })
      }

      // Prevent setting nickname for server owner
      if (targetMember.id === guild.ownerId) {
        return interaction.editReply({
          content: "❌ You cannot change the server owner's nickname.",
        })
      }

      // Prevent setting nickname for self
      if (targetMember.id === interaction.user.id) {
        return interaction.editReply({
          content: '❌ You cannot change your own nickname using this command.',
        })
      }

      // Prevent setting nickname for bot itself
      if (targetMember.id === botMember.id) {
        return interaction.editReply({
          content: '❌ I cannot change my own nickname.',
        })
      }

      // Check role hierarchy
      if (targetMember.roles.highest.position >= commandMember.roles.highest.position) {
        return interaction.editReply({
          content: '❌ You cannot change the nickname of someone with a higher or equal role.',
        })
      }

      // Check if bot can modify this user
      if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
        return interaction.editReply({
          content:
            '❌ I cannot change the nickname of someone with a higher or equal role than me.',
        })
      }

      // Store old nickname for logging
      const oldNickname = targetMember.nickname || targetMember.user.username

      // Set the nickname (null or empty string will reset it)
      await targetMember.setNickname(newNickname || null)

      // Success response
      const successMessage = newNickname
        ? `✅ Changed ${targetMember.user.username}'s nickname from "${oldNickname}" to "${newNickname}"`
        : `✅ Reset ${targetMember.user.username}'s nickname (was "${oldNickname}")`

      await interaction.editReply({
        content: successMessage,
      })

      logger.info(
        {
          moderator: interaction.user.id,
          moderatorName: interaction.user.username,
          targetUser: targetMember.id,
          targetUserName: targetMember.user.username,
          oldNickname,
          newNickname: newNickname || null,
          guildId: guild.id,
          guildName: guild.name,
          timestamp: new Date().toISOString(),
        },
        `Nickname successfully changed: "${oldNickname}" -> "${newNickname || 'reset'}"`
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          userId: interaction.user?.id,
          guildId: interaction.guild?.id,
          targetUserId: targetUser?.id,
          newNickname,
          timestamp: new Date().toISOString(),
        },
        'Setnick command failed'
      )

      // Provide user-friendly error response
      let errorMessage = '❌ Failed to change nickname. Please try again.'

      if (error.code === 50013) {
        errorMessage = "❌ I don't have permission to manage nicknames."
      } else if (error.code === 50035) {
        errorMessage = '❌ Invalid nickname. Please check the length and content.'
      }

      try {
        await interaction.editReply({
          content: errorMessage,
        })
      } catch (replyError) {
        logger.error({ error: replyError.message }, 'Failed to send error response')
      }
    }
  },
}
