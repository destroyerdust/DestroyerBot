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

// Cache for series data to speed up autocomplete
let seriesCache = null
let seriesCacheTime = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

// Pre-fetch series data to avoid timeout on first autocomplete request
let seriesCachePromise = null

const initializeSeriesCache = () => {
  if (seriesCachePromise) return seriesCachePromise

  seriesCachePromise = sdk
    .fetch('series')
    .then((series) => {
      seriesCache = series
      seriesCacheTime = Date.now()
      logger.debug({ cacheSize: seriesCache.length }, 'Series cache initialized')
      return seriesCache
    })
    .catch((error) => {
      logger.error({ error: error.message }, 'Failed to initialize series cache')
      seriesCache = []
      return []
    })

  return seriesCachePromise
}

const getSeriesCached = async () => {
  const now = Date.now()

  // If cache exists and is fresh, return it immediately
  if (seriesCache && now - seriesCacheTime < CACHE_DURATION) {
    return seriesCache
  }

  // If currently fetching, wait for that promise
  if (seriesCachePromise) {
    return await seriesCachePromise
  }

  // Otherwise start a new fetch
  return initializeSeriesCache()
}

// Initialize cache as soon as module loads (non-blocking background task)
initializeSeriesCache()

// Attempt to initialize cache with timeout - if it takes too long, try again on first request
let cacheInitialized = false
getSeriesCached()
  .then(() => {
    cacheInitialized = true
    logger.debug('Series cache ready for use')
  })
  .catch((error) => {
    logger.warn(
      { error: error.message },
      'Initial series cache load failed, will retry on first request'
    )
  })

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokemon')
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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('series')
        .setDescription('Get information about a TCGDex series')
        .addStringOption((option) =>
          option
            .setName('series')
            .setDescription('Select a series')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true)

    if (focusedOption.name === 'series') {
      try {
        logger.debug(
          {
            user: interaction.user.id,
            focusedValue: focusedOption.value,
          },
          'Starting series autocomplete'
        )

        // Use timeout to ensure response within Discord's 3-second limit
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error('Autocomplete timeout')), 2800) // Leave 200ms buffer
        )

        const allSeries = await Promise.race([getSeriesCached(), timeoutPromise])

        const filtered = allSeries
          .filter((series) => series.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
          .slice(0, 25) // Discord limits autocomplete to 25 choices

        const choices = filtered.map((series) => ({
          name: series.name,
          value: series.id,
        }))

        logger.debug(
          {
            filteredCount: choices.length,
            searchTerm: focusedOption.value,
          },
          'Series autocomplete filtered'
        )

        await interaction.respond(choices)
      } catch (error) {
        logger.error(
          {
            error: error.message,
            user: interaction.user.id,
          },
          'Series autocomplete error'
        )
        // Try to respond with empty array if possible, otherwise silently fail
        try {
          if (!interaction.responded) {
            await interaction.respond([])
          }
        } catch {
          // Interaction expired, nothing we can do
        }
      }
    }
  },
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
      } else if (subcommand === 'series') {
        const seriesId = interaction.options.getString('series')
        logger.debug(
          {
            seriesId,
            user: user.id,
          },
          'Starting series fetch'
        )

        const allSeries = await getSeriesCached()
        const series = allSeries.find((s) => s.id === seriesId)

        if (!series) {
          logger.info(
            {
              subcommand,
              seriesId,
              user: user.id,
            },
            'Series not found'
          )
          return interaction.editReply({
            content: `Series with ID "${seriesId}" not found.`,
            flags: MessageFlags.Ephemeral,
          })
        }

        logger.debug(
          {
            seriesId: series.id,
            seriesName: series.name,
            logoUrl: series.logo,
          },
          'Series data fetched'
        )

        const embed = new EmbedBuilder()
          .setTitle(series.name)
          .setColor(0x00ff00)
          .addFields({
            name: 'Series ID',
            value: series.id,
            inline: true,
          })
          .setFooter({
            text: `Requested by ${user.username}`,
          })

        if (series.logo) {
          embed.setImage(`${series.logo}.webp`)
        }

        await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral })

        logger.info(
          {
            seriesName: series.name,
            seriesId: series.id,
            seriesLogo: series.logo,
            user: user.username,
            embedSent: true,
            ephemeral: true,
          },
          'Series embed sent'
        )
        return
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
