const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../logger')

// Blizzard API configuration
const blizzardClientId = process.env.BLIZZARD_CLIENT_ID
const blizzardClientSecret = process.env.BLIZZARD_CLIENT_SECRET

// Region choices for Discord command options
const REGION_CHOICES = [
  { name: '🇺🇸 US', value: 'us' },
  { name: '🇪🇺 EU', value: 'eu' },
  { name: '🇰🇷 KR', value: 'kr' },
  { name: '🇹🇼 TW', value: 'tw' },
]

// Realm type to color mapping
const FACTION_COLORS = {
  Normal: 0x3fc7eb,
  Roleplaying: 0xff7c0a,
  PvP: 0xc41e3a,
  PvE: 0xff7c0a,
}

// Population level to emoji mapping
const POPULATION_EMOJIS = {
  Low: '📉',
  Medium: '📊',
  High: '📈',
  Full: '🔴',
}

// Constants for currency conversion
const COPPER_PER_GOLD = 10000
const COPPER_PER_SILVER = 100

// Regex for realm slug conversion
const REALM_SLUG_REGEX = /[^a-z0-9\s-]/g

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
 * Converts a realm name to URL-safe slug format
 * @param {string} realmName - The original realm name
 * @returns {string} The slugified realm name
 */
function generateRealmSlug(realmName) {
  return realmName
    .toLowerCase()
    .replace(REALM_SLUG_REGEX, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Formats copper currency value to human-readable format
 * @param {number} copper - Amount in copper
 * @returns {string} Formatted currency string (e.g., "100 gold 50 silver")
 */
function formatCurrency(copper) {
  const gold = Math.floor(copper / COPPER_PER_GOLD)
  const silver = Math.floor((copper % COPPER_PER_GOLD) / COPPER_PER_SILVER)
  return `${gold.toLocaleString()} gold ${silver} silver`
}

/**
 * Gets emoji for population level
 * @param {string} population - Population level from API
 * @returns {string} Emoji representing population
 */
function getPopulationEmoji(population) {
  return POPULATION_EMOJIS[population] || '❓'
}

/**
 * Gets color for realm type/category
 * @param {string} category - Realm category from API
 * @returns {number} Color code for embed
 */
function getRealmColor(category) {
  return FACTION_COLORS[category] || 0x0099ff
}

/**
 * Validates Blizzard API credentials
 * @returns {boolean} True if both client ID and secret are configured
 * @throws {Error} If credentials are not configured
 */
function validateBlizzardCredentials() {
  if (!blizzardClientId || !blizzardClientSecret) {
    logger.error(
      {
        hasClientId: !!blizzardClientId,
        hasClientSecret: !!blizzardClientSecret,
      },
      'Blizzard API credentials not configured'
    )
    throw new Error('Blizzard API credentials not configured')
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wow')
    .setDescription('🗡️ World of Warcraft information and utilities')
    .setContexts(
      InteractionContextType.Guild | InteractionContextType.DM | InteractionContextType.BotDM
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('realm')
        .setDescription('🌐 Get realm status and connected realm information')
        .addStringOption((option) =>
          option
            .setName('realm')
            .setDescription('The realm name (e.g., "Area 52", "Illidan")')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('The region the realm is on')
            .setRequired(false)
            .addChoices(
              { name: '🇺🇸 US', value: 'us' },
              { name: '🇪🇺 EU', value: 'eu' },
              { name: '🇰🇷 KR', value: 'kr' },
              { name: '🇹🇼 TW', value: 'tw' }
            )
        )
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName('token')
        .setDescription('🪙 Get current WoW Token prices and market data')
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('The region to check token prices')
            .setRequired(false)
            .addChoices(
              { name: '🇺🇸 US', value: 'us' },
              { name: '🇪🇺 EU', value: 'eu' },
              { name: '🇰🇷 KR', value: 'kr' },
              { name: '🇹🇼 TW', value: 'tw' }
            )
        )
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const region = interaction.options.getString('region') || 'us'

    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
        subcommand,
        region,
      },
      `${interaction.user.username} (#${interaction.user.id}) requested WoW ${subcommand} info`
    )

    await interaction.deferReply()

    try {
      if (subcommand === 'realm') {
        await handleRealmCommand(interaction, region)
      } else if (subcommand === 'token') {
        await handleTokenCommand(interaction, region)
      }
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          subcommand,
          region,
          user: interaction.user.id,
        },
        'WoW command error'
      )
      await interaction.editReply('An error occurred while fetching WoW data.')
    }
  },
}

