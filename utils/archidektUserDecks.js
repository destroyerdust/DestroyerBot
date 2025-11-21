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

async function getUserDeckAsync(discordUserId) {
  try {
    if (getConnectionStatus()) {
      const record = await ArchidektUserDeck.findOne({ discordUserId })
      if (record) {
        return {
          deckId: record.deckId,
          deckName: record.deckName,
          deckOwner: record.deckOwner,
        }
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
  return mappings[discordUserId] || null
}

async function setUserDeckAsync(discordUserId, deckId, deckName, deckOwner) {
  const payload = { deckId, deckName: deckName || null, deckOwner: deckOwner || null }

  try {
    // Update JSON backup first
    const mappings = loadMappings()
    mappings[discordUserId] = payload
    saveMappings(mappings)

    if (getConnectionStatus()) {
      await ArchidektUserDeck.findOneAndUpdate(
        { discordUserId },
        {
          discordUserId,
          deckId,
          deckName: payload.deckName,
          deckOwner: payload.deckOwner,
        },
        { upsert: true, new: true }
      )
      logger.info({ discordUserId, deckId }, 'Archidekt user deck saved (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, saved Archidekt user deck to JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, discordUserId, deckId },
      'Error saving Archidekt user deck, saved to JSON only'
    )
  }
}

async function deleteUserDeckAsync(discordUserId) {
  try {
    // Remove from JSON
    const mappings = loadMappings()
    delete mappings[discordUserId]
    saveMappings(mappings)

    if (getConnectionStatus()) {
      await ArchidektUserDeck.deleteOne({ discordUserId })
      logger.info({ discordUserId }, 'Archidekt user deck removed (MongoDB + JSON)')
    } else {
      logger.warn('MongoDB not connected, removed Archidekt user deck from JSON only')
    }
  } catch (error) {
    logger.error(
      { error: error.message, discordUserId },
      'Error deleting Archidekt user deck, removed from JSON only'
    )
  }
}

module.exports = {
  getUserDeckAsync,
  setUserDeckAsync,
  deleteUserDeckAsync,
}
