const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  ApplicationIntegrationType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../logger')
const { Query } = require('@tcgdex/sdk')
const { sdk, getSeriesCached } = require('../../utils/pokemonApi')

const COLORS = {
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
}

const TIMEOUTS = {
  AUTOCOMPLETE: 2800, // Leave 200ms buffer for Discord's 3s limit
}

const FALLBACK = '—'

const truncate = (text, limit = 1024) => {
  if (!text) return FALLBACK
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text
}

const formatWeaknesses = (weaknesses) => {
  if (!weaknesses || weaknesses.length === 0) return FALLBACK
  return weaknesses
    .map((weakness) => `${weakness.type}${weakness.value ? ` ${weakness.value}` : ''}`)
    .join(', ')
}

const formatResistances = (resistances) => {
  if (!resistances || resistances.length === 0) return FALLBACK
  return resistances
    .map((resistance) => `${resistance.type}${resistance.value ? ` ${resistance.value}` : ''}`)
    .join(', ')
}

const formatAttacks = (attacks) => {
  if (!attacks || attacks.length === 0) return null

  const formatted = attacks
    .slice(0, 2)
    .map((attack) => {
      const cost = attack.cost && attack.cost.length > 0 ? attack.cost.join(' + ') : FALLBACK
      const damage = attack.damage ?? FALLBACK
      const effect = attack.effect ? `\n${attack.effect}` : ''
      return `• ${attack.name} (${cost}) — ${damage}${effect}`
    })
    .join('\n\n')

  return truncate(formatted)
}

const summarizeCardCounts = (sets) =>
  sets.reduce(
    (acc, set) => {
      acc.total += set.cardCount?.total ?? 0
      acc.official += set.cardCount?.official ?? 0
      return acc
    },
    { total: 0, official: 0 }
  )

const formatSetPreview = (sets) => {
  if (!sets || sets.length === 0) return FALLBACK

  const preview = sets
    .slice(0, 5)
    .map((set, idx) => `${idx + 1}. ${set.name}`)
    .join('\n')

  const remaining = sets.length > 5 ? `\n...and ${sets.length - 5} more` : ''

  return truncate(`${preview}${remaining}`)
}

/**
 * Handle error responses
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {Error} error
 * @param {string} context
 */
async function handleError(interaction, error, context) {
  logger.error(
    {
      error: error.message,
      stack: error.stack,
      context,
      user: interaction.user.id,
    },
    'Pokemon command error'
  )

  const message = 'An error occurred while fetching data. Please try again later.'

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message })
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral })
    }
  } catch (e) {
    logger.error({ error: e.message }, 'Failed to send error response')
  }
}

/**
 * Handle search subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleSearch(interaction) {
  const query = interaction.options.getString('query')
  const user = interaction.user

  if (!query || query.trim().length === 0) {
    return interaction.editReply({
      content: 'Please provide a valid search term.',
    })
  }

  logger.debug({ query, user: user.id }, 'Starting card search')

  const results = await sdk.card.list(new Query().equal('name', query))

  if (!results || results.length === 0) {
    logger.info({ query, user: user.id }, 'No results found')
    return interaction.editReply({
      content: `No Pokemon card found for "${query}". Please try a different search term.`,
    })
  }

  const item = await sdk.card.get(results[0].id)
  await sendCardEmbed(interaction, item, 'search')
}

/**
 * Handle random subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleRandom(interaction) {
  sdk.cache.clear()
  const item = await sdk.fetch('random', 'card')

  if (!item) {
    return interaction.editReply({
      content: 'Could not retrieve a random card.',
    })
  }
  await sendCardEmbed(interaction, item, 'random')
}

/**
 * Handle series subcommand
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleSeries(interaction) {
  const seriesId = interaction.options.getString('series')
  const user = interaction.user

  const allSeries = await getSeriesCached()
  const series = allSeries.find((s) => s.id === seriesId)
  let seriesDetails = null
  let sets = []

  if (!series) {
    return interaction.editReply({
      content: `Series with ID "${seriesId}" not found.`,
    })
  }

  try {
    seriesDetails = await sdk.fetch('series', seriesId)
    sets = seriesDetails?.sets ?? []
  } catch (error) {
    logger.warn({ error: error.message, seriesId, user: user.id }, 'Failed to fetch series details')
  }

  const { total: totalCards, official: officialCards } = summarizeCardCounts(sets)
  const totalCardsValue =
    totalCards || officialCards
      ? `${totalCards}${officialCards ? ` (${officialCards} official)` : ''}`
      : FALLBACK

  const embed = new EmbedBuilder()
    .setTitle(series.name)
    .setColor(COLORS.SUCCESS)
    .addFields(
      {
        name: 'Series ID',
        value: series.id,
        inline: true,
      },
      {
        name: 'Sets',
        value: sets.length ? sets.length.toString() : FALLBACK,
        inline: true,
      },
      {
        name: 'Total Cards',
        value: totalCardsValue,
        inline: true,
      }
    )
    .setFooter({
      text: `Requested by ${user.username}`,
    })

  if (sets.length > 0) {
    const setPreview = formatSetPreview(sets)
    embed.addFields({
      name: 'Set Preview',
      value: setPreview,
    })
  }

  if (series.logo) {
    embed.setImage(`${series.logo}.webp`)
  }

  await interaction.editReply({ embeds: [embed] })
}

/**
 * Send card embed
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {Object} item
 * @param {string} source
 */
