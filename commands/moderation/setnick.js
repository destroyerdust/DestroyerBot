const {
  SlashCommandBuilder,
  MessageFlags,
  InteractionContextType,
  PermissionFlagsBits,
} = require('discord.js')
const logger = require('../../logger')

/**
 * Set Nickname Moderation Command
 * Allows authorized users to set nicknames for guild members
 */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setnick')
    .setDescription('Set a member\'s nickname in this server')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option.setName('user').setDescription('The member to change nickname for').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('nickname')
        .setDescription('The new nickname (leave empty to reset)')
        .setRequired(true)
        .setMaxLength(32)
        .setMinLength(1)
    ),

  async execute(interaction) {
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
        return interaction.reply({
          content: '❌ This command can only be used in a server.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Get the member object
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null)
      if (!targetMember) {
        return interaction.reply({
          content: '❌ The specified user is not a member of this server.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Check bot permissions
      const botMember = guild.members.me
      if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return interaction.reply({
          content: '❌ I don\'t have permission to manage nicknames in this server.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Check user permissions
      const commandMember = interaction.member
      if (!commandMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return interaction.reply({
          content: '❌ You don\'t have permission to manage nicknames.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Prevent setting nickname for server owner
      if (targetMember.id === guild.ownerId) {
        return interaction.reply({
          content: '❌ You cannot change the server owner\'s nickname.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Prevent setting nickname for self
      if (targetMember.id === interaction.user.id) {
        return interaction.reply({
          content: '❌ You cannot change your own nickname using this command.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Prevent setting nickname for bot itself
      if (targetMember.id === botMember.id) {
        return interaction.reply({
          content: '❌ I cannot change my own nickname.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Check role hierarchy
      if (targetMember.roles.highest.position >= commandMember.roles.highest.position) {
        return interaction.reply({
          content: '❌ You cannot change the nickname of someone with a higher or equal role.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Check if bot can modify this user
      if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: '❌ I cannot change the nickname of someone with a higher or equal role than me.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Validate nickname
      if (newNickname && newNickname.length > 32) {
        return interaction.reply({
          content: '❌ Nickname must be 32 characters or less.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Store old nickname for logging
      const oldNickname = targetMember.nickname || targetMember.user.username

      // Set the nickname
      await targetMember.setNickname(newNickname)

      // Success response
      const successMessage = newNickname
        ? `✅ Changed ${targetMember.user.username}'s nickname from "${oldNickname}" to "${newNickname}"`
        : `✅ Reset ${targetMember.user.username}'s nickname (was "${oldNickname}")`

      await interaction.reply({
        content: successMessage,
        flags: MessageFlags.Ephemeral,
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
        errorMessage = '❌ I don\'t have permission to manage nicknames.'
      } else if (error.code === 50035) {
        errorMessage = '❌ Invalid nickname. Please check the length and content.'
      }

      try {
        await interaction.reply({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        })
      } catch (replyError) {
        logger.error('Failed to send error response:', replyError)
      }
    }
  },
}
