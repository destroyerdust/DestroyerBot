/**
 * Help Command
 * Displays comprehensive information about all available bot commands
 * Dynamically generates help content based on registered commands
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  InteractionContextType,
} = require('discord.js')
const logger = require('../../logger')

/**
 * Command category mappings with emojis and descriptions
 * @type {Object.<string, {emoji: string, description: string}>}
 */
const CATEGORY_INFO = {
  Utility: {
    emoji: '🛠️',
    description: 'General utility commands for information and bot management',
  },
  Moderation: {
    emoji: '🛡️',
    description: 'Server moderation and administrative tools',
  },
  Weather: {
    emoji: '🌤️',
    description: 'Weather information and forecasts',
  },
  Games: {
    emoji: '🎮',
    description: 'Gaming-related commands and utilities',
  },
  Hardware: {
    emoji: '⚙️',
    description: 'Hardware monitoring and control commands',
  },
  Pokemon: {
    emoji: '🐾',
    description: 'Pokemon-related information and tools',
  },
  Admin: {
    emoji: '👑',
    description: 'Administrative commands (restricted access)',
  },
  Other: {
    emoji: '📋',
    description: 'Miscellaneous commands',
  },
}

/**
 * Help command definition and handler
 * @type {Object}
 */
module.exports = {
  /**
   * Command data for Discord.js slash command registration
   * Uses modern SlashCommandBuilder API with context restrictions
   */
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display comprehensive information about all available bot commands')
    .setContexts([InteractionContextType.Guild, InteractionContextType.PrivateChannel]), // Modern context array syntax (Discord.js v14+)

  /**
   * Execute the help command
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    // Input validation - ensure interaction is valid
    if (!interaction || !interaction.isChatInputCommand()) {
      logger.error('Invalid interaction received in help command')
      return
    }

    const client = interaction.client

    // Log the help request
    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
        guildId: interaction.guild?.id,
        channelId: interaction.channel?.id,
      },
      `Help command requested by ${interaction.user.username}`
    )

    try {
      // Comprehensive command categorization
      const commandCategories = {
        // Utility commands
        ping: 'Utility',
        'server-info': 'Utility',
        'user-info': 'Utility',
        'bot-stats': 'Utility',
        stats: 'Utility',
        health: 'Utility',
        errors: 'Utility',
        guildstats: 'Utility',
        clean: 'Utility',
        help: 'Utility',

        // Moderation commands
        kick: 'Moderation',

        // Weather commands
        weather: 'Weather',

        // Game commands
        rio: 'Games',

        // Hardware commands
        '3d-print-status': 'Hardware',

        // Pokemon commands
        pokemon: 'Pokemon',
        test: 'Pokemon',

        // Admin commands
        listpermissions: 'Admin',
        logsettings: 'Admin',
        removecommandrole: 'Admin',
        resetpermissions: 'Admin',
        setcommandrole: 'Admin',
        setlogchannel: 'Admin',
      }

      // Group commands by category with dynamic discovery
      const categories = {}
      let totalCommands = 0

      // Process registered commands
      client.commands.forEach((command, name) => {
        totalCommands++
        const category = commandCategories[name] || 'Other'

        if (!categories[category]) {
          categories[category] = []
        }

        // Format command with description
        const description = command.data.description || 'No description available'
        categories[category].push(`\`/${name}\`: ${description}`)
      })

      // Build help embed with modern EmbedBuilder API
      const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Commands & Features')
        .setDescription(
          'Here are all available slash commands organized by category. Use `/command-name` to execute any command.'
        )
        .setColor(0x5865f2) // Discord blurple
        .setFooter({
          text: `Total commands: ${totalCommands} • Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({
            dynamic: true,
            size: 16,
            extension: 'png',
          }),
        })
        .setTimestamp()

      // Sort categories for consistent display order
      const categoryOrder = [
        'Utility',
        'Moderation',
        'Weather',
        'Games',
        'Hardware',
        'Pokemon',
        'Admin',
        'Other',
      ]

      // Add each category as a field
      categoryOrder.forEach((categoryName) => {
        const commands = categories[categoryName]
        if (commands && commands.length > 0) {
          const categoryInfo = CATEGORY_INFO[categoryName] || CATEGORY_INFO.Other
          const commandList = commands.join('\n')

          // Split long command lists into multiple fields if needed
          if (commandList.length > 1024) {
            // Split into chunks of approximately 900 characters to leave room for formatting
            const chunks = []
            let currentChunk = ''

            commands.forEach((cmd) => {
              if ((currentChunk + '\n' + cmd).length > 900) {
                if (currentChunk) chunks.push(currentChunk)
                currentChunk = cmd
              } else {
                currentChunk += (currentChunk ? '\n' : '') + cmd
              }
            })

            if (currentChunk) chunks.push(currentChunk)

            // Add each chunk as a separate field
            chunks.forEach((chunk, index) => {
              const fieldName =
                index === 0
                  ? `${categoryInfo.emoji} ${categoryName} (${commands.length})`
                  : `${categoryInfo.emoji} ${categoryName} (continued)`

              embed.addFields({
                name: fieldName,
                value: chunk,
                inline: false,
              })
            })
          } else {
            embed.addFields({
              name: `${categoryInfo.emoji} ${categoryName} (${commands.length})`,
              value: commandList,
              inline: false,
            })
          }
        }
      })

      // Add usage tips
      embed.addFields({
        name: '💡 Usage Tips',
        value: [
          '• **Slash Commands**: Start with `/` and select from the autocomplete menu',
          '• **Permissions**: Some commands require specific roles or server ownership',
          '• **Context**: Commands work in both servers and direct messages (where applicable)',
          '• **Help**: Each command shows its own help when you start typing it',
        ].join('\n'),
        inline: false,
      })

      // Send the help embed
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral, // Modern ephemeral syntax (Discord.js v14+)
      })

      logger.info(
        {
          requestedBy: interaction.user.username,
          totalCommands,
          categoriesCount: Object.keys(categories).length,
          embedSent: true,
          ephemeral: true,
        },
        'Help information sent successfully'
      )
    } catch (error) {
      // Enhanced error handling with structured logging
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          userId: interaction.user?.id,
          guildId: interaction.guild?.id,
          timestamp: new Date().toISOString(),
        },
        'Help command failed'
      )

      // Provide user-friendly error response
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Help Unavailable')
        .setColor(0xff0000)
        .setDescription('Unable to load command information at this time.')
        .addFields({
          name: '🔍 Try Again',
          value: 'Please try the help command again in a few moments.',
          inline: false,
        })
        .setTimestamp()
        .setFooter({ text: 'Help system' })

      try {
        await interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        })
      } catch (replyError) {
        logger.error('Failed to send error response:', replyError)
      }
    }
  },
}
