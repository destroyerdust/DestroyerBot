const dotenv = require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const logger = require('./util/logger.js');

const DiscordBot = require('./discord/discordBot.js');
const TwitchService = require('./twitch/twitchService.js');

let twitchService;
let subscriptions;

// Env Variables
process.env.NODE_ENV = 'development';
const config = require('./config');
const routes = require('./routes');

// Async Initialization Functions
async function run() {
  const app = express();
  const port = config.port || 3000;

  app.use(morgan('combined'));
  app.use(helmet());

  app.set('view engine', 'ejs');

  app.use('/', routes(discordBot));

  app.listen(port, () => {
    logger.info(`Website running at http://localhost:${port}`);
  });
}

// DestroyerBot Initialization
const discordBot = new DiscordBot();
discordBot
  .start()
  // .then(function () {
  //   // Twitch Initializaiton
  //   twitchService = new TwitchService();
  //   twitchService.start();
  //   subscriptions = twitchService.getSubscriptions(discordBot);

  //   const channelNames = ['shroud', 'tfue', 'ninja'];

  //   channelNames.forEach((channel) => {
  //     twitchService.followToUser(channel);
  //   });
  // })
  .then(
    run().catch((error) => {
      logger.error(`Web run error: ${error}`);
    }),
  );

// async function testAddAfterStart() {
//   const testUser = await twitchService.client.helix.users.getUserByName("tfue");

//   (await subscriptions).subscribeToFollowsToUser(testUser, (follow) => {
//     console.log(`${follow.userDisplayName} followed ${testUser.displayName}`);
//   });
//   return testUser;
// }

// testAddAfterStart().then(console.log);

process.on('SIGINT', () => {
  logger.info(`Discord Bot Cleanup`);
  discordBot.client.destroy();
  logger.info(`Twitch Webhook Subscription Cleanup`);
  subscriptions.stop();

  process.exit(0);
});
