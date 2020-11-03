const dotenv = require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const winston = require("winston");
const discord = require("discord.js");

const { ApiClient } = require("twitch");
const { ClientCredentialsAuthProvider } = require("twitch-auth");
const { SimpleAdapter, WebHookListener } = require("twitch-webhooks");
const { NgrokAdapter } = require("twitch-webhooks-ngrok");

// Env Variables
process.env.NODE_ENV = "development";
const config = require("./config/config.js");

// Logger:
// TODO Review this logger
const winstonLogger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "log" }),
  ],
  format: winston.format.printf(
    (log) =>
      `[${new Date().toLocaleString()}] - [${log.level.toUpperCase()}] - ${
        log.message
      }`
  ),
});

// Discord Initializaiton
// Create an instance of Discord Client
const discordClient = new discord.Client();

discordClient.on("ready", () => {
  winstonLogger.info("Discord Bot Reeady");
});

discordClient.on("message", (message) => {
  if (message.content === "ping") {
    winstonLogger.info("pong");
    message.channel.send("pong");
    discordClient.channels.cache.get(global.gConfig.botChannelId).send("pong");
  }
});

discordClient.login(process.env.DISCORD_TOKEN);

// Twitch Initializaiton
const authProvider = new ClientCredentialsAuthProvider(
  process.env.TWITCH_CLIENT_ID,
  process.env.TWITCH_SECRET
);

const webhookConfig = {
  hostName: "a9514e78f8f6.ngrok.io",
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
//     hostName: "a9514e78f8f6.ngrok.io",
//     listenerPort: 80,
//   })
// );

const listener = new WebHookListener(twitchApiClient, new NgrokAdapter(), {
  hookValidity: 60,
});

async function getSubscriptions() {
  listener.listen();

  const user = await getUserById(global.gConfig.twitchUser);

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
        console.log(
          `${stream.userDisplayName} just went Live with Title: ${stream.title}`
        );
      }
    } else {
      console.log(`${user.displayName} just went offline`);
    }
  });

  //   listener.subscribeToSubscriptionEvents(user.id, async (subscriptionEvent) => {
  //     if (subscriptionEvent) {
  //       console.log(subscriptionEvent.getUser());
  //     }
  //   });

  return listener;
}

const subscription = getSubscriptions();

// Website Initializaiton
async function run() {
  const app = express();
  const port = global.gConfig.web_port || 3000;

  app.use(morgan("combined"));

  app.use(require("./routes"));

  app.listen(port, () => {
    winstonLogger.info(`Website running at http://localhost:${port}`);
  });
}

run().catch((error) => {
  winstonLogger.error(error);
});
