const dotenv = require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const winston = require("winston");
const discord = require("discord.js");

const { ApiClient } = require("twitch");
const { ClientCredentialsAuthProvider } = require("twitch-auth");
const { SimpleAdapter, WebHookListener } = require("twitch-webhooks");
const { NgrokAdapter } = require("twitch-webhooks-ngrok");

const { CommandoClient } = require("discord.js-commando");
const path = require("path");

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
const discordClient = new CommandoClient({
  commandPrefix: global.gConfig.botPrefix,
  owner: "127550775919378432",
});

discordClient.registry
  .registerDefaultTypes()
  .registerGroups([["util", "Utility Command Group"]])
  .registerDefaultGroups()
  .registerDefaultCommands({
    ping: false,
  })
  .registerCommandsIn(path.join(__dirname, "Discord", "commands"));

discordClient
  .on("ready", () => {
    winstonLogger.info("Discord Bot Reeady");
  })
  .on("reconnecting", () => {
    winstonLogger.info("Discord Bot Reconnecting");
  })
  .on("resume", () => {
    winstonLogger.info("Discord Bot Reconnected");
  })
  .on("disconnect", () => {
    winstonLogger.info("Discord Bot Disconnected");
  });

discordClient.on("message", (message) => {
  if (message.author.bot) return;

  if (message.channel.type == "dm") {
    const embed = new discord.MessageEmbed()
      .setAuthor(message.author.tag, message.author.displayAvatarURL())
      .setDescription(message.content)
      .setColor("#D48AD8")
      .setTimestamp();

    return message.channel.send({ embed });
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
        winstonLogger.info(
          `${stream.userDisplayName} just went Live with Title: ${stream.title}`
        );
        console.log(
          `${stream.userDisplayName} just went Live with Title: ${stream.title}`
        );
      }
    } else {
      winstonLogger.info(`${user.displayName} just went offline`);
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

process.on("SIGINT", () => {
  winstonLogger.info(`Twitch Webhook Subscription Cleanup`);
  subscription.stop();
  process.exit(0);
});

run().catch((error) => {
  winstonLogger.error(error);
});