async function sendCardEmbed(interaction, item, source) {
  const user = interaction.user
  const imageUrl = `${item.image}/high.webp`

  const embed = new EmbedBuilder()
    .setTitle(item.name)
    .setDescription(
      item.set?.name ? `${item.set.name} • #${item.localId ?? FALLBACK}` : 'Pokemon TCG Card'
    )
    .setColor(COLORS.SUCCESS)
    .setImage(imageUrl)
    .setFooter({
      text: `ID: ${item.id} • Requested by ${user.username}`,
    })

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

    if (tcgplayer.updated) {
      const updatedDate = new Date(tcgplayer.updated).toISOString().split('T')[0]
      embed.addFields({
        name: 'TCGplayer Updated',
        value: updatedDate,
        inline: true,
      })
    }
  }

  embed.addFields(
    { name: 'Types', value: item.types?.join(', ') ?? FALLBACK, inline: true },
    { name: 'HP', value: item.hp ? `${item.hp} HP` : FALLBACK, inline: true },
    { name: 'Stage', value: item.stage ?? 'Basic', inline: true },
    { name: 'Rarity', value: item.rarity ?? FALLBACK, inline: true },
    { name: 'Artist', value: item.illustrator ?? 'Unknown', inline: true },
    { name: 'Regulation', value: item.regulationMark ?? FALLBACK, inline: true },
    { name: 'Weakness', value: formatWeaknesses(item.weaknesses), inline: true },
    { name: 'Resistance', value: formatResistances(item.resistances), inline: true },
    { name: 'Retreat', value: item.retreat ? `${item.retreat} Energy` : FALLBACK, inline: true },
    {
      name: 'Legal',
      value: `Standard: ${item.legal?.standard ? 'Yes' : 'No'}\nExpanded: ${
        item.legal?.expanded ? 'Yes' : 'No'
      }`,
      inline: true,
    }
  )

  if (item.dexId && item.dexId.length > 0) {
    embed.addFields({
      name: 'Dex No.',
      value: item.dexId.join(', '),
      inline: true,
    })
  }

  if (item.evolveFrom) {
    embed.addFields({
      name: 'Evolves From',
      value: item.evolveFrom,
      inline: true,
    })
  }

  if (item.abilities && item.abilities.length > 0) {
    const ability = item.abilities[0]
    embed.addFields({
      name: `Ability — ${ability.name}`,
      value: truncate(ability.effect),
    })
  }

  const attacks = formatAttacks(item.attacks)
  if (attacks) {
    embed.addFields({
      name: 'Attacks',
      value: attacks,
    })
  }

  await interaction.editReply({ embeds: [embed] })

  logger.info(
    {
      itemName: item.name,
      itemId: item.id,
      user: user.username,
      source,
    },
    'Pokemon card embed sent'
  )
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokemon')
    .setDescription('Search and view Pokemon Trading Card Game cards')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ])
    .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM])
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('Search for a Pokemon TCG card by name')
        .addStringOption((option) =>
          option.setName('query').setDescription('Card name to search for').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('random').setDescription('Get a random Pokemon TCG card')
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

    if (focusedOption.name !== 'series') return

    try {
      // Use timeout to ensure response within Discord's 3-second limit
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Autocomplete timeout')), TIMEOUTS.AUTOCOMPLETE)
      )

      const allSeries = await Promise.race([getSeriesCached(), timeoutPromise])

      const filtered = allSeries
        .filter((series) => series.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
        .slice(0, 25) // Discord limits autocomplete to 25 choices

      const choices = filtered.map((series) => ({
        name: series.name,
        value: series.id,
      }))

      await interaction.respond(choices)
    } catch (error) {
      logger.error(
        {
          error: error.message,
          user: interaction.user.id,
        },
        'Series autocomplete error'
      )
      // Try to respond with empty array if possible
      try {
        if (!interaction.responded) {
          await interaction.respond([])
        }
      } catch {
        // Interaction expired
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
      `${user.username} requested pokemon ${subcommand}`
    )

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      switch (subcommand) {
        case 'search':
          await handleSearch(interaction)
          break
        case 'random':
          await handleRandom(interaction)
          break
        case 'series':
          await handleSeries(interaction)
          break
        default:
          logger.warn({ subcommand }, 'Unknown subcommand')
          await interaction.editReply({ content: 'Unknown subcommand.' })
      }
    } catch (error) {
      await handleError(interaction, error, subcommand)
    }
  },
}
