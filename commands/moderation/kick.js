const { SlashCommandBuilder, MessageFlags, InteractionContextType } = require('discord.js')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Select a member and kick them (but not really).')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option.setName('target').setDescription('The member to kick').setRequired(true)
    ),
  async execute(interaction) {
    const member = interaction.options.getMember('target')

    // Handle case where member is not found (e.g., user left the server)
    if (!member) {
      return interaction.reply({
        content: 'The specified user is not a member of this server.',
        flags: MessageFlags.Ephemeral,
      })
    }

    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
        targetUser: member.user.id,
        targetUserName: member.user.username,
        isKick: false,
      },
      `${interaction.user.username} (#${interaction.user.id}) attempted to kick ${member.user.username} (#${member.user.id})`
    )

    return interaction.reply({
      content: `You wanted to kick: ${member.user.username}`,
      flags: MessageFlags.Ephemeral,
    })
  },
}
