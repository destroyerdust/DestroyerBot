const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../logger')
const {
  getUserDeckAsync,
  setUserDeckAsync,
  deleteUserDeckAsync,
} = require('../../utils/archidektUserDecks')

const ARCHIDEKT_BASE_URL = 'https://archidekt.com/api/decks'
const USER_AGENT =
  'DestroyerBot/1.0 (+https://github.com/destroyerdust/DestroyerBot; Archidekt command)'
const MAX_SEARCH_RESULTS = 15

/**
 * Safely parse JSON from a fetch response
 * @param {Response} response
 * @returns {Promise<Record<string, any>>}
 */
async function safeParseJson(response) {
  try {
    return await response.json()
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to parse Archidekt JSON response')
    return {}
  }
}

/**
 * Fetch a deck from Archidekt
 * @param {number} deckId
 * @returns {Promise<Record<string, any>>}
 */
async function fetchDeck(deckId) {
  const url = `${ARCHIDEKT_BASE_URL}/${deckId}/`

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })

  const data = await safeParseJson(response)

  if (!response.ok) {
    const message = data?.detail || `Archidekt API error (${response.status})`
    throw new Error(message)
  }

  return data
}

/**
 * Summarize cards into a compact string for embeds
 * @param {Array} cards
 * @returns {string}
 */
function summarizeCards(cards) {
  const lines = cards.slice(0, MAX_SEARCH_RESULTS).map((card) => {
    const name = card.card?.oracleCard?.name || 'Unknown card'
    const manaCost = card.card?.oracleCard?.manaCost || ''
    const types = card.card?.oracleCard?.types?.join(', ') || 'Unknown type'
    return `✦ x${card.quantity} • ${name} ${manaCost} — ${types}`.trim()
  })

  // Keep room for embed limits; trim to ~900 chars to avoid field overflows
  let summary = ''
  for (const line of lines) {
    if (summary.length + line.length + 1 > 900) break
    summary = summary ? `${summary}\n${line}` : line
  }

  return summary
}

/**
 * Filter cards by oracleCard name
 * @param {Array} cards
 * @param {string} query
 * @returns {Array}
 */
function filterCardsByName(cards, query) {
  const search = query.trim().toLowerCase()
  if (!search) return []

  return cards.filter((card) => {
    const name = card.card?.oracleCard?.name
    return typeof name === 'string' && name.toLowerCase().includes(search)
  })
}

/**
 * Build a deck summary embed
 * @param {Record<string, any>} deck
 * @returns {EmbedBuilder}
 */
function buildDeckEmbed(deck) {
  const totalCards = deck.cards?.reduce((sum, card) => sum + (card.quantity || 0), 0) || 0
  const categories = deck.categories?.filter((cat) => cat.includedInDeck) || []
  const primaryCategories =
    categories
      .map((cat) => cat.name)
      .slice(0, 6)
      .join(', ') || 'N/A'

  const embed = new EmbedBuilder()
    .setTitle(`🃏 ${deck.name || 'Unknown Deck'}`)
    .setURL(`https://archidekt.com/decks/${deck.id || ''}`)
    .setColor(0x009688)
    .setDescription('Archidekt deck overview')
    .addFields(
      { name: 'Deck ID', value: `${deck.id}`, inline: true },
      { name: 'Cards', value: `${totalCards}`, inline: true },
      {
        name: 'Owner',
        value: deck.owner?.username ? deck.owner.username : 'Unknown',
        inline: true,
      },
      { name: 'Categories', value: primaryCategories, inline: false }
    )

  if (deck.updatedAt) {
    embed.setFooter({ text: `Updated: ${new Date(deck.updatedAt).toLocaleString()}` })
  }

  if (deck.featured) {
    embed.setThumbnail(deck.featured)
  }

  return embed
}

/**
 * Build a search results embed
 * @param {Record<string, any>} deck
 * @param {string} query
 * @param {Array} matches
 * @returns {EmbedBuilder}
 */
