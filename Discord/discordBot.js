const discord = require("discord.js");
const { CommandoClient } = require("discord.js-commando");
const path = require("path");
const logger = require("../util/logger.js");

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
        // this.client.user.setActivity("with Commando");
        this.client.user.setPresence({
          activity: {
            name: `in ${this.client.guilds.cache.size} servers | !db help`,
            type: "PLAYING",
          },
        });

        logger.info(
          `${this.client.user.username} loaded. Currently in ${this.client.guilds.cache.size} server(s) with ${this.client.users.cache.size} users.`
        );
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
