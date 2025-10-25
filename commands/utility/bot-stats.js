const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  InteractionContextType,
} = require('discord.js')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot-stats')
    .setDescription('Display bot statistics and status')
    .setContexts(
      InteractionContextType.Guild | InteractionContextType.DM | InteractionContextType.BotDM
    ),
  async execute(interaction) {
    const client = interaction.client
    const uptime = Date.now() - client.startTime

    // Format uptime
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24))
    const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000)

    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`

    // Total members across all servers
    const totalMembers = client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0)

    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
      },
      `${interaction.user.username} (#${interaction.user.id}) requested bot stats`
    )

    const embed = new EmbedBuilder()
      .setTitle('Bot Statistics')
      .setDescription('Current bot status and information')
      .setColor(0x0099ff)
      .setThumbnail(client.user.displayAvatarURL({ size: 128 }))

    // Basic stats
    embed.addFields(
      { name: 'Uptime', value: uptimeStr, inline: true },
      { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
      { name: 'Total Members', value: totalMembers.toString(), inline: true }
    )

    // Additional info
    embed.addFields(
      { name: 'Commands Loaded', value: client.commands.size.toString(), inline: true },
      { name: 'Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
      { name: 'Node.js Version', value: process.version, inline: true }
    )

    // Library version
    const { version } = require('discord.js')
    embed.addFields({ name: 'Discord.js Version', value: version, inline: true })

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
    logger.info('Bot stats response sent', {
      uptime: uptimeStr,
      servers: client.guilds.cache.size,
      totalMembers,
      embedSent: true,
      ephemeral: true,
    })
  },
}
