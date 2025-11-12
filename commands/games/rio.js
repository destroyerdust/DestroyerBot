const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require('discord.js')
const logger = require('../../logger')
const {
  getCharacterProfile,
  getGuildProfile,
  getAffixes,
  RaiderIOError,
} = require('../../utils/raiderioApi')

// Region choices for Discord command options
const REGION_CHOICES = [
  { name: '🇺🇸 US', value: 'us' },
  { name: '🇪🇺 EU', value: 'eu' },
  { name: '🇰🇷 KR', value: 'kr' },
  { name: '🇹🇼 TW', value: 'tw' },
  { name: '🇨🇳 CN', value: 'cn' },
]

// Class colors for character embeds
const CLASS_COLORS = {
  'Death Knight': 0xc41e3a,
  'Demon Hunter': 0xa330c9,
  Druid: 0xff7c0a,
  Hunter: 0xaad372,
  Mage: 0x3fc7eb,
  Monk: 0x00ff98,
  Paladin: 0xf48cba,
  Priest: 0xffffff,
  Rogue: 0xfff468,
  Shaman: 0x0070dd,
  Warlock: 0x8788ee,
  Warrior: 0xc69b6d,
  Evoker: 0x33937f,
}

// Classes that can tank in WoW
const TANKING_CLASSES = ['Warrior', 'Paladin', 'Death Knight', 'Monk', 'Druid', 'Demon Hunter']

// Emoji indicators for boss progression
const BOSS_KILL_EMOJIS = ['✅', '✅✅']