async function handleRealmCommand(interaction, region) {
  const realm = interaction.options.getString('realm')

  logger.debug(
    {
      command: 'wow realm',
      realm: realm,
      region: region,
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
    },
    'Starting realm command execution'
  )

  if (!realm || realm.trim().length === 0) {
    logger.warn(
      {
        command: 'wow realm',
        realm: realm,
        region: region,
        userId: interaction.user.id,
      },
      'Invalid realm parameter provided'
    )
    return interaction.editReply({
      content: '❌ Please provide a valid realm name.',
    })
  }

  const cleanRealm = realm.trim()
  const realmSlug = generateRealmSlug(cleanRealm)

  logger.debug(
    {
      command: 'wow realm',
      originalRealm: realm,
      cleanRealm: cleanRealm,
      realmSlug: realmSlug,
      region: region,
      userId: interaction.user.id,
    },
    'Realm parameter validated and slugified, starting API calls'
  )

  try {
    // Get Blizzard API access token
    logger.debug(
      {
        command: 'wow realm',
        cleanRealm: cleanRealm,
        region: region,
      },
      'Requesting Blizzard API access token'
    )
    const token = await getBlizzardAccessToken()
    logger.debug(
      {
        command: 'wow realm',
        cleanRealm: cleanRealm,
        tokenLength: token ? token.length : 0,
      },
      'Blizzard API access token obtained'
    )

    // Fetch realm data
    const realmResponse = await fetch(
      `https://${region}.api.blizzard.com/data/wow/realm/${encodeURIComponent(realmSlug)}?namespace=dynamic-${region}&locale=en_US`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'DestroyerBot/1.0 (https://github.com/destroyerdust/DestroyerBot)',
        },
      }
    )

    if (!realmResponse.ok) {
      if (realmResponse.status === 404) {
        return interaction.editReply(
          `❌ Realm "${cleanRealm}" not found in region ${region.toUpperCase()}.`
        )
      }
      throw new Error(`Blizzard API error: ${realmResponse.status}`)
    }

    const realmData = await realmResponse.json()
    // Extract connected realm ID from the href URL
    const connectedRealmHref = realmData.connected_realm?.href
    const connectedRealmId = connectedRealmHref
      ? connectedRealmHref.match(/\/connected-realm\/(\d+)/)?.[1]
      : null

    logger.debug(
      {
        command: 'wow realm',
        cleanRealm: cleanRealm,
        realmData: realmData,
        connectedRealmHref: connectedRealmHref,
        connectedRealmId: connectedRealmId,
      },
      'Realm data retrieved successfully'
    )

    // Get connected realms
    logger.debug(
      {
        command: 'wow realm',
        cleanRealm: cleanRealm,
        connectedRealmId: connectedRealmId,
      },
      'Fetching connected realms data'
    )

    const connectedRealmsResponse = await fetch(
      `https://${region}.api.blizzard.com/data/wow/connected-realm/${connectedRealmId}?namespace=dynamic-${region}&locale=en_US`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'DestroyerBot/1.0 (https://github.com/destroyerdust/DestroyerBot)',
        },
      }
    )

    logger.debug(
      {
        command: 'wow realm',
        cleanRealm: cleanRealm,
        connectedResponseStatus: connectedRealmsResponse.status,
        connectedResponseOk: connectedRealmsResponse.ok,
      },
      'Connected realms API response received'
    )

    if (!connectedRealmsResponse.ok) {
      logger.warn(
        {
          command: 'wow realm',
          cleanRealm: cleanRealm,
          status: connectedRealmsResponse.status,
          statusText: connectedRealmsResponse.statusText,
        },
        'Connected realms API returned non-OK status'
      )
      throw new Error(`Connected realms API error: ${connectedRealmsResponse.status}`)
    }

    const connectedData = await connectedRealmsResponse.json()
    logger.debug(
      {
        command: 'wow realm',
        cleanRealm: cleanRealm,
        connectedData: connectedData,
        connectedRealmsCount: connectedData.realms?.length || 0,
      },
      'Connected realms data parsed successfully'
    )

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`🌐 ${realmData.name} (${realmData.region.name})`)
      .setColor(getRealmColor(realmData.category))
      .setDescription(`*${realmData.category} Realm*`)

    // Basic realm info
    const statusEmoji = connectedData.status.name === 'Up' ? '🟢' : '🔴'
    const populationEmoji = getPopulationEmoji(connectedData.population.name)

    embed.addFields(
      { name: 'Status', value: `${statusEmoji} ${connectedData.status.name}`, inline: true },
      { name: 'Type', value: realmData.type.name, inline: true },
      {
        name: 'Population',
        value: `${populationEmoji} ${connectedData.population.name}`,
        inline: true,
      }
    )

    // Connected realms
    if (connectedData.realms && connectedData.realms.length > 1) {
      const connectedNames = connectedData.realms
        .filter((r) => r.id !== realmData.id)
        .map((r) => r.name)
        .join(', ')

      embed.addFields({
        name: '🔗 Connected Realms',
        value: connectedNames || 'None',
        inline: false,
      })
    }

    await interaction.editReply({ embeds: [embed] })
    logger.info(
      {
        realm: cleanRealm,
        region: region,
        requester: interaction.user.username,
      },
      'Realm info embed sent'
    )
  } catch (error) {
    logger.error(
      {
        error: error.message,
        realm: cleanRealm,
        region: region,
      },
      'Realm command error'
    )

    let errorMessage = '❌ Unable to fetch realm information.'
    if (error.message.includes('Blizzard API')) {
      errorMessage = '🔧 Blizzard API is currently experiencing issues. Please try again later.'
    }

    await interaction.editReply(errorMessage)
  }
}

