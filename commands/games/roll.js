/**
 * @fileoverview Roll command - roll dice of various types
 * Supports d4, d6, d8, d10, d12, d20, and d100 dice with optional quantity
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../logger')

// Dice type choices for the command
const DICE_CHOICES = [
  { name: '🎲 d4 (4-sided)', value: 'd4' },
  { name: '🎲 d6 (6-sided)', value: 'd6' },
  { name: '🎲 d8 (8-sided)', value: 'd8' },
  { name: '🎲 d10 (10-sided)', value: 'd10' },
  { name: '🎲 d12 (12-sided)', value: 'd12' },
  { name: '🎲 d20 (20-sided)', value: 'd20' },
  { name: '🎲 d100 (100-sided)', value: 'd100' },
]

// Map dice type to number of sides
const DICE_SIDES = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
}

/**
 * Roll a single die with the specified number of sides
 * @param {number} sides - Number of sides on the die
 * @returns {number} Random number between 1 and sides (inclusive)
 */
function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1
}

/**
 * Roll command module
 * @type {import('discord.js').Command}
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('🎲 Roll dice of various types')
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
      InteractionContextType.BotDM,
    ])
    .addStringOption((option) =>
      option
        .setName('size')
        .setDescription('Type of dice to roll (default: d6)')
        .setRequired(false)
        .addChoices(...DICE_CHOICES)
    )
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('Number of dice to roll (default: 1)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    ),

  /**
   * Executes the roll command
   * @async
   * @param {import('discord.js').CommandInteraction} interaction - The command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      const diceType = interaction.options.getString('size') || 'd6'
      const diceCount = interaction.options.getInteger('count') || 1
      const sides = DICE_SIDES[diceType]

      logger.info(
        {
          requestedBy: interaction.user.id,
          requestedByName: interaction.user.username,
          diceType,
          diceCount,
          guildId: interaction.guildId || 'DM',
        },
        `${interaction.user.username} rolled ${diceCount}${diceType}`
      )

      // Roll the dice
      const rolls = []
      for (let i = 0; i < diceCount; i++) {
        rolls.push(rollDie(sides))
      }

      const total = rolls.reduce((sum, roll) => sum + roll, 0)
      const minPossible = diceCount
      const maxPossible = diceCount * sides

      // Create embed for the result
      const embed = new EmbedBuilder()
        .setTitle(`🎲 Dice Roll: ${diceCount}${diceType}`)
        .setColor(0xff6b35)
        .setTimestamp()
        .setFooter({ text: `Rolled by ${interaction.user.username}` })

      // Add individual rolls if multiple dice
      if (diceCount > 1) {
        const rollsDisplay = rolls.map((roll, index) => `Die ${index + 1}: **${roll}**`).join('\n')
        embed.addFields(
          { name: '🎯 Individual Rolls', value: rollsDisplay, inline: false },
          { name: '📊 Total', value: `**${total}**`, inline: true },
          { name: '📉 Range', value: `${minPossible} - ${maxPossible}`, inline: true }
        )
      } else {
        // Single die roll - simpler display
        embed.setDescription(`You rolled: **${total}**`)
        embed.addFields({ name: '📉 Possible Range', value: `1 - ${maxPossible}`, inline: true })
      }

      await interaction.reply({ embeds: [embed] })

      logger.info(
        {
          userId: interaction.user.id,
          diceType,
          diceCount,
          rolls,
          total,
        },
        'Dice roll completed'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          userId: interaction.user.id,
          guildId: interaction.guildId || 'DM',
        },
        'Roll command error'
      )

      const errorContent = {
        content: '❌ An error occurred while rolling dice. Please try again.',
        flags: MessageFlags.Ephemeral,
      }

      // Safely handle interaction response based on state
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorContent)
        } else {
          await interaction.reply(errorContent)
        }
      } catch (replyError) {
        logger.error(
          {
            error: replyError.message,
            userId: interaction.user.id,
          },
          'Failed to send error message to user'
        )
      }
    }
  },
}
