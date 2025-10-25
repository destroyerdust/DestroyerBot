const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags } = require('discord.js')
const logger = require('../../logger')
const { pokemonApiKey } = require('../../config.json')

// This is a test file for testing different APIs

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokemon')
    .setDescription('Pokemon TCG card information')
    .setContexts(InteractionContextType.Guild | InteractionContextType.BotDM | InteractionContextType.DM)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('Search for a Pokemon card by name')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('Card name or partial match (e.g., "charizard")')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('random').setDescription('Get a random Pokemon card')
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
      `${user.username} requested pokemon ${subcommand}`
    )

    await interaction.deferReply()

    try {
      let apiUrl
      let searchQuery = ''

      if (subcommand === 'search') {
        const query = interaction.options.getString('query')
        searchQuery = query
        apiUrl = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(
          query
        )}*"&order=name&pageSize=1`
      } else if (subcommand === 'random') {
        // Note: API doesn't have true random, using a random page approach
        const randomPage = Math.floor(Math.random() * 500) + 1 // Approximate total pages
        apiUrl = `https://api.pokemontcg.io/v2/cards?page=${randomPage}&pageSize=1&order=name`
      }

      const response = await fetch(apiUrl, {
        headers: {
          'X-Api-Key': pokemonApiKey,
        },
      })

      if (!response.ok) {
        logger.warn(
          {
            status: response.status,
            statusText: response.statusText,
            apiUrl,
            subcommand,
            query: searchQuery,
          },
          `Pokemon TCG API error: ${response.status} ${response.statusText}`
        )

        if (response.status === 401 || response.status === 403) {
          return interaction.editReply({
            content: 'Pokemon TCG API key is invalid or missing from config.json.',
            flags: MessageFlags.Ephemeral,
          })
        }

        return interaction.editReply({
          content: `Could not fetch Pokemon card data (${response.status}). Please try again later.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      const data = await response.json()

      if (!data.data || data.data.length === 0) {
        logger.info(
          {
            subcommand,
            query: searchQuery,
            user: user.id,
          },
          'No Pokemon card found'
        )
        return interaction.editReply({
          content: `No Pokemon card found for "${searchQuery}". Please try a different search term.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      const card = data.data[0]

      logger.debug(
        {
          cardId: card.id,
          cardName: card.name,
          setName: card.set?.name,
          subcommand,
          query: searchQuery,
        },
        'Pokemon card data found'
      )

      const embed = new EmbedBuilder()
        .setTitle(`${card.name}${card.supertype === 'Pokémon' ? ` (HP: ${card.hp || 'N/A'})` : ''}`)
        .setDescription(card.flavorText || 'No flavor text available.')
        .setColor(
          card.types && card.types.length > 0 ? getTypeColor(card.types[0]) : 0x00ff00
        )
        .addFields(
          {
            name: 'Set',
            value: `${card.set?.name || 'Unknown'} (${card.set?.releaseDate ? new Date(card.set.releaseDate).getFullYear() : 'N/A'})`,
            inline: true,
          },
          {
            name: 'Rarity',
            value: card.rarity || 'N/A',
            inline: true,
          },
          {
            name: 'Card Type',
            value: card.supertype || 'Unknown',
            inline: true,
          }
        )

      if (card.types && card.types.length > 0) {
        embed.addFields({
          name: 'Types',
          value: card.types.join(', '),
          inline: true,
        })
      }

      if (card.evolvesFrom) {
        embed.addFields({
          name: 'Evolves From',
          value: card.evolvesFrom,
          inline: true,
        })
      }

      if (card.cardmarket && card.cardmarket.prices && card.cardmarket.prices.averageSellPrice) {
        embed.addFields({
          name: 'Market Price (EUR)',
          value: `€${card.cardmarket.prices.averageSellPrice.toFixed(2)}`,
          inline: true,
        })
      }

      if (card.images?.large) {
        embed.setImage(card.images.large)
      }

      embed.setFooter({
        text: `Card ID: ${card.id} • Requested by ${user.username}`,
      })

      await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral })

      logger.info(
        {
          cardName: card.name,
          cardId: card.id,
          user: user.username,
          embedSent: true,
          ephemeral: true,
        },
        'Pokemon card embed sent'
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
        'Pokemon command error'
      )
      await interaction.editReply({
        content: 'An error occurred while fetching Pokemon card data. Please try again later.',
        ephemeral: true,
      })
    }
  },
}

// Helper function to get color based on Pokemon type
function getTypeColor(type) {
  const colors = {
    Grass: 0x78c850,
    Fire: 0xf08030,
    Water: 0x6890f0,
    Lightning: 0xf8d030,
    Psychic: 0xf85888,
    Fighting: 0xc03028,
    Darkness: 0x705848,
    Metal: 0xb8b8d0,
    Fairy: 0xfeeae9,
    Dragon: 0x7038f8,
    Colorless: 0xa8a878,
  }
  return colors[type] || 0x68a090
}
