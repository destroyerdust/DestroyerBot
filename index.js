const dotenv = require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const logger = require('./util/logger.js');

const DiscordBot = require('./discord/discordBot.js');

let subscriptions;

// Env Variables
process.env.NODE_ENV = 'development';
const config = require('./config');

// Asyn Initalization Functions
async function run() {
  const app = express();
  const port = config.port || 3000;

  app.use(morgan('combined'));
  app.use(helmet());

  require('./routes/index.js')(app);

  app.listen(port, () => {
    logger.info(`Website running at http://localhost:${port}`);
  });
}

// DestroyerBot Initializaiton
const discordBot = new DiscordBot();
['event'].forEach((x) => require(`./discord/handlers/${x}`)(discordBot.client));
discordBot.start().then(
  run().catch((error) => {
    logger.error(`Web run error: ${error}`);
  }),
);

process.on('SIGINT', () => {
  logger.info(`Discord Bot Cleanup`);
  discordBot.client.destroy();
  logger.info(`Twitch Webhook Subscription Cleanup`);
  subscriptions.stop();

  process.exit(0);
});