/**
 * Capitalizes the first letter of a string and lowercases the rest
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

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
          option
            .setName('realm')
            .setDescription('The character\'s realm (e.g., "Area 52", "Illidan")')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('name').setDescription("The character's name").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('The region the character is on')
            .setRequired(false)
            .addChoices(...REGION_CHOICES)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('guild')
        .setDescription('🏰 Get guild progression and ranking information')
        .addStringOption((option) =>
          option
            .setName('realm')
            .setDescription('The guild\'s realm (e.g., "Area 52", "Illidan")')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('name').setDescription("The guild's name").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('The region the guild is on')
            .setRequired(false)
            .addChoices(...REGION_CHOICES)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('affixes')
        .setDescription("🎯 Get this week's Mythic+ dungeon affixes")
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('Region for affix data')
            .setRequired(false)
            .addChoices(...REGION_CHOICES)
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

    // Input validation (skip for affixes subcommand)
    let cleanRealm, cleanName
    if (subcommand !== 'affixes') {
      if (!realm || realm.trim().length === 0) {
        return interaction.reply({
          content: '❌ Please provide a valid realm name.',
          flags: MessageFlags.Ephemeral,
        })
      }

      if (!name || name.trim().length === 0) {
        return interaction.reply({
          content: '❌ Please provide a valid character/guild name.',
          flags: MessageFlags.Ephemeral,
        })
      }

      // Sanitize inputs
      cleanRealm = realm.trim()
      cleanName = name.trim()
    }

    await interaction.deferReply()

    try {
      let data
      if (subcommand === 'character') {
        data = await getCharacterProfile(
          region,
          cleanRealm,
          cleanName,
          'guild,gear,talents,talents:categorized,mythic_plus_scores_by_season:current'
        )

        const embedColor = CLASS_COLORS[data.class] || 0x0099ff

        const embed = new EmbedBuilder()
          .setTitle(`🗡️ ${data.name} - ${data.realm} (${data.region.toUpperCase()})`)
          .setURL(`https://raider.io/characters/${data.region}/${data.realm}/${data.name}`)
          .setColor(embedColor)
          .setThumbnail(data.thumbnail_url)
          .setDescription(`*${data.race} ${data.class} - ${data.active_spec_name}*`)

        // Basic Character Info
        const guild = data.guild?.name || 'No Guild'
        const factionEmoji = data.faction === 'alliance' ? '🔵' : '🔴'

        embed.addFields(
          { name: '🏰 Guild', value: guild, inline: true },
          { name: '⚔️ Faction', value: `${factionEmoji} ${capitalize(data.faction)}`, inline: true }
        )

        // Mythic+ Scores
        const mythicScore = data.mythic_plus_scores_by_season?.[0]?.segments?.all?.score || 0
        const dpsScore = data.mythic_plus_scores_by_season?.[0]?.segments?.dps?.score || 0
        const healerScore = data.mythic_plus_scores_by_season?.[0]?.segments?.healer?.score || 0
        const tankScore = data.mythic_plus_scores_by_season?.[0]?.segments?.tank?.score || 0

        const canTank = TANKING_CLASSES.includes(data.class)

        embed.addFields(
          { name: '⭐ Overall Score', value: mythicScore.toFixed(0), inline: true },
          { name: '⚔️ DPS Score', value: dpsScore.toFixed(0), inline: true },
          { name: '💚 Healer Score', value: healerScore.toFixed(0), inline: true }
        )

        // Show tank score if character can tank or has tank score > 0
        if (canTank || tankScore > 0) {
          embed.addFields({ name: '🛡️ Tank Score', value: tankScore.toFixed(0), inline: true })
        }

        // Gear Information
        if (data.gear?.item_level_equipped) {
          const ilvl = data.gear.item_level_equipped
          const equippedIlvl = data.gear.item_level_total || ilvl
          embed.addFields({
            name: '🎒 Item Level',
            value: `**${ilvl}** equipped\n${equippedIlvl} total`,
            inline: true,
          })
        }

        // Achievement Points
        if (data.achievement_points) {
          embed.addFields({
            name: '🏆 Achievement Points',
            value: data.achievement_points.toLocaleString(),
            inline: true,
          })
        }

        // Covenant & Renown (if available)
        if (data.covenant) {
          embed.addFields({
            name: '🔮 Covenant',
            value: `${data.covenant.name} (Renown ${data.renown_level || 0})`,
            inline: true,
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
        data = await getGuildProfile(
          region,
          cleanRealm,
          cleanName,
          'raid_progression:current-tier,raid_rankings:current-tier'
        )

        // Get the current raid tier (first key in raid_progression object)
        const currentRaidTier = data.raid_progression ? Object.keys(data.raid_progression)[0] : null

        // Faction-based colors
        const factionColor = data.faction === 'alliance' ? 0x004a93 : 0x8b0000
        const factionEmoji = data.faction === 'alliance' ? '🔵' : '🔴'

        const embed = new EmbedBuilder()
          .setTitle(`🏰 ${data.name} - ${data.realm} (${data.region.toUpperCase()})`)
          .setURL(data.profile_url)
          .setColor(factionColor)
          .setDescription(`*${capitalize(data.faction)} Guild*`)

        // Basic Guild Info
        embed.addFields(
          {
            name: '⚔️ Faction',
            value: `${factionEmoji} ${capitalize(data.faction)}`,
            inline: true,
          },
          { name: '👥 Members', value: (data.member_count || 'Unknown').toString(), inline: true }
        )

        // Raid Progression
        const raidProgression = data.raid_progression?.[currentRaidTier]
        if (raidProgression?.summary) {
          embed.addFields({
            name: '🐉 Current Raid Progress',
            value: raidProgression.summary,
            inline: false,
          })

          // Detailed boss progression if available
          if (raidProgression.encounters) {
            const bossKills = raidProgression.encounters.filter((enc) => enc.completed_count > 0)
            if (bossKills.length > 0) {
              const bossList = bossKills
                .slice(0, 8) // Limit to 8 bosses to avoid embed limits
                .map((enc) => `${enc.completed_count === 1 ? '✅' : '✅✅'} ${enc.encounter_name}`)
                .join('\n')

              embed.addFields({
                name: '👹 Boss Kills',
                value: bossList,
                inline: false,
              })
            }
          }
        }

        // Guild Rankings - Hierarchical display based on progression
        const rankings = data.raid_rankings?.[currentRaidTier]
        if (rankings) {
          const rankingFields = []

          // Priority: Mythic > Heroic > Normal
          if (rankings.mythic) {
            // Show only Mythic rankings for top guilds
            rankingFields.push(
              { name: '🐉 Mythic World Rank', value: `#${rankings.mythic.world}`, inline: true },
              { name: '🐉 Mythic Region Rank', value: `#${rankings.mythic.region}`, inline: true },
              { name: '🐉 Mythic Realm Rank', value: `#${rankings.mythic.realm}`, inline: true }
            )
          } else if (rankings.heroic) {
            // Show only Heroic rankings if no Mythic
            rankingFields.push(
              { name: '💪 Heroic World Rank', value: `#${rankings.heroic.world}`, inline: true },
              { name: '💪 Heroic Region Rank', value: `#${rankings.heroic.region}`, inline: true },
              { name: '💪 Heroic Realm Rank', value: `#${rankings.heroic.realm}`, inline: true }
            )
          } else if (rankings.normal) {
            // Show Normal rankings if no Mythic or Heroic
            rankingFields.push(
              { name: '⚔️ Normal World Rank', value: `#${rankings.normal.world}`, inline: true },
              { name: '⚔️ Normal Region Rank', value: `#${rankings.normal.region}`, inline: true },
              { name: '⚔️ Normal Realm Rank', value: `#${rankings.normal.realm}`, inline: true }
            )
          }

          // Add ranking fields to embed
          if (rankingFields.length > 0) {
            embed.addFields(...rankingFields)
          }
        }

        await interaction.editReply({ embeds: [embed] })
        logger.info(
          {
            guild: `${data.name}-${data.realm}-${data.region}`,
            requester: interaction.user.username,
          },
          'Guild info embed sent'
        )
      } else if (subcommand === 'affixes') {
        data = await getAffixes(region, 'en')

        const embed = new EmbedBuilder()
          .setTitle("🎯 This Week's Mythic+ Affixes")
          .setURL(data.leaderboard_url || 'https://raider.io/mythic-plus/affixes')
          .setColor(0xff6b35)
          .setDescription(`*${data.title}*`)

        if (data.affix_details && data.affix_details.length > 0) {
          // Display all affixes with their descriptions
          const affixList = data.affix_details
            .map((affix, index) => {
              const emoji = ['🌟', '🔄', '⚡', '💀'][index] || '🎯'
              return `${emoji} **${affix.name}**\n${affix.description}`
            })
            .join('\n\n')

          embed.addFields({
            name: '📋 Affix Details',
            value: affixList,
            inline: false,
          })

          // Add thumbnail from first affix icon
          if (data.affix_details[0]?.icon_url) {
            embed.setThumbnail(data.affix_details[0].icon_url)
          }
        }

        await interaction.editReply({ embeds: [embed] })
        logger.info(
          {
            title: data.title,
            region: data.region,
            requester: interaction.user.username,
          },
          'Affixes info embed sent'
        )
      }
    } catch (error) {
      // Handle RaiderIO API errors with user-friendly messages
      if (error instanceof RaiderIOError) {
        return interaction.editReply(error.userMessage)
      }

      // Handle unexpected errors
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
