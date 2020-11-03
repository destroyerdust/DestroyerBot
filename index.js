const dotenv = require("dotenv").config();
const express = require("express");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var cookieSession = require("cookie-session");
var passport = require("passport");
var twitchStrategy = require("passport-twitch-new").Strategy;

const morgan = require("morgan");
const logger = require("./Util/logger.js");

const DiscordBot = require("./Discord/discordBot.js");

const { ApiClient } = require("twitch");
const { ClientCredentialsAuthProvider } = require("twitch-auth");
const { SimpleAdapter, WebHookListener } = require("twitch-webhooks");
const { NgrokAdapter } = require("twitch-webhooks-ngrok");

const path = require("path");

// Env Variables
process.env.NODE_ENV = "development";
const config = require("./config/config.js");

// Discord Initializaiton
const discordBot = new DiscordBot();
discordBot.start();

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
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(cookieSession({ secret: "somethingsecretelkjwrlsadkf" }));
  app.use(passport.initialize());

  passport.use(
    new twitchStrategy(
      {
        clientID: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_SECRET,
        callbackURL: "http://localhost:3000/auth/twitch/callback",
        scope: "user_read",
      },
      function (accessToken, refreshToken, profile, done) {
        console.log(accessToken);
        console.log(refreshToken);
        console.log(profile.id);
      }
    )
  );

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });

  // app.use(require("./routes"));
  app.get("/", (req, res) => {
    res.send("Hello World!");
  });

  app.get("/login", (req, res) => {
    res.send("Logged In");
  });

  app.get("/auth/twitch", passport.authenticate("twitch"));
  app.get(
    "/auth/twitch/callback",
    passport.authenticate("twitch", {
      failureRedirect: "/",
    }),
    function (req, res) {
      // Successful authentication, redirect home.
      res.redirect("/");
    }
  );

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
