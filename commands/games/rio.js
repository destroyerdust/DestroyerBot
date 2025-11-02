const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags } = require('discord.js')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rio')
    .setDescription('🗡️ Get World of Warcraft character and guild information from Raider.IO')
    .setContexts(
      InteractionContextType.Guild | InteractionContextType.DM | InteractionContextType.BotDM
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('character')
        .setDescription('📊 Get detailed character information and Mythic+ scores')
        .addStringOption((option) =>
          option.setName('realm').setDescription('The character\'s realm (e.g., "Area 52", "Illidan")').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('name').setDescription('The character\'s name').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('The region the character is on')
            .setRequired(false)
            .addChoices(
              { name: '🇺🇸 US', value: 'us' },
              { name: '🇪🇺 EU', value: 'eu' },
              { name: '🇰🇷 KR', value: 'kr' },
              { name: '🇹🇼 TW', value: 'tw' },
              { name: '🇨🇳 CN', value: 'cn' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('guild')
        .setDescription('🏰 Get guild progression and ranking information')
        .addStringOption((option) =>
          option.setName('realm').setDescription('The guild\'s realm (e.g., "Area 52", "Illidan")').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('name').setDescription('The guild\'s name').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('The region the guild is on')
            .setRequired(false)
            .addChoices(
              { name: '🇺🇸 US', value: 'us' },
              { name: '🇪🇺 EU', value: 'eu' },
              { name: '🇰🇷 KR', value: 'kr' },
              { name: '🇹🇼 TW', value: 'tw' },
              { name: '🇨🇳 CN', value: 'cn' }
            )
        )
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const realm = interaction.options.getString('realm')
    const name = interaction.options.getString('name')
    const region = interaction.options.getString('region') || 'us'

    logger.info(
      {
        requestedBy: interaction.user.id,
        requestedByName: interaction.user.username,
        subcommand,
        realm,
        name,
        region,
      },
      `${interaction.user.username} (#${interaction.user.id}) requested RaiderIO ${subcommand} info`
    )

    // Input validation
    if (!realm || realm.trim().length === 0) {
      return interaction.reply({
        content: '❌ Please provide a valid realm name.',
        flags: MessageFlags.Ephemeral
      })
    }

    if (!name || name.trim().length === 0) {
      return interaction.reply({
        content: '❌ Please provide a valid character/guild name.',
        flags: MessageFlags.Ephemeral
      })
    }

    // Sanitize inputs
    const cleanRealm = realm.trim()
    const cleanName = name.trim()

    await interaction.deferReply()

    try {
      let url, data, entityType
      if (subcommand === 'character') {
        entityType = 'character'
        url = `https://raider.io/api/v1/characters/profile?region=${region}&realm=${encodeURIComponent(cleanRealm)}&name=${encodeURIComponent(cleanName)}&fields=guild,gear,talents,talents:categorized,mythic_plus_scores_by_season:current`

        logger.debug(`Fetching character data: ${region}/${cleanRealm}/${cleanName}`)

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'DestroyerBot/1.0 (https://github.com/destroyerdust/DestroyerBot)'
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          logger.warn(`RaiderIO character API error: ${response.status} ${response.statusText}`, {
            status: response.status,
            statusText: response.statusText,
            region,
            realm: cleanRealm,
            name: cleanName,
            apiUrl: url,
            errorData
          })

          let errorMessage = '❌ Character not found or API error.'
          if (response.status === 404) {
            errorMessage = `❌ Character "${cleanName}" not found on realm "${cleanRealm}" in region ${region.toUpperCase()}.`
          } else if (response.status === 429) {
            errorMessage = '⚠️ Raider.IO API rate limit exceeded. Please try again later.'
          } else if (response.status >= 500) {
            errorMessage = '🔧 Raider.IO API is currently experiencing issues. Please try again later.'
          }

          return interaction.editReply(errorMessage)
        }

        data = await response.json()

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

        // Get class color or use default
        const classColors = {
          'Death Knight': 0xC41E3A,
          'Demon Hunter': 0xA330C9,
          'Druid': 0xFF7C0A,
          'Hunter': 0xAAD372,
          'Mage': 0x3FC7EB,
          'Monk': 0x00FF98,
          'Paladin': 0xF48CBA,
          'Priest': 0xFFFFFF,
          'Rogue': 0xFFF468,
          'Shaman': 0x0070DD,
          'Warlock': 0x8788EE,
          'Warrior': 0xC69B6D,
          'Evoker': 0x33937F
        }

        const embedColor = classColors[data.class] || 0x0099ff

        const embed = new EmbedBuilder()
          .setTitle(`🗡️ ${data.name} - ${data.realm} (${data.region.toUpperCase()})`)
          .setURL(`https://raider.io/characters/${data.region}/${data.realm}/${data.name}`)
          .setColor(embedColor)
          .setThumbnail(data.thumbnail_url)
          .setDescription(`*${data.race} ${data.class} - ${data.active_spec_name}*`)

        // Basic Character Info
        const guild = data.guild?.name || 'No Guild'
        const faction = data.faction.charAt(0).toUpperCase() + data.faction.slice(1)
        const factionEmoji = data.faction === 'alliance' ? '🔵' : '🔴'

        embed.addFields(
          { name: '🏰 Guild', value: guild, inline: true },
          { name: `⚔️ Faction`, value: `${factionEmoji} ${faction}`, inline: true },
          { name: '📊 Level', value: data.level?.toString() || '60', inline: true }
        )

        // Mythic+ Scores
        const mythicScore = data.mythic_plus_scores_by_season?.[0]?.segments?.all?.score || 0
        const dpsScore = data.mythic_plus_scores_by_season?.[0]?.segments?.dps?.score || 0
        const healerScore = data.mythic_plus_scores_by_season?.[0]?.segments?.healer?.score || 0
        const tankScore = data.mythic_plus_scores_by_season?.[0]?.segments?.tank?.score || 0

        embed.addFields(
          { name: '⭐ Overall Score', value: mythicScore.toFixed(0), inline: true },
          { name: '⚔️ DPS Score', value: dpsScore.toFixed(0), inline: true },
          { name: '💚 Healer Score', value: healerScore.toFixed(0), inline: true }
        )

        if (tankScore > 0) {
          embed.addFields({ name: '🛡️ Tank Score', value: tankScore.toFixed(0), inline: true })
        }

        // Gear Information
        if (data.gear?.item_level_equipped) {
          const ilvl = data.gear.item_level_equipped
          const equippedIlvl = data.gear.item_level_total || ilvl
          embed.addFields({
            name: '🎒 Item Level',
            value: `**${ilvl}** equipped\n${equippedIlvl} total`,
            inline: true
          })
        }

        // Achievement Points
        if (data.achievement_points) {
          embed.addFields({
            name: '🏆 Achievement Points',
            value: data.achievement_points.toLocaleString(),
            inline: true
          })
        }

        // Covenant & Renown (if available)
        if (data.covenant) {
          embed.addFields({
            name: '🔮 Covenant',
            value: `${data.covenant.name} (Renown ${data.renown_level || 0})`,
            inline: true
          })
        }

        await interaction.editReply({ embeds: [embed] })
        logger.info(
          {
            character: `${data.name}-${data.realm}-${data.region}`,
            requester: interaction.user.username,
          },
          'Character info embed sent'
        )
      } else if (subcommand === 'guild') {
        entityType = 'guild'
        url = `https://raider.io/api/v1/guilds/profile?region=${region}&realm=${encodeURIComponent(cleanRealm)}&name=${encodeURIComponent(cleanName)}&fields=raid_progression:current-tier,raid_rankings:current-tier`

        logger.debug(`Fetching guild data: ${region}/${cleanRealm}/${cleanName}`)

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'DestroyerBot/1.0 (https://github.com/destroyerdust/DestroyerBot)'
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          logger.warn(`RaiderIO guild API error: ${response.status} ${response.statusText}`, {
            status: response.status,
            statusText: response.statusText,
            region,
            realm: cleanRealm,
            name: cleanName,
            apiUrl: url,
            errorData
          })

          let errorMessage = '❌ Guild not found or API error.'
          if (response.status === 404) {
            errorMessage = `❌ Guild "${cleanName}" not found on realm "${cleanRealm}" in region ${region.toUpperCase()}.`
          } else if (response.status === 429) {
            errorMessage = '⚠️ Raider.IO API rate limit exceeded. Please try again later.'
          } else if (response.status >= 500) {
            errorMessage = '🔧 Raider.IO API is currently experiencing issues. Please try again later.'
          }

          return interaction.editReply(errorMessage)
        }

        data = await response.json()

        logger.info(
          {
            guildName: data.name,
            realm: data.realm,
            region: data.region,
            faction: data.faction,
            raidProgression: data.raid_progression?.['manaforge-omega']?.summary,
            memberCount: data.member_count,
            achievementPoints: data.achievement_points,
          },
          'Guild data retrieved successfully'
        )

        // Faction-based colors
        const factionColor = data.faction === 'alliance' ? 0x004A93 : 0x8B0000

        const embed = new EmbedBuilder()
          .setTitle(`🏰 ${data.name} - ${data.realm} (${data.region.toUpperCase()})`)
          .setURL(data.profile_url)
          .setColor(factionColor)
          .setDescription(`*${data.faction.charAt(0).toUpperCase() + data.faction.slice(1)} Guild*`)

        // Basic Guild Info
        const faction = data.faction.charAt(0).toUpperCase() + data.faction.slice(1)
        const factionEmoji = data.faction === 'alliance' ? '🔵' : '🔴'

        embed.addFields(
          { name: `⚔️ Faction`, value: `${factionEmoji} ${faction}`, inline: true },
          { name: '👥 Members', value: (data.member_count || 'Unknown').toString(), inline: true },
          { name: '🏆 Achievement Points', value: (data.achievement_points || 0).toLocaleString(), inline: true }
        )

        // Raid Progression
        const raidProgression = data.raid_progression?.['manaforge-omega']
        if (raidProgression?.summary) {
          embed.addFields({
            name: '🐉 Current Raid Progress',
            value: raidProgression.summary,
            inline: false
          })

          // Detailed boss progression if available
          if (raidProgression.encounters) {
            const bossKills = raidProgression.encounters.filter(enc => enc.completed_count > 0)
            if (bossKills.length > 0) {
              const bossList = bossKills
                .slice(0, 8) // Limit to 8 bosses to avoid embed limits
                .map(enc => `${enc.completed_count === 1 ? '✅' : '✅✅'} ${enc.encounter_name}`)
                .join('\n')

              embed.addFields({
                name: '👹 Boss Kills',
                value: bossList,
                inline: false
              })
            }
          }
        }

        // Guild Rankings
        const rankings = data.raid_rankings?.['manaforge-omega']
        if (rankings?.realm && rankings.region) {
          embed.addFields(
            { name: '📊 Realm Rank', value: `#${rankings.realm}`, inline: true },
            { name: '🌍 Region Rank', value: `#${rankings.region}`, inline: true },
            { name: '🌎 World Rank', value: `#${rankings.world}`, inline: true }
          )
        }

        await interaction.editReply({ embeds: [embed] })
        logger.info(
          {
            guild: `${data.name}-${data.realm}-${data.region}`,
            requester: interaction.user.username,
          },
          'Guild info embed sent'
        )
      }
    } catch (error) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          subcommand,
          region,
          realm,
          name,
          user: interaction.user.id,
        },
        'RaiderIO command error'
      )
      await interaction.editReply('An error occurred while fetching data.')
    }
  },
}
