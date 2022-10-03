const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const logger = require('./logger');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const globalCommands = [];
const globalCommandsPath = path.join(__dirname, 'commands/global');
const globalCommandFiles = fs.readdirSync(globalCommandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	commands.push(command.data.toJSON());
}
logger.info(commands);

for (const file of globalCommandFiles) {
	const filePath = path.join(globalCommandsPath, file);
	const command = require(filePath);
	globalCommands.push(command.data.toJSON());
}
logger.info(globalCommands);

const rest = new REST({ version: '10' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
	.then(() => logger.info('Successfully registered application commands.'))
	.catch(console.error);

rest.put(Routes.applicationCommands(clientId), { body: globalCommands })
	.then(() => logger.info('Successfully registered global commands.'))
	.catch(console.error);