function buildSearchEmbed(deck, query, matches) {
  const moreCount = Math.max(matches.length - MAX_SEARCH_RESULTS, 0)
  const summary = summarizeCards(matches)

  const embed = new EmbedBuilder()
    .setTitle(`🔍 ${deck.name || 'Deck'} — Search`)
    .setURL(`https://archidekt.com/decks/${deck.id || ''}`)
    .setColor(0x4caf50)
    .setDescription(`Results for "${query}" (found ${matches.length})`)

  if (summary) {
    embed.addFields({ name: 'Matches', value: summary, inline: false })
  }

  if (moreCount > 0) {
    embed.addFields({
      name: 'More',
      value: `${moreCount} additional result(s) not shown.`,
      inline: false,
    })
  }

  if (deck.featured) {
    embed.setThumbnail(deck.featured)
  }

  return embed
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('archidekt')
    .setDescription('🔮 Look up Archidekt decks and search for cards')
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
      InteractionContextType.BotDM,
    ])
    .addSubcommand((subcommand) =>
      subcommand
        .setName('deck')
        .setDescription('Get a quick summary for a deck')
        .addIntegerOption((option) =>
          option
            .setName('deck_id')
            .setDescription('Archidekt deck ID (defaults to your linked deck)')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('Search for a card name in a deck')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('Card name to search for')
            .setRequired(true)
            .setMinLength(2)
        )
        .addIntegerOption((option) =>
          option
            .setName('deck_id')
            .setDescription('Archidekt deck ID (defaults to your linked deck)')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('link')
        .setDescription('Link a default Archidekt deck to your Discord user')
        .addIntegerOption((option) =>
          option.setName('deck_id').setDescription('Archidekt deck ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('unlink').setDescription('Remove your linked Archidekt deck')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('default').setDescription('Show your linked Archidekt deck')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const deckId = interaction.options.getInteger('deck_id')
    const query = interaction.options.getString('query')

    logger.info(
      {
        command: 'archidekt',
        subcommand,
        deckId,
        query,
        userId: interaction.user.id,
        guildId: interaction.guildId || 'DM',
      },
      `${interaction.user.username} invoked /archidekt ${subcommand}`
    )

    if (subcommand === 'link') {
      if (!deckId || deckId <= 0) {
        return interaction.reply({
          content: '❌ Please provide a valid Archidekt deck ID to link.',
          ephemeral: true,
        })
      }

      await interaction.deferReply({ ephemeral: true })
      try {
        const deck = await fetchDeck(deckId)
        await setUserDeckAsync(
          interaction.user.id,
          deck.id,
          deck.name || null,
          deck.owner?.username || null
        )

        await interaction.editReply(
          `✅ Linked deck **${deck.name || deck.id}** (ID: ${deck.id})${deck.owner?.username ? ` by ${deck.owner.username}` : ''} as your default.`
        )
      } catch (error) {
        logger.error(
          { error: error.message, deckId, userId: interaction.user.id },
          'Archidekt link command error'
        )
        await interaction.editReply(
          '❌ Unable to link that deck. Please confirm the deck ID is correct and try again.'
        )
      }
      return
    }

    if (subcommand === 'unlink') {
      await deleteUserDeckAsync(interaction.user.id)
      await interaction.reply({
        content: '🗑️ Removed your linked Archidekt deck (if one was set).',
        ephemeral: true,
      })
      return
    }

    if (subcommand === 'default') {
      const mapping = await getUserDeckAsync(interaction.user.id)
      if (!mapping) {
        await interaction.reply({
          content:
            'ℹ️ You do not have a linked Archidekt deck. Use `/archidekt link deck_id:<id>` to set one.',
          ephemeral: true,
        })
      } else {
        const name = mapping.deckName || mapping.deckId
        const owner = mapping.deckOwner ? ` by ${mapping.deckOwner}` : ''
        await interaction.reply({
          content: `✅ Your linked deck is **${name}** (ID: ${mapping.deckId})${owner}.`,
          ephemeral: true,
        })
      }
      return
    }

    if (subcommand === 'search' && (!query || query.trim().length === 0)) {
      return interaction.reply({
        content: '❌ Please provide a card name to search for.',
        flags: MessageFlags.Ephemeral,
      })
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      let resolvedDeckId = deckId
      let usedDefault = false

      if (!resolvedDeckId) {
        const mapping = await getUserDeckAsync(interaction.user.id)
        if (mapping?.deckId) {
          resolvedDeckId = mapping.deckId
          usedDefault = true
        }
      }

      if (!resolvedDeckId || resolvedDeckId <= 0) {
        await interaction.editReply(
          '❌ Please provide a valid Archidekt deck ID or link one with `/archidekt link`.'
        )
        return
      }

      const deck = await fetchDeck(resolvedDeckId)

      if (subcommand === 'deck') {
        const embed = buildDeckEmbed(deck)
        const content = usedDefault ? 'Using your linked Archidekt deck.' : null
        await interaction.editReply({ content: content || undefined, embeds: [embed] })
        return
      }

      const cards = Array.isArray(deck.cards) ? deck.cards : []
      const matches = filterCardsByName(cards, query)

      if (matches.length === 0) {
        const prefix = usedDefault ? 'Using your linked deck: ' : ''
        await interaction.editReply(
          `${prefix}❌ No cards matching "${query}" were found in this deck.`
        )
        return
      }

      const embed = buildSearchEmbed(deck, query, matches)
      const content = usedDefault ? 'Using your linked Archidekt deck.' : null
      await interaction.editReply({ content: content || undefined, embeds: [embed] })
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          deckId,
          subcommand,
          userId: interaction.user.id,
        },
        'Archidekt command error'
      )

      const errorMessage =
        '❌ Unable to fetch Archidekt data right now. Please check the deck ID and try again.'

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(errorMessage)
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral })
        }
      } catch (replyError) {
        logger.error({ error: replyError.message }, 'Failed to send Archidekt error reply')
      }
    }
  },
}
