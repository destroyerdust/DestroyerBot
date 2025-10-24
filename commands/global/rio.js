const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fetch = require('node-fetch')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rio')
    .setDescription('Raider IO Information!')
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
          option.setName('region').setDescription('Region').setRequired(false)
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
          option.setName('region').setDescription('Region').setRequired(false)
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

    await interaction.deferReply()

    try {
      let url, data
      if (subcommand === 'character') {
        url = `https://raider.io/api/v1/characters/profile?region=${region}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=guild,gear,talents,talents:categorized,mythic_plus_scores_by_season:current`
        const response = await fetch(url)
        data = await response.json()

        if (!response.ok) {
          return interaction.editReply('Character not found or API error.')
        }

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
          { name: 'Faction', value: data.faction.charAt(0).toUpperCase() + data.faction.slice(1), inline: true },
          { name: 'Mythic+ Score', value: mythicScore.toString(), inline: true }
        )

        if (data.gear?.items) {
          const ilvl = data.gear.item_level_equipped || 'N/A'
          embed.addFields({ name: 'Item Level', value: ilvl.toString(), inline: true })
        }

        await interaction.editReply({ embeds: [embed] })

      } else if (subcommand === 'guild') {
        url = `https://raider.io/api/v1/guilds/profile?region=${region}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=raid_progression:current-tier,raid_rankings:current-tier`
        const response = await fetch(url)
        data = await response.json()

        if (!response.ok) {
          return interaction.editReply('Guild not found or API error.')
        }

        const embed = new EmbedBuilder()
          .setTitle(`WoW Guild: ${data.name} (${data.realm}-${data.region.toUpperCase()})`)
          .setURL(data.profile_url)
          .setColor(0x0099ff)

        const faction = data.faction ? data.faction.charAt(0).toUpperCase() + data.faction.slice(1) : 'N/A'
        const raidProgression = data.raid_progression?.['manaforge-omega']?.summary || 'N/A'

        embed.addFields(
          { name: 'Faction', value: faction, inline: true },
          { name: 'Raid Progression', value: raidProgression, inline: true }
        )

        await interaction.editReply({ embeds: [embed] })
      }
    } catch (error) {
      console.error(error)
      await interaction.editReply('An error occurred while fetching data.')
    }
  },
}