async function handleTokenCommand(interaction, region) {
  logger.debug(
    {
      command: 'wow token',
      region: region,
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
    },
    'Starting token command execution'
  )

  try {
    // Get Blizzard API access token
    logger.debug(
      {
        command: 'wow token',
        region: region,
      },
      'Requesting Blizzard API access token for token price'
    )
    const token = await getBlizzardAccessToken()
    logger.debug(
      {
        command: 'wow token',
        region: region,
        tokenLength: token ? token.length : 0,
      },
      'Blizzard API access token obtained for token price'
    )

    // Get WoW Token price index
    logger.debug(
      {
        command: 'wow token',
        region: region,
        tokenPreview: token ? token.substring(0, 10) + '...' : 'null',
      },
      'Fetching WoW token price data'
    )

    const tokenResponse = await fetch(
      `https://${region}.api.blizzard.com/data/wow/token/?namespace=dynamic-${region}&locale=en_US`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'DestroyerBot/1.0 (https://github.com/destroyerdust/DestroyerBot)',
        },
      }
    )

    logger.debug(
      {
        command: 'wow token',
        region: region,
        responseStatus: tokenResponse.status,
        responseOk: tokenResponse.ok,
      },
      'Token API response received'
    )

    if (!tokenResponse.ok) {
      logger.warn(
        {
          command: 'wow token',
          region: region,
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
        },
        'Token API returned non-OK status'
      )
      throw new Error(`Token API error: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    logger.debug(
      {
        command: 'wow token',
        region: region,
        tokenDataKeys: Object.keys(tokenData),
        hasPrice: !!tokenData.price,
      },
      'Token data parsed successfully'
    )

    // Convert price from copper to gold
    const priceInCopper = tokenData.price
    const formattedPrice = formatCurrency(priceInCopper)
    const priceInGold = Math.floor(priceInCopper / COPPER_PER_GOLD)

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('🪙 WoW Token Price')
      .setColor(0xffd700)
      .setDescription(`Current price in ${region.toUpperCase()} region`)

    embed.addFields(
      {
        name: '💰 Current Price',
        value: formattedPrice,
        inline: true,
      },
      {
        name: '📊 Raw Value',
        value: `${priceInCopper.toLocaleString()} copper`,
        inline: true,
      }
    )

    // Add helpful links
    embed.addFields({
      name: '🔗 Token Tools',
      value: '[WoWToken.app](https://wowtoken.app/) • [WoWAuction.us](https://wowauction.us/token)',
      inline: false,
    })

    await interaction.editReply({ embeds: [embed] })
    logger.info(
      {
        region: region,
        price: priceInGold,
        requester: interaction.user.username,
      },
      'Token price info embed sent'
    )
  } catch (error) {
    logger.error(
      {
        error: error.message,
        region: region,
      },
      'Token command error'
    )

    let errorMessage = '❌ Unable to fetch WoW Token price.'
    if (error.message.includes('Blizzard API')) {
      errorMessage = '🔧 Blizzard API is currently experiencing issues. Please try again later.'
    }

    await interaction.editReply(errorMessage)
  }
}

async function getBlizzardAccessToken() {
  logger.debug(
    {
      hasClientId: !!blizzardClientId,
      hasClientSecret: !!blizzardClientSecret,
      clientIdLength: blizzardClientId ? blizzardClientId.length : 0,
      clientSecretLength: blizzardClientSecret ? blizzardClientSecret.length : 0,
    },
    'Checking Blizzard API credentials'
  )

  if (!blizzardClientId || !blizzardClientSecret) {
    logger.error(
      {
        hasClientId: !!blizzardClientId,
        hasClientSecret: !!blizzardClientSecret,
      },
      'Blizzard API credentials not configured'
    )
    throw new Error('Blizzard API credentials not configured')
  }

  logger.debug('Initiating Blizzard API authentication request')

  const authResponse = await fetch('https://us.battle.net/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' + Buffer.from(`${blizzardClientId}:${blizzardClientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  })

  logger.debug(
    {
      authResponseStatus: authResponse.status,
      authResponseOk: authResponse.ok,
      authResponseStatusText: authResponse.statusText,
    },
    'Blizzard authentication response received'
  )

  if (!authResponse.ok) {
    logger.error(
      {
        status: authResponse.status,
        statusText: authResponse.statusText,
      },
      'Blizzard API authentication failed'
    )
    throw new Error(`Authentication failed: ${authResponse.status}`)
  }

  const authData = await authResponse.json()
  logger.debug(
    {
      hasAccessToken: !!authData.access_token,
      tokenType: authData.token_type,
      expiresIn: authData.expires_in,
      tokenLength: authData.access_token ? authData.access_token.length : 0,
    },
    'Blizzard API authentication successful'
  )

  // DEBUG: Output access token to console (REMOVE IN PRODUCTION)
  console.log('🔑 Blizzard Access Token:', authData.access_token)

  return authData.access_token
}
