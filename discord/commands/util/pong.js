const { Command } = require('discord.js-commando');

module.exports = class PongCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'pong',
      group: 'util',
      memberName: 'pong',
      description: 'Pong Pong',
    });
  }

  run(message) {
    return message.say('Ping!');
  }
};
