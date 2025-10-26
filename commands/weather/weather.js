const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../logger')
const { pirateWeatherApiKey } = require('../../config.json')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get current weather for a location')
    .setContexts(
      InteractionContextType.Guild | InteractionContextType.DM | InteractionContextType.BotDM
    )
    .addStringOption((option) =>
      option
        .setName('location')
        .setDescription('City name (e.g., "New York" or "London,UK")')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('units')
        .setDescription('Temperature units')
        .setRequired(false)
        .addChoices(
          { name: 'Celsius', value: 'si' },
          { name: 'Fahrenheit', value: 'us' },
          { name: 'Canadian (Celsius with km/h)', value: 'ca' }
        )
    ),
  async execute(interaction) {
    const location = interaction.options.getString('location')
    const units = interaction.options.getString('units') || 'si'

    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
        location,
        units,
      },
      `${interaction.user.username} (#${interaction.user.id}) requested weather info`
    )

    await interaction.deferReply()

    try {
      // First, geocode the location to get lat/lon
      logger.debug(`Geocoding location: ${location}`)

      const geoResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'DestroyerBot WeatherCommand/1.0 (discord-bot@example.com)',
          },
        }
      )

      if (!geoResponse.ok) {
        logger.warn(
          {
            status: geoResponse.status,
            statusText: geoResponse.statusText,
            location,
          },
          `Geocoding API error: ${geoResponse.status} ${geoResponse.statusText}`
        )
        return interaction.editReply({
          content: 'Failed to geocode the location. Please try a different city name.',
          flags: MessageFlags.Ephemeral,
        })
      }

      const geoData = await geoResponse.json()

      if (!geoData || geoData.length === 0) {
        logger.warn(
          {
            location,
            user: interaction.user.id,
          },
          'Geocoding returned no results'
        )
        return interaction.editReply({
          content: `Could not find coordinates for "${location}". Please check the city name and try again.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      const { lat, lon, display_name } = geoData[0]
      const latNum = parseFloat(lat)
      const lonNum = parseFloat(lon)

      if (isNaN(latNum) || isNaN(lonNum)) {
        logger.warn(
          {
            location,
            lat,
            lon,
            display_name,
            user: interaction.user.id,
          },
          'Invalid coordinates returned from geocoding'
        )
        return interaction.editReply({
          content: 'Invalid coordinates received from geocoding service.',
          flags: MessageFlags.Ephemeral,
        })
      }

      logger.info(
        {
          location,
          coordinates: `${latNum},${lonNum}`,
          displayName: display_name,
          user: interaction.user.id,
        },
        'Location geocoded successfully'
      )

      // Now fetch weather from Pirate Weather
      logger.debug(`Fetching weather data: ${latNum},${lonNum} (${units})`)

      const weatherResponse = await fetch(
        `https://api.pirateweather.net/forecast/${pirateWeatherApiKey}/${latNum},${lonNum}?exclude=minutely,hourly,daily,alerts,flags&units=${units}`
      )

      if (!weatherResponse.ok) {
        logger.warn(
          {
            status: weatherResponse.status,
            statusText: weatherResponse.statusText,
            coordinates: `${latNum},${lonNum}`,
            units,
            location,
          },
          `Pirate Weather API error: ${weatherResponse.status} ${weatherResponse.statusText}`
        )
        if (weatherResponse.status === 401 || weatherResponse.status === 403) {
          return interaction.editReply({
            content:
              'Pirate Weather API key is invalid or missing. Please configure your key in config.json.',
            flags: MessageFlags.Ephemeral,
          })
        }
        return interaction.editReply({
          content: `Could not fetch weather data for "${location}". The location might be unsupported.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      const data = await weatherResponse.json()

      const tempUnit = units === 'us' ? '°F' : '°C'
      const speedUnit = units === 'us' ? 'mph' : units === 'si' ? 'm/s' : 'km/h'

      logger.info(
        {
          location: display_name,
          coordinates: `${latNum},${lonNum}`,
          summary: data.currently?.summary || 'N/A',
          temperature: data.currently?.temperature,
          units,
          user: interaction.user.id,
        },
        'Weather data retrieved successfully'
      )

      const embed = new EmbedBuilder().setTitle(`Weather in ${display_name}`).setColor(0x00aaff)

      if (data.currently) {
        const currently = data.currently
        embed.addFields(
          {
            name: 'Description',
            value: currently.summary || 'No description available',
            inline: true,
          },
          {
            name: 'Temperature',
            value: `${Math.round(currently.temperature)}${tempUnit}`,
            inline: true,
          },
          {
            name: 'Feels Like',
            value: `${Math.round(currently.apparentTemperature)}${tempUnit}`,
            inline: true,
          }
        )
        embed.addFields(
          {
            name: 'Humidity',
            value: `${Math.round((currently.humidity || 0) * 100)}%`,
            inline: true,
          },
          {
            name: 'Wind Speed',
            value: `${(currently.windSpeed || 0).toFixed(1)} ${speedUnit}`,
            inline: true,
          },
          { name: 'Pressure', value: `${Math.round(currently.pressure || 0)} hPa`, inline: true }
        )
        embed.addFields(
          {
            name: 'Cloud Cover',
            value: `${Math.round((currently.cloudCover || 0) * 100)}%`,
            inline: true,
          },
          { name: 'UV Index', value: `${currently.uvIndex || 'N/A'}`, inline: true },
          { name: 'Visibility', value: `${Math.round(currently.visibility || 0)} km`, inline: true }
        )
      } else {
        embed.setDescription('Current weather data not available for this location.')
      }

      await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.info(
        {
          location: display_name,
          requester: interaction.user.username,
          embedSent: true,
          ephemeral: true,
        },
        'Weather embed sent'
      )
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          location,
          units,
          user: interaction.user.id,
        },
        'Weather command error'
      )
      await interaction.editReply({
        content: 'An error occurred while fetching weather data. Please try again later.',
        flags: MessageFlags.Ephemeral,
      })
    }
  },
}
