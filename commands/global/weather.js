const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fetch = require('node-fetch')
const { pirateWeatherApiKey } = require('../../config.json')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get current weather for a location')
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
    await interaction.deferReply()

    const location = interaction.options.getString('location')
    const units = interaction.options.getString('units') || 'si'

    try {
      // First, geocode the location to get lat/lon
      const geoResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'DestroyerBot WeatherCommand/1.0 (discord-bot@example.com)'
          }
        }
      )

      if (!geoResponse.ok) {
        console.error(`Geocoding failed with status ${geoResponse.status}: ${geoResponse.statusText}`)
        return interaction.editReply({ content: 'Failed to geocode the location. Please try a different city name.', ephemeral: true })
      }

      const geoData = await geoResponse.json()

      if (!geoData || geoData.length === 0) {
        return interaction.editReply({
          content: `Could not find coordinates for "${location}". Please check the city name and try again.`,
          ephemeral: true
        })
      }

      const { lat, lon, display_name } = geoData[0]
      const latNum = parseFloat(lat)
      const lonNum = parseFloat(lon)

      if (isNaN(latNum) || isNaN(lonNum)) {
        return interaction.editReply({ content: 'Invalid coordinates received from geocoding service.', ephemeral: true })
      }

      // Now fetch weather from Pirate Weather
      const weatherResponse = await fetch(
        `https://api.pirateweather.net/forecast/${pirateWeatherApiKey}/${latNum},${lonNum}?exclude=minutely,hourly,daily,alerts,flags&units=${units}`
      )

      if (!weatherResponse.ok) {
        if (weatherResponse.status === 401 || weatherResponse.status === 403) {
          return interaction.editReply({
            content: 'Pirate Weather API key is invalid or missing. Please configure your key in config.json.',
            ephemeral: true
          })
        }
        return interaction.editReply({
          content: `Could not fetch weather data for "${location}". The location might be unsupported.`,
          ephemeral: true
        })
      }

      const data = await weatherResponse.json()

      const tempUnit = units === 'us' ? '°F' : '°C'
      const speedUnit = units === 'us' ? 'mph' : units === 'si' ? 'm/s' : 'km/h'

      const embed = new EmbedBuilder()
        .setTitle(`Weather in ${display_name}`)
        .setColor(0x00aaff)

      if (data.currently) {
        const currently = data.currently
        embed.addFields(
          {
            name: 'Description',
            value: currently.summary || 'No description available',
            inline: true,
          },
          { name: 'Temperature', value: `${Math.round(currently.temperature)}${tempUnit}`, inline: true },
          { name: 'Feels Like', value: `${Math.round(currently.apparentTemperature)}${tempUnit}`, inline: true }
        )
        embed.addFields(
          { name: 'Humidity', value: `${Math.round((currently.humidity || 0) * 100)}%`, inline: true },
          { name: 'Wind Speed', value: `${(currently.windSpeed || 0).toFixed(1)} ${speedUnit}`, inline: true },
          { name: 'Pressure', value: `${Math.round(currently.pressure || 0)} hPa`, inline: true }
        )
        embed.addFields(
          { name: 'Cloud Cover', value: `${Math.round((currently.cloudCover || 0) * 100)}%`, inline: true },
          { name: 'UV Index', value: `${currently.uvIndex || 'N/A'}`, inline: true },
          { name: 'Visibility', value: `${Math.round(currently.visibility || 0)} km`, inline: true }
        )
      } else {
        embed.setDescription('Current weather data not available for this location.')
      }

      await interaction.editReply({ embeds: [embed], ephemeral: true })
    } catch (error) {
      console.error('Weather command error:', error)
      await interaction.editReply({
        content: 'An error occurred while fetching weather data. Please try again later.',
        ephemeral: true
      })
    }
  },
}
