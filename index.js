const dotenv = require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const logger = require("./util/logger.js");

const DiscordBot = require("./discord/discordBot.js");
const TwitchService = require("./twitch/twitchService.js");
let twitchService, subscriptions;

// Env Variables
process.env.NODE_ENV = "development";
const config = require("./config/config.js");
const winston = require("winston/lib/winston/config");

// Discord Initializaiton
const discordBot = new DiscordBot();
["event"].forEach((x) => require(`./discord/handlers/${x}`)(discordBot.client));
discordBot.start().then(function () {
  // Twitch Initializaiton
  twitchService = new TwitchService();
  twitchService.start();
  subscriptions = twitchService.getSubscriptions(discordBot);

  const channelNames = ["shroud", "tfue", "ninja"];

  channelNames.forEach((channel) => {
    twitchService.followToUser(channel);
  });
});

// async function testAddAfterStart() {
//   const testUser = await twitchService.client.helix.users.getUserByName("tfue");

//   (await subscriptions).subscribeToFollowsToUser(testUser, (follow) => {
//     console.log(`${follow.userDisplayName} followed ${testUser.displayName}`);
//   });
//   return testUser;
// }

// testAddAfterStart().then(console.log);

// Website Initializaiton
async function run() {
  const app = express();
  const port = global.gConfig.web_port || 3000;

  app.use(morgan("combined"));
  app.use(helmet());

  require("./routes/index.js")(app);

  app.listen(port, () => {
    logger.info(`Website running at http://localhost:${port}`);
  });
}

process.on("SIGINT", () => {
  logger.info(`Discord Bot Cleanup`);
  discordBot.client.destroy();
  logger.info(`Twitch Webhook Subscription Cleanup`);
  subscriptions.stop();

  process.exit(0);
});

run().catch((error) => {
  logger.error(error);
});
