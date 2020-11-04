const dotenv = require("dotenv").config();
const express = require("express");

const morgan = require("morgan");
const logger = require("./util/logger.js");

const DiscordBot = require("./discord/discordBot.js");

const { ApiClient } = require("twitch");
const {
  ClientCredentialsAuthProvider,
  RefreshableAuthProvider,
  StaticAuthProvider,
} = require("twitch-auth");
const { SimpleAdapter, WebHookListener } = require("twitch-webhooks");
const { NgrokAdapter } = require("twitch-webhooks-ngrok");
const fs = require("fs");

const path = require("path");

// Env Variables
process.env.NODE_ENV = "development";
const config = require("./config/config.js");

// Discord Initializaiton
const discordBot = new DiscordBot();
["event"].forEach((x) => require(`./discord/handlers/${x}`)(discordBot.client));
discordBot.start();

// Twitch Initializaiton

const authProvider = new ClientCredentialsAuthProvider(
  process.env.TWITCH_CLIENT_ID,
  process.env.TWITCH_SECRET
);

const webhookConfig = {
  hostName: "https://a9514e78f8f6.ngrok.io",
  port: 80,
  reverseProxy: { port: 443, ssl: true },
};

const twitchApiClient = new ApiClient({ authProvider });

async function getUserById(username) {
  return await twitchApiClient.helix.users.getUserByName(username);
}

// async function isStreamLive(username) {
//   const user = await twitchApiClient.helix.users.getUserByName(username);
//   if (!user) return false;
//   const stream = await twitchApiClient.helix.streams.getStreamByUserId(user.id);
//   return stream !== null;
// }

// const listener = new WebHookListener(
//   twitchApiClient,
//   new SimpleAdapter({
//     hostName: "https://6a25a9a51616.ngrok.io",
//     listenerPort: 80,
//     reverseProxy: { port: 443, ssl: true },
//   })
// );

const listener = new WebHookListener(twitchApiClient, new NgrokAdapter(), {
  hookValidity: 60,
});

async function getSubscriptions() {
  listener.listen();

  const user = await getUserById(global.gConfig.twitchUser);
  logger.info(`${user.displayName} ID: ${user.id}`);

  listener.subscribeToFollowsToUser(user, async (follow) => {
    if (follow) {
      //   discordClient.channels.cache
      //     .get(global.gConfig.botChannelId)
      //     .send(`${follow.userDisplayName} has followed!`);
      console.log(`${follow.userDisplayName} has followed ${user.displayName}`);
    }
  });

  let prevStream = await twitchApiClient.helix.streams.getStreamByUserId(
    user.id
  );
  listener.subscribeToStreamChanges(user.id, async (stream) => {
    if (stream) {
      if (!prevStream) {
        logger.info(
          `${stream.userDisplayName} just went Live with Title: ${stream.title}`
        );
        console.log(
          `${stream.userDisplayName} just went Live with Title: ${stream.title}`
        );
      }
    } else {
      logger.info(`${user.displayName} just went offline`);
      console.log(`${user.displayName} just went offline`);
    }
    prevStream = stream;
  });

  // listener.subscribeToSubscriptionEvents(user.id, async (subscriptionEvent) => {
  //   if (subscriptionEvent) {
  //     console.log(subscriptionEvent.getUser());
  //   }
  // });

  return listener;
}

const subscription = getSubscriptions();

// Website Initializaiton
async function run() {
  const app = express();
  const port = global.gConfig.web_port || 3000;

  app.use(morgan("combined"));

  require("./routes/index.js")(app);

  app.listen(port, () => {
    logger.info(`Website running at http://localhost:${port}`);
  });
}

process.on("SIGINT", () => {
  logger.info(`Twitch Webhook Subscription Cleanup`);
  subscription.stop();
  process.exit(0);
});

run().catch((error) => {
  logger.error(error);
});
