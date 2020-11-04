const { Command } = require("discord.js-commando");

module.exports = class PingCommand extends Command {
  constructor(client) {
    super(client, {
      name: "ping",
      group: "util",
      memberName: "ping",
      description: "Ping Pong",
    });
  }

  run(message) {
    return message.say("Pong!");
  }
};
