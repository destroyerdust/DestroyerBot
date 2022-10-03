const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rio')
		.setDescription('Raider IO Information!')
		.addSubcommand(subcommand =>
			subcommand
				.setName('character')
				.setDescription('Character Info')
				.addStringOption(option =>
					option
						.setName('realm')
						.setDescription('Realm Input')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('guild')
				.setDescription('Guild Info')
				.addStringOption(option =>
					option
						.setName('realm')
						.setDescription('Realm Input')
						.setRequired(true))),
	// .addSubcommand(subcommand =>
	// 	subcommand
	// 		.setName('guild')
	// 		.setDescription('Guild Information')
	// 		.addStringOption(option =>
	// 			option
	// 				.setName('realm')
	// 				.setDescription('Realm of Guild')
	// 				.setRequired(true))
	// 		.addStringOption(option =>
	// 			option
	// 				.setName('name')
	// 				.setDescription('Guild Name')
	// 				.setRequired(true))),
	async execute(interaction) {
		await interaction.reply({ content: `Pong! ${interaction.options.getString('realm')}`, ephemeral: true });
	},
};