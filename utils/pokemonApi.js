const TCGDex = require('@tcgdex/sdk').default
const logger = require('../logger')

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

module.exports = {
  sdk,
  getSeriesCached,
}
