const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js')
const fetch = require('node-fetch')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rio')
    .setDescription('Raider IO Information!')
    .setContexts(InteractionContextType.Guild | InteractionContextType.DM)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('character')
        .setDescription('Character Info')
        .addStringOption((option) =>
          option.setName('realm').setDescription('Realm Input').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('name').setDescription('Character Name').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('Region')
            .setRequired(false)
            .addChoices(
              { name: 'US', value: 'us' },
              { name: 'EU', value: 'eu' },
              { name: 'KR', value: 'kr' },
              { name: 'TW', value: 'tw' },
              { name: 'CN', value: 'cn' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('guild')
        .setDescription('Guild Info')
        .addStringOption((option) =>
          option.setName('realm').setDescription('Realm Input').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('name').setDescription('Guild Name').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('Region')
            .setRequired(false)
            .addChoices(
              { name: 'US', value: 'us' },
              { name: 'EU', value: 'eu' },
              { name: 'KR', value: 'kr' },
              { name: 'TW', value: 'tw' },
              { name: 'CN', value: 'cn' }
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

    await interaction.deferReply()

    try {
      let url, data, entityType
      if (subcommand === 'character') {
        entityType = 'character'
        url = `https://raider.io/api/v1/characters/profile?region=${region}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=guild,gear,talents,talents:categorized,mythic_plus_scores_by_season:current`

        logger.debug(`Fetching character data: ${region}/${realm}/${name}`)

        const response = await fetch(url)
        data = await response.json()

        if (!response.ok) {
          logger.warn(`RaiderIO character API error: ${response.status} ${response.statusText}`, {
            status: response.status,
            statusText: response.statusText,
            region,
            realm,
            name,
            apiUrl: url,
          })
          return interaction.editReply('Character not found or API error.')
        }

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

        const embed = new EmbedBuilder()
          .setTitle(`WoW Character: ${data.name} (${data.realm}-${data.region.toUpperCase()})`)
          .setURL(`https://raider.io/characters/${data.region}/${data.realm}/${data.name}`)
          .setColor(0x0099ff)
          .setThumbnail(data.thumbnail_url)

        const guild = data.guild?.name || 'None'
        const mythicScore = data.mythic_plus_scores_by_season?.[0]?.segments?.all?.score || 0

        embed.addFields(
          { name: 'Race', value: data.race, inline: true },
          { name: 'Class/Spec', value: `${data.class} / ${data.active_spec_name}`, inline: true }
          //   { name: 'Level', value: data.level.toString(), inline: true }
        )

        embed.addFields(
          { name: 'Guild', value: guild, inline: true },
          {
            name: 'Faction',
            value: data.faction.charAt(0).toUpperCase() + data.faction.slice(1),
            inline: true,
          },
          { name: 'Mythic+ Score', value: mythicScore.toString(), inline: true }
        )

        if (data.gear?.items) {
          const ilvl = data.gear.item_level_equipped || 'N/A'
          embed.addFields({ name: 'Item Level', value: ilvl.toString(), inline: true })
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
        url = `https://raider.io/api/v1/guilds/profile?region=${region}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=raid_progression:current-tier,raid_rankings:current-tier`

        logger.debug(`Fetching guild data: ${region}/${realm}/${name}`)

        const response = await fetch(url)
        data = await response.json()

        if (!response.ok) {
          logger.warn(`RaiderIO guild API error: ${response.status} ${response.statusText}`, {
            status: response.status,
            statusText: response.statusText,
            region,
            realm,
            name,
            apiUrl: url,
          })
          return interaction.editReply('Guild not found or API error.')
        }

        logger.info(
          {
            guildName: data.name,
            realm: data.realm,
            region: data.region,
            faction: data.faction,
            raidProgression: data.raid_progression?.['manaforge-omega']?.summary,
          },
          'Guild data retrieved successfully'
        )

        const embed = new EmbedBuilder()
          .setTitle(`WoW Guild: ${data.name} (${data.realm}-${data.region.toUpperCase()})`)
          .setURL(data.profile_url)
          .setColor(0x0099ff)

        const faction = data.faction
          ? data.faction.charAt(0).toUpperCase() + data.faction.slice(1)
          : 'N/A'
        const raidProgression = data.raid_progression?.['manaforge-omega']?.summary || 'N/A'

        embed.addFields(
          { name: 'Faction', value: faction, inline: true },
          { name: 'Raid Progression', value: raidProgression, inline: true }
        )

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
      logger.error('RaiderIO command error', {
        error: error.message,
        stack: error.stack,
        subcommand,
        region,
        realm,
        name,
        user: interaction.user.id,
      })
      await interaction.editReply('An error occurred while fetching data.')
    }
  },
}
