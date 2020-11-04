const { Command } = require("discord.js-commando");

module.exports = class RestartCommand extends Command {
  constructor(client) {
    super(client, {
      name: "restart",
      group: "util",
      memberName: "restart",
      description: "Restarts the Discord Bot",
      ownerOnly: true,
    });
  }

  run(message) {
    try {
      message
        .say("Attempting to Restart Discord Bot")
        .then(this.client.destroy())
        .then(this.client.login(process.env.DISCORD_TOKEN));
    } catch (e) {
      message.say(`Error: ${e.message}`);
    }
    return;
  }
};
