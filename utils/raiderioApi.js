const logger = require('../logger')

// RaiderIO API Configuration
const BASE_URL = 'https://raider.io/api/v1'
const USER_AGENT = 'DestroyerBot/1.0 (https://github.com/destroyerdust/DestroyerBot)'
const API_KEY = process.env.RAIDER_IO_API_KEY

/**
 * Custom error class for RaiderIO API errors
 */
class RaiderIOError extends Error {
  constructor(status, statusText, data, userMessage) {
    super(userMessage || 'RaiderIO API error')
    this.name = 'RaiderIOError'
    this.status = status
    this.statusText = statusText
    this.data = data
    this.userMessage = userMessage
  }
}

/**
 * Safely parses JSON from a fetch response
 * @param {Response} response - The fetch response object
 * @returns {Promise<Record<string, any>>} Parsed JSON or empty object
 */
async function safeParseJson(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

/**
 * Redacts API key from URL for safe logging
 * @param {string} url - The URL to redact
 * @returns {string} URL with API key replaced by [REDACTED]
 */
function redactApiKey(url) {
  if (!API_KEY) return url
  return url.replace(API_KEY, '[REDACTED]')
}

/**
 * Builds a complete RaiderIO API URL with query parameters
 * @param {string} endpoint - The API endpoint (e.g., 'characters/profile')
 * @param {Object} params - Query parameters as key-value pairs
 * @returns {string} Complete URL with encoded parameters
 */
function buildApiUrl(endpoint, params) {
  const url = new URL(`${BASE_URL}/${endpoint}`)

  // Add all provided parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value)
    }
  })

  // Add API key if configured
  if (API_KEY) {
    url.searchParams.append('access_key', API_KEY)
  }

  return url.toString()
}

/**
 * Maps HTTP status codes to user-friendly error messages
 * @param {number} status - HTTP status code
 * @param {string} resourceType - Type of resource (e.g., 'Character', 'Guild')
 * @param {string} name - Name of the resource
 * @param {string} realm - Realm name
 * @param {string} region - Region code
 * @returns {string} User-friendly error message
 */
function getErrorMessage(status, resourceType = 'Resource', name = '', realm = '', region = '') {
  if (status === 404 && name && realm) {
    return `❌ ${resourceType} "${name}" not found on realm "${realm}" in region ${region.toUpperCase()}.`
  } else if (status === 404) {
    return `❌ ${resourceType} not found or API error.`
  } else if (status === 429) {
    return '⚠️ Raider.IO API rate limit exceeded. Please try again later.'
  } else if (status >= 500) {
    return '🔧 Raider.IO API is currently experiencing issues. Please try again later.'
  } else {
    return `❌ ${resourceType} not found or API error.`
  }
}

/**
 * Core function to fetch data from RaiderIO API
 * @param {string} endpoint - The API endpoint
 * @param {Object} params - Query parameters
 * @param {Object} logContext - Additional context for logging
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {RaiderIOError} If the request fails
 */
async function fetchRaiderIO(endpoint, params, logContext = {}) {
  const apiUrl = buildApiUrl(endpoint, params)

  logger.debug(`Fetching RaiderIO data: ${endpoint}`)
  logger.debug(`API Key configured: ${!!API_KEY}`)
  logger.debug(`Final API URL: ${redactApiKey(apiUrl)}`)

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  })

  if (!response.ok) {
    const errorData = await safeParseJson(response)
    logger.warn(`RaiderIO API error: ${response.status} ${response.statusText}`, {
      status: response.status,
      statusText: response.statusText,
      apiUrl: redactApiKey(apiUrl),
      errorData,
      ...logContext,
    })

    const userMessage = getErrorMessage(
      response.status,
      logContext.resourceType,
      logContext.name,
      logContext.realm,
      logContext.region
    )

    throw new RaiderIOError(response.status, response.statusText, errorData, userMessage)
  }

  const data = await response.json()

  logger.debug('RaiderIO data retrieved successfully', {
    endpoint,
    dataKeys: Object.keys(data),
  })

  return data
}

/**
 * Get character profile from RaiderIO
 * @param {string} region - Region code (us, eu, kr, tw, cn)
 * @param {string} realm - Character's realm
 * @param {string} name - Character's name
 * @param {string} fields - Comma-separated list of fields to include
 * @returns {Promise<Object>} Character profile data
 */
async function getCharacterProfile(region, realm, name, fields) {
  const data = await fetchRaiderIO(
    'characters/profile',
    {
      region,
      realm: encodeURIComponent(realm),
      name: encodeURIComponent(name),
      fields,
    },
    {
      resourceType: 'Character',
      region,
      realm,
      name,
    }
  )

  logger.info(
    {
      characterName: data.name,
      realm: data.realm,
      region: data.region,
      race: data.race,
      class: data.class,
      spec: data.active_spec_name,
      guild: data.guild?.name,
      mythicScore: data.mythic_plus_scores_by_season?.[0]?.segments?.all?.score || 0,
      itemLevel: data.gear?.item_level_equipped,
    },
    'Character data retrieved successfully'
  )

  return data
}

/**
 * Get guild profile from RaiderIO
 * @param {string} region - Region code (us, eu, kr, tw, cn)
 * @param {string} realm - Guild's realm
 * @param {string} name - Guild's name
 * @param {string} fields - Comma-separated list of fields to include
 * @returns {Promise<Object>} Guild profile data
 */
async function getGuildProfile(region, realm, name, fields) {
  const data = await fetchRaiderIO(
    'guilds/profile',
    {
      region,
      realm: encodeURIComponent(realm),
      name: encodeURIComponent(name),
      fields,
    },
    {
      resourceType: 'Guild',
      region,
      realm,
      name,
    }
  )

  const currentRaidTier = data.raid_progression ? Object.keys(data.raid_progression)[0] : null

  logger.info(
    {
      guildName: data.name,
      realm: data.realm,
      region: data.region,
      faction: data.faction,
      raidProgression: data.raid_progression?.[currentRaidTier]?.summary,
      memberCount: data.member_count,
      achievementPoints: data.achievement_points,
      currentRaidTier,
    },
    'Guild data retrieved successfully'
  )

  return data
}

/**
 * Get current Mythic+ affixes from RaiderIO
 * @param {string} region - Region code (us, eu, kr, tw, cn)
 * @param {string} locale - Locale code (default: 'en')
 * @returns {Promise<Object>} Affix data
 */
async function getAffixes(region, locale = 'en') {
  const data = await fetchRaiderIO(
    'mythic-plus/affixes',
    {
      region,
      locale,
    },
    {
      resourceType: 'Affixes',
      region,
    }
  )

  logger.info(
    {
      title: data.title,
      affixCount: data.affix_details?.length || 0,
      region: data.region,
    },
    'Affixes data retrieved successfully'
  )

  return data
}

module.exports = {
  fetchRaiderIO,
  getCharacterProfile,
  getGuildProfile,
  getAffixes,
  RaiderIOError,
}
