/**
 * @fileoverview Ping command - responds with latency information
 * Simple utility command to test bot responsiveness
 */

const { SlashCommandBuilder, InteractionContextType } = require('discord.js')

/**
 * Ping command - tests bot responsiveness and latency
 * @type {import('discord.js').Command}
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .setContexts(InteractionContextType.Guild | InteractionContextType.BotDM),
  /**
   * Executes the ping command
   * @async
   * @param {import('discord.js').CommandInteraction} interaction - The command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    await interaction.reply('Pong!')
  },
}
