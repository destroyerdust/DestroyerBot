const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fetch = require('node-fetch')
const { miniAPI } = require('../../config.json')
const logger = require('../../logger')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('3d-print-status')
    .setDescription('Replies with 3D Print Status!'),
  async execute(interaction) {
    // const data = await testGet();
    // console.log(data);
    // console.log(data.material);

    // if (typeof data.progress !== 'undefined') {
    // 	console.log('No Progress');
    // }

    const { temp_nozzle, temp_bed, material, progress, print_dur, project_name, time_est } =
      await fetch(miniAPI).then((res) => res.json())

    logger.info(secondsToDhms(time_est))

    let statusEmbed
    if (typeof progress !== 'undefined') {
      // Log Info
      logger.info('Nozzle Temp: ' + temp_nozzle)
      logger.info('Bed Temp: ' + temp_bed)
      logger.info('Material: ' + material)
      logger.info('Progress: ' + progress)
      logger.info('Print Duration: ' + print_dur)
      logger.info('Project Name: ' + project_name)
      logger.info('Time Estimate: ' + time_est)

      statusEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Mini+ Status')
        .setDescription('' + project_name)
        .setThumbnail('https://cdn.prusa3d.com/content/images/product/original/2280.jpg')
        .addFields(
          { name: 'Progress', value: '' + progress + '%', inline: true },
          { name: 'Print Duration', value: '' + print_dur, inline: true },
          { name: 'Time Left: ', value: '' + secondsToDhms(time_est), inline: true },
          { name: 'Nozzle Temp', value: '' + temp_nozzle },
          { name: 'Bed Temp', value: '' + temp_bed },
          { name: 'Material', value: '' + material }
        )
    } else {
      statusEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Mini+ Status')
        .setDescription('Not Printing')
        .setThumbnail('https://cdn.prusa3d.com/content/images/product/original/2280.jpg')
    }
    await interaction
      .reply({ embeds: [statusEmbed], ephemeral: true })
      .then(() => logger.info('Reply sent.'))
  },
}

function secondsToDhms(seconds) {
  seconds = Number(seconds)
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const dDisplay = d > 0 ? d + (d == 1 ? ' day ' : ' days ') : ''
  const hDisplay = h > 0 ? h + (h == 1 ? ' hour ' : ' hours ') : ''
  const mDisplay = m > 0 ? m + (m == 1 ? ' minute ' : ' minutes ') : ''
  const sDisplay = s > 0 ? s + (s == 1 ? ' second' : ' seconds') : ''
  return dDisplay + hDisplay + mDisplay + sDisplay
}

// async function testGet() {
// 	const response = await fetch(miniAPI);
// 	const body = response.json();
// 	return body;
// }
