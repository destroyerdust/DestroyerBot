const fs = require('node:fs')
const path = require('node:path')
const logger = require('../logger')
const { getConnectionStatus } = require('./database')
const ArchidektUserDeck = require('../models/ArchidektUserDeck')

const DATA_DIR = path.join(__dirname, '../data')
const USER_DECK_FILE = path.join(DATA_DIR, 'archidektUserDecks.json')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  logger.info('Created data directory')
}

if (!fs.existsSync(USER_DECK_FILE)) {
  fs.writeFileSync(USER_DECK_FILE, JSON.stringify({}, null, 2))
  logger.info('Created archidektUserDecks.json backup file')
}

function loadMappings() {
  try {
    const data = fs.readFileSync(USER_DECK_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    logger.error({ error: error.message }, 'Error loading Archidekt user decks')
    return {}
  }
}

function saveMappings(mappings) {
  try {
    fs.writeFileSync(USER_DECK_FILE, JSON.stringify(mappings, null, 2))
    logger.debug('Archidekt user decks saved successfully')
  } catch (error) {
    logger.error({ error: error.message }, 'Error saving Archidekt user decks')
  }
}

function normalizeDecks(decks) {
  const normalized = Array.isArray(decks)
    ? decks.map((d) => ({
        deckId: d.deckId,
        deckName: d.deckName || null,
        deckOwner: d.deckOwner || null,
        alias: d.alias || null,
        isDefault: !!d.isDefault,
      }))
    : []

  const hasDefault = normalized.some((d) => d.isDefault)
  if (!hasDefault && normalized.length > 0) {
    normalized[0].isDefault = true
  } else if (hasDefault) {
    let firstDefaultFound = false
    for (const deck of normalized) {
      if (deck.isDefault) {
        if (!firstDefaultFound) {
          firstDefaultFound = true
        } else {
          deck.isDefault = false
        }
      }
    }
  }

  return normalized.filter((d) => d.deckId)
}

function migrateLegacyPayload(payload) {
  if (!payload) return []
  if (Array.isArray(payload.decks)) {
    return normalizeDecks(payload.decks)
  }

  if (payload.deckId) {
    return normalizeDecks([
      {
        deckId: payload.deckId,
        deckName: payload.deckName || null,
        deckOwner: payload.deckOwner || null,
        alias: null,
        isDefault: true,
      },
    ])
  }

  return []
}

async function getUserDecksAsync(discordUserId) {
  try {
    if (getConnectionStatus()) {
      const record = await ArchidektUserDeck.findOne({ discordUserId })
      if (record) {
        const decks = migrateLegacyPayload({ decks: record.decks, deckId: record.deckId })
        if (!record.decks || record.decks.length === 0) {
          // migrate legacy single deck document forward
          await ArchidektUserDeck.updateOne({ discordUserId }, { discordUserId, decks })
        }
        return decks
      }
    } else {
      logger.warn('MongoDB not connected, using JSON fallback for Archidekt user decks')
    }
  } catch (error) {
    logger.error(
      { error: error.message, discordUserId },
      'Error loading Archidekt user deck from MongoDB'
    )
  }

  const mappings = loadMappings()
  const payload = mappings[discordUserId]
  const decks = migrateLegacyPayload(payload)
  if (payload && !payload.decks) {
    // migrate JSON legacy shape
    mappings[discordUserId] = { decks }
    saveMappings(mappings)
  }
  return decks
}

async function persistDecks(discordUserId, decks) {
  const mappings = loadMappings()
  mappings[discordUserId] = { decks }
  saveMappings(mappings)

  if (!getConnectionStatus()) {
    logger.warn('MongoDB not connected, saved Archidekt user decks to JSON only')
    return
  }

  await ArchidektUserDeck.findOneAndUpdate(
    { discordUserId },
    { discordUserId, decks },
    { upsert: true, new: true }
  )
  logger.info(
    { discordUserId, deckCount: decks.length },
    'Archidekt user decks saved (MongoDB + JSON)'
  )
}

function normalizeAlias(alias) {
  return typeof alias === 'string' && alias.trim().length > 0 ? alias.trim() : null
}

async function upsertUserDeckAsync(discordUserId, deckId, deckName, deckOwner, alias, makeDefault) {
  const decks = await getUserDecksAsync(discordUserId)
  const normalizedAlias = normalizeAlias(alias)
  const aliasLower = normalizedAlias ? normalizedAlias.toLowerCase() : null

  let updated = false
  const nextDecks = decks.map((deck) => {
    const matchesId = deck.deckId === deckId
    const matchesAlias = aliasLower && deck.alias && deck.alias.toLowerCase() === aliasLower
    if (matchesId || matchesAlias) {
      updated = true
      return {
        ...deck,
        deckName: deckName || deck.deckName || null,
        deckOwner: deckOwner || deck.deckOwner || null,
        alias: normalizedAlias || deck.alias || null,
        isDefault: makeDefault ? true : deck.isDefault,
      }
    }
    return deck
  })

  if (!updated) {
    nextDecks.push({
      deckId,
      deckName: deckName || null,
      deckOwner: deckOwner || null,
      alias: normalizedAlias,
      isDefault: false,
    })
  }

  const hasDefault = nextDecks.some((d) => d.isDefault)
  if (makeDefault) {
    nextDecks.forEach((d) => {
      d.isDefault = d.deckId === deckId || (aliasLower && d.alias?.toLowerCase() === aliasLower)
    })
  } else if (!hasDefault && nextDecks.length > 0) {
    nextDecks[0].isDefault = true
  }

  await persistDecks(discordUserId, nextDecks)
  return nextDecks
}

async function removeUserDeckAsync(discordUserId, { deckId, alias }) {
  const decks = await getUserDecksAsync(discordUserId)
  const aliasLower = normalizeAlias(alias)?.toLowerCase()

  const filtered = decks.filter((deck) => {
    const matchId = deckId && deck.deckId === deckId
    const matchAlias = aliasLower && deck.alias?.toLowerCase() === aliasLower
    return !(matchId || matchAlias)
  })

  if (filtered.length === decks.length) {
    return decks
  }

  if (!filtered.some((d) => d.isDefault) && filtered.length > 0) {
    filtered[0].isDefault = true
  }

  await persistDecks(discordUserId, filtered)
  return filtered
}

async function setDefaultUserDeckAsync(discordUserId, { deckId, alias }) {
  const decks = await getUserDecksAsync(discordUserId)
  const aliasLower = normalizeAlias(alias)?.toLowerCase()

  let found = false
  const updated = decks.map((deck) => {
    const isTarget =
      (deckId && deck.deckId === deckId) || (aliasLower && deck.alias?.toLowerCase() === aliasLower)
    if (isTarget) {
      found = true
      return { ...deck, isDefault: true }
    }
    return { ...deck, isDefault: false }
  })

  if (!found) {
    return null
  }

  await persistDecks(discordUserId, updated)
  return updated
}

function resolveDeck(decks, { deckId, alias }) {
  if (deckId) {
    const byId = decks.find((d) => d.deckId === deckId)
    if (byId) return { deck: byId, source: 'explicit' }
    return { deck: { deckId }, source: 'explicit' }
  }

  const aliasLower = normalizeAlias(alias)?.toLowerCase()
  if (aliasLower) {
    const byAlias = decks.find((d) => d.alias?.toLowerCase() === aliasLower)
    if (byAlias) return { deck: byAlias, source: 'alias' }
    return null
  }

  const defaultDeck = decks.find((d) => d.isDefault) || decks[0]
  if (defaultDeck) {
    return { deck: defaultDeck, source: 'default' }
  }

  return null
}

module.exports = {
  getUserDecksAsync,
  upsertUserDeckAsync,
  removeUserDeckAsync,
  setDefaultUserDeckAsync,
  resolveDeck,
}
