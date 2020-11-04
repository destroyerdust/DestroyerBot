const discord = require("discord.js");
const { CommandoClient } = require("discord.js-commando");
const path = require("path");
const logger = require("../Util/logger.js");

class DiscordBot {
  constructor() {
    this.client = new CommandoClient({
      commandPrefix: global.gConfig.botPrefix,
      owner: "127550775919378432",
    });
    this.setupBot();
  }

  setupBot() {
    this.client.registry
      .registerDefaultTypes()
      .registerGroups([["util", "Utility Command Group"]])
      .registerDefaultGroups()
      .registerDefaultCommands({
        ping: false,
      })
      .registerCommandsIn(path.join(__dirname, "commands"));

    this.client
      .on("ready", () => {
        logger.info("Discord Setup");
        this.client.user.setActivity("with Commando");
      })
      .on("reconnecting", () => {
        logger.info("Discord Bot Reconnecting");
      })
      .on("resume", () => {
        logger.info("Discord Bot Reconnected");
      })
      .on("disconnect", () => {
        logger.info("Discord Bot Disconnected");
      })
      .on("error", () => {
        logger.error("Discord Error: " + console.error);
      });
  }

  async start() {
    logger.debug("Discord Start");
    await this.client.login(process.env.DISCORD_TOKEN);
  }
}

module.exports = DiscordBot;
