const TCGDex = require('@tcgdex/sdk').default
const logger = require('../logger')

// Using TCGDex SDK instead of direct API calls
const sdk = new TCGDex('en')

const INVALID_DATE_TIMESTAMP = 0
const API_TIMEOUT = 8000 // 8 second timeout for API calls

/**
 * Wraps a promise with timeout protection
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise}
 */
const fetchWithTimeout = (promise, timeout = API_TIMEOUT) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('API fetch timeout')), timeout)
  )
  return Promise.race([promise, timeoutPromise])
}

// Cache for series data to speed up autocomplete
let seriesCache = null
let seriesCacheTime = 0
const SERIES_CACHE_DURATION = 60 * 60 * 1000 // 1 hour

// Cache for latest set data to reduce redundant API calls
let latestSetCache = null
let latestSetCacheTime = 0
const LATEST_SET_CACHE_DURATION = 60 * 60 * 1000 // 1 hour

// Pre-fetch series data to avoid timeout on first autocomplete request
let seriesCachePromise = null

// Track in-flight latest set fetch to prevent duplicate requests
let latestSetCachePromise = null

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
    .finally(() => {
      seriesCachePromise = null
    })

  return seriesCachePromise
}

const getSeriesCached = async () => {
  const now = Date.now()

  // If cache exists and is fresh, return it immediately
  if (seriesCache && now - seriesCacheTime < SERIES_CACHE_DURATION) {
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
// We use getSeriesCached() to handle the promise and logging, rather than calling initializeSeriesCache directly

// Attempt to initialize cache with timeout - if it takes too long, try again on first request
getSeriesCached()
  .then(() => {
    logger.debug('Series cache ready for use')
  })
  .catch((error) => {
    logger.warn(
      { error: error.message },
      'Initial series cache load failed, will retry on first request'
    )
  })

/**
 * Get the latest Pokemon TCG set with caching
 * @returns {Promise<{seriesDetails: Object, latestSet: Object, latestSetDetails: Object}>}
 */
const getLatestSetCached = async () => {
  const now = Date.now()

  // If cache exists and is fresh, return it immediately
  if (latestSetCache && now - latestSetCacheTime < LATEST_SET_CACHE_DURATION) {
    logger.debug('Returning cached latest set data')
    return latestSetCache
  }

  // If currently fetching, wait for that promise (prevents duplicate requests)
  if (latestSetCachePromise) {
    logger.debug('Waiting for in-flight latest set fetch')
    return await latestSetCachePromise
  }

  logger.debug('Fetching latest set data (cache miss or expired)')

  // Create and track the fetch promise
  latestSetCachePromise = (async () => {
    try {
      // Get all series
      const seriesList = await getSeriesCached()
      if (!seriesList || seriesList.length === 0) {
        throw new Error('No series data available')
      }

      // Get the latest series (assuming chronological order from API)
      const latestSeries = seriesList[seriesList.length - 1]
      if (!latestSeries?.id) {
        throw new Error('Latest series missing ID')
      }

      // Fetch series details to get sets (with timeout protection)
      const seriesDetails = await fetchWithTimeout(sdk.fetch('series', latestSeries.id))
      const sets = seriesDetails?.sets ?? []

      if (sets.length === 0) {
        throw new Error('No sets found in latest series')
      }

      // Find the most recently released set
      const currentTimestamp = Date.now()
      const releasedSets = sets
        .map((set) => {
          const release =
            set.releaseDate || set.releasedAt || set.release || set.released || set.serieReleaseDate
          const parsed = release ? Date.parse(release) : Number.NaN
          const timestamp = Number.isNaN(parsed) ? INVALID_DATE_TIMESTAMP : parsed
          return { set, release: timestamp }
        })
        .filter(({ release }) => release > INVALID_DATE_TIMESTAMP && release <= currentTimestamp)
        .sort((a, b) => b.release - a.release)

      const latestSet = releasedSets.length > 0 ? releasedSets[0].set : sets[sets.length - 1]

      if (!latestSet?.id) {
        throw new Error('Latest set missing ID')
      }

      // Fetch detailed set info (with timeout protection)
      let latestSetDetails = latestSet
      try {
        latestSetDetails = await fetchWithTimeout(sdk.fetch('sets', latestSet.id))
      } catch (error) {
        logger.warn({ error: error.message, setId: latestSet.id }, 'Using basic set data')
      }

      // Cache the result
      latestSetCache = {
        seriesDetails,
        latestSet,
        latestSetDetails,
      }
      latestSetCacheTime = now

      logger.debug(
        { setId: latestSetDetails.id, setName: latestSetDetails.name },
        'Latest set data cached'
      )

      return latestSetCache
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to fetch latest set data')
      throw error
    } finally {
      // Clear promise tracker after completion (success or failure)
      latestSetCachePromise = null
    }
  })()

  return await latestSetCachePromise
}

module.exports = {
  sdk,
  getSeriesCached,
  getLatestSetCached,
}
