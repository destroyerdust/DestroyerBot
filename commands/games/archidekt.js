const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../logger')
const {
  getUserDecksAsync,
  upsertUserDeckAsync,
  removeUserDeckAsync,
  setDefaultUserDeckAsync,
  resolveDeck,
} = require('../../utils/archidektUserDecks')

const ARCHIDEKT_BASE_URL = 'https://archidekt.com/api/decks'
const USER_AGENT =
  'DestroyerBot/1.0 (+https://github.com/destroyerdust/DestroyerBot; Archidekt command)'
const MAX_SEARCH_RESULTS = 15

async function safeParseJson(response) {
  try {
    return await response.json()
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to parse Archidekt JSON response')
    return {}
  }
}

async function fetchDeck(deckId) {
  const parsedId = typeof deckId === 'string' ? Number(deckId) : deckId
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error('Invalid deck ID. Please provide a positive deck ID.')
  }

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

function summarizeCards(cards) {
  const lines = cards.slice(0, MAX_SEARCH_RESULTS).map((card) => {
    const name = card.card?.oracleCard?.name || 'Unknown card'
    const manaCost = card.card?.oracleCard?.manaCost || ''
    const types = card.card?.oracleCard?.types?.join(', ') || 'Unknown type'
    return `✦ x${card.quantity} • ${name} ${manaCost} — ${types}`.trim()
  })

  let summary = ''
  for (const line of lines) {
    if (summary.length + line.length + 1 > 900) break
    summary = summary ? `${summary}\n${line}` : line
  }

  return summary
}

function filterCardsByName(cards, query) {
  const search = query.trim().toLowerCase()
  if (!search) return []

  return cards.filter((card) => {
    const name = card.card?.oracleCard?.name
    return typeof name === 'string' && name.toLowerCase().includes(search)
  })
}

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
        .addStringOption((option) =>
          option.setName('alias').setDescription('Alias of a linked deck to use').setMaxLength(50)
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
        .addStringOption((option) =>
          option.setName('alias').setDescription('Alias of a linked deck to use').setMaxLength(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('link')
        .setDescription('Link an Archidekt deck to your Discord user')
        .addIntegerOption((option) =>
          option.setName('deck_id').setDescription('Archidekt deck ID').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('alias').setDescription('Optional alias for this deck').setMaxLength(50)
        )
        .addBooleanOption((option) =>
          option
            .setName('default')
            .setDescription('Set this deck as your default')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('unlink')
        .setDescription('Remove a linked Archidekt deck')
        .addIntegerOption((option) =>
          option.setName('deck_id').setDescription('Deck ID to remove').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('alias').setDescription('Alias to remove').setMaxLength(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('default')
        .setDescription('Show or set your default Archidekt deck')
        .addIntegerOption((option) =>
          option.setName('deck_id').setDescription('Deck ID to set as default')
        )
        .addStringOption((option) =>
          option.setName('alias').setDescription('Alias to set as default').setMaxLength(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List your linked Archidekt decks')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const deckId = interaction.options.getInteger('deck_id')
    const query = interaction.options.getString('query')
    const alias = interaction.options.getString('alias')
    const makeDefault = interaction.options.getBoolean('default') || false

    logger.info(
      {
        command: 'archidekt',
        subcommand,
        deckId,
        alias,
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
          flags: MessageFlags.Ephemeral,
        })
      }

      await interaction.deferReply({ ephemeral: true })
      try {
        const deck = await fetchDeck(deckId)
        await upsertUserDeckAsync(
          interaction.user.id,
          deck.id,
          deck.name || null,
          deck.owner?.username || null,
          alias,
          makeDefault
        )

        await interaction.editReply(
          `✅ Linked deck **${deck.name || deck.id}** (ID: ${deck.id})${
            deck.owner?.username ? ` by ${deck.owner.username}` : ''
          }${alias ? ` with alias **${alias}**` : ''}${makeDefault ? ' and set as default.' : '.'}`
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
      if (!deckId && !alias) {
        await interaction.reply({
          content: '❌ Provide a `deck_id` or `alias` to unlink.',
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      await removeUserDeckAsync(interaction.user.id, { deckId, alias })
      await interaction.reply({
        content: '🗑️ Updated your linked Archidekt decks.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    if (subcommand === 'default') {
      const decks = await getUserDecksAsync(interaction.user.id)
      if (deckId || alias) {
        const updated = await setDefaultUserDeckAsync(interaction.user.id, { deckId, alias })
        if (!updated) {
          await interaction.reply({
            content: '❌ No linked deck found matching that deck ID or alias.',
            flags: MessageFlags.Ephemeral,
          })
          return
        }
        await interaction.reply({
          content: '✅ Default deck updated.',
          flags: MessageFlags.Ephemeral,
        })
      } else {
        const currentDefault = decks.find((d) => d.isDefault)
        if (!currentDefault) {
          await interaction.reply({
            content:
              'ℹ️ You do not have a linked Archidekt deck. Use `/archidekt link deck_id:<id>` to set one.',
            flags: MessageFlags.Ephemeral,
          })
        } else {
          const name = currentDefault.deckName || currentDefault.deckId
          const owner = currentDefault.deckOwner ? ` by ${currentDefault.deckOwner}` : ''
          await interaction.reply({
            content: `✅ Your default deck is **${name}** (ID: ${currentDefault.deckId})${owner}.`,
            flags: MessageFlags.Ephemeral,
          })
        }
      }
      return
    }

    if (subcommand === 'list') {
      const decks = await getUserDecksAsync(interaction.user.id)
      if (!decks || decks.length === 0) {
        await interaction.reply({
          content: 'ℹ️ You have no linked decks. Use `/archidekt link deck_id:<id>` to add one.',
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      const lines = decks.map((d) => {
        const name = d.deckName || d.deckId
        const owner = d.deckOwner ? ` by ${d.deckOwner}` : ''
        const aliasLabel = d.alias ? ` (alias: ${d.alias})` : ''
        const defaultMark = d.isDefault ? ' ⭐' : ''
        return `• ${name} (ID: ${d.deckId})${aliasLabel}${owner}${defaultMark}`
      })

      await interaction.reply({
        content: lines.join('\n'),
        flags: MessageFlags.Ephemeral,
      })
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
      const decks = await getUserDecksAsync(interaction.user.id)
      const resolved = resolveDeck(decks, { deckId, alias })

      if (!resolved || !resolved.deck?.deckId) {
        await interaction.editReply(
          '❌ Please provide a valid Archidekt deck ID or link one with `/archidekt link`.'
        )
        return
      }

      const deck = await fetchDeck(resolved.deck.deckId)

      if (subcommand === 'deck') {
        const embed = buildDeckEmbed(deck)
        const content =
          resolved.source === 'default'
            ? 'Using your default Archidekt deck.'
            : resolved.source === 'alias'
              ? 'Using your linked deck (alias).'
              : null
        await interaction.editReply({ content: content || undefined, embeds: [embed] })
        return
      }

      const cards = Array.isArray(deck.cards) ? deck.cards : []
      const matches = filterCardsByName(cards, query)

      if (matches.length === 0) {
        const prefix =
          resolved.source === 'default'
            ? 'Using your default deck: '
            : resolved.source === 'alias'
              ? 'Using your linked deck: '
              : ''
        await interaction.editReply(
          `${prefix}❌ No cards matching "${query}" were found in this deck.`
        )
        return
      }

      const embed = buildSearchEmbed(deck, query, matches)
      const content =
        resolved.source === 'default'
          ? 'Using your default Archidekt deck.'
          : resolved.source === 'alias'
            ? 'Using your linked deck (alias).'
            : null
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
