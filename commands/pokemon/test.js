const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../logger')
const TCGDex = require('@tcgdex/sdk').default
const { Query } = require('@tcgdex/sdk')

// Using TCGDex SDK instead of direct API calls
const sdk = new TCGDex('en')

// This is a test clone for trying different APIs

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Testing command for different API experiments')
    .setContexts(InteractionContextType.Guild | InteractionContextType.BotDM)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('Search for something')
        .addStringOption((option) =>
          option.setName('query').setDescription('Search query').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('random').setDescription('Get something random')
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const user = interaction.user

    logger.info(
      {
        requestedBy: user.id,
        requestedByName: user.username,
        subcommand,
      },
      `${user.username} requested test ${subcommand}`
    )

    await interaction.deferReply()

    try {
      let item

      if (subcommand === 'search') {
        const query = interaction.options.getString('query')
        logger.debug(
          {
            query,
            user: user.id,
          },
          'Starting card search'
        )
        // const results = await sdk.card.where({ name: query })
        const results = await sdk.card.list(new Query().equal('name', query))
        logger.debug(
          {
            query,
            resultsCount: results?.length || 0,
            user: user.id,
          },
          'Card search completed'
        )
        if (!results || results.length === 0) {
          logger.info(
            {
              subcommand,
              query,
              user: user.id,
            },
            'No results found'
          )
          return interaction.editReply({
            content: `No Pokemon card found for "${query}". Please try a different search term.`,
            flags: MessageFlags.Ephemeral,
          })
        }
        item = await sdk.card.get(results[0].id)
        logger.debug(
          {
            selectedCardId: item.id,
            selectedCardName: item.name,
            totalResults: results.length,
          },
          'Selected first card from search results'
        )
      } else if (subcommand === 'random') {
        // Get a random card
        item = await sdk.random.card()
        if (!item) {
          return interaction.editReply({
            content: 'Could not retrieve a random card.',
            flags: MessageFlags.Ephemeral,
          })
        }
      }

      const imageUrl = `${item.image}/high.webp`

      logger.debug(
        {
          itemId: item.id,
          itemName: item.name,
          subcommand,
          setId: item.set?.id,
          localId: item.localId,
          imageUrl,
          variants: item.variants,
          pricing: item.pricing,
        },
        'Data found'
      )

      const embed = new EmbedBuilder()
        .setTitle(item.name)
        .setDescription(item.set?.name ? `Set: ${item.set.name}` : 'Test result')
        .setColor(0x00ff00)

      embed.setImage(imageUrl)

      // Add TCGPlayer pricing if available
      if (item.pricing?.tcgplayer) {
        const tcgplayer = item.pricing.tcgplayer
        Object.entries(tcgplayer).forEach(([variant, prices]) => {
          if (variant !== 'updated' && variant !== 'unit' && prices?.marketPrice) {
            embed.addFields({
              name: `${variant.charAt(0).toUpperCase() + variant.slice(1)} Market Price`,
              value: `\$${prices.marketPrice.toFixed(2)}`,
              inline: true,
            })
          }
        })
      }

      embed.setFooter({
        text: `ID: ${item.id} • Requested by ${user.username}`,
      })

      await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral })

      logger.info(
        {
          itemName: item.name,
          itemId: item.id,
          user: user.username,
          embedSent: true,
          ephemeral: true,
        },
        'Test embed sent'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          subcommand,
          query: interaction.options.getString('query') || 'random',
          user: user.id,
        },
        'Test command error'
      )
      await interaction.editReply({
        content: 'An error occurred while fetching data. Please try again later.',
        ephemeral: true,
      })
    }
  },
}
