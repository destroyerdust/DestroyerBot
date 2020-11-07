const { Command } = require('discord.js-commando');
const { MessageEmbed } = require('discord.js');

module.exports = class GithubCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'github',
      group: 'util',
      memberName: 'github',
      description: 'Github Bot Code Location',
    });
  }

  run(message) {
    const embed = new MessageEmbed()
      .setColor('#0099ff')
      .setTitle('Github Repository')
      .setURL('https://github.com/destroyerdust/DestroyerBot');

    return message.embed(embed);
  }
};
