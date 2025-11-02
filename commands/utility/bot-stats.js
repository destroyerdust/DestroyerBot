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

    // Use client.uptime for discord.js v14+ best practices (returns uptime in milliseconds)
    // This replaces the previous calculation using client.startTime
    const uptime = client.uptime

    // Format uptime
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24))
    const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000)

    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`

    // Total members across all servers
    const totalMembers = client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0)

    // Memory usage statistics
    const memUsage = process.memoryUsage()
    const memUsed = Math.round(memUsage.heapUsed / 1024 / 1024) // MB
    const memTotal = Math.round(memUsage.heapTotal / 1024 / 1024) // MB
    const memExternal = Math.round(memUsage.external / 1024 / 1024) // MB

    // System information
    const os = require('node:os')
    const systemInfo = `${os.platform()} ${os.arch()}`

    // Cache sizes
    const usersCached = client.users.cache.size
    const channelsCached = client.channels.cache.size
    const guildsCached = client.guilds.cache.size

    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
      },
      `${interaction.user.username} (#${interaction.user.id}) requested bot stats`
    )

    const embed = new EmbedBuilder()
      .setTitle('🤖 Bot Statistics')
      .setDescription('Current bot status and system information')
      .setColor(0x0099ff)
      .setThumbnail(client.user.displayAvatarURL({ size: 128 }))

    // Basic stats
    embed.addFields(
      { name: '⏱️ Uptime', value: uptimeStr, inline: true },
      { name: '🏠 Servers', value: client.guilds.cache.size.toString(), inline: true },
      { name: '👥 Total Members', value: totalMembers.toLocaleString(), inline: true }
    )

    // Performance stats
    embed.addFields(
      { name: '⚡ Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
      { name: '💾 Memory Used', value: `${memUsed}MB`, inline: true },
      { name: '📊 Memory Total', value: `${memTotal}MB`, inline: true }
    )

    // System & Cache info
    embed.addFields(
      { name: '🔧 Commands Loaded', value: client.commands.size.toString(), inline: true },
      { name: '👤 Users Cached', value: usersCached.toLocaleString(), inline: true },
      { name: '📺 Channels Cached', value: channelsCached.toLocaleString(), inline: true }
    )

    // Versions & System
    embed.addFields(
      { name: '🟢 Node.js', value: process.version, inline: true },
      { name: '🔷 Discord.js', value: require('discord.js').version, inline: true },
      { name: '🖥️ System', value: systemInfo, inline: true }
    )

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
    logger.info('Bot stats response sent', {
      uptime: uptimeStr,
      servers: client.guilds.cache.size,
      totalMembers,
      memoryUsed: `${memUsed}MB`,
      usersCached,
      channelsCached,
      embedSent: true,
      ephemeral: true,
    })
  },
}
