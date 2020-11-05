const { NewsChannel } = require("discord.js");
const { ApiClient } = require("twitch");
const {
  ClientCredentialsAuthProvider,
  RefreshableAuthProvider,
  StaticAuthProvider,
} = require("twitch-auth");
const { SimpleAdapter, WebHookListener } = require("twitch-webhooks");
const { NgrokAdapter } = require("twitch-webhooks-ngrok");
const logger = require("../util/logger.js");

class TwitchService {
  constructor() {
    this.authProvider = new ClientCredentialsAuthProvider(
      process.env.TWITCH_CLIENT_ID,
      process.env.TWITCH_SECRET
    );
    this.client = new ApiClient({ authProvider: this.authProvider });
  }

  async getUserById(username) {
    return await this.client.helix.users.getUserByName(username);
  }

  async getSubscriptions(discordBot) {
    this.discordClient = discordBot.client;
    this.listener = new WebHookListener(this.client, new NgrokAdapter(), {
      hookValidity: 60,
    });
    this.listener.listen();

    const user = await this.getUserById(global.gConfig.twitchUser);
    logger.info(`${user.displayName} ID: ${user.id}`);

    this.listener.subscribeToFollowsToUser(user, async (follow) => {
      if (follow) {
        console.info(
          `${follow.userDisplayName} has followed ${user.displayName}`
        );

        // this.discordClient.channels.cache
        //   .get("339828190383964160")
        //   .send(`${follow.userDisplayName} has followed ${user.displayName}`);
      }
    });

    let prevStream = await this.client.helix.streams.getStreamByUserId(user.id);

    this.listener.subscribeToStreamChanges(user.id, async (stream) => {
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
      }
      prevStream = stream;
    });

    return this.listener;
  }

  async start() {
    logger.debug(`Twitch Start`);
  }
}

module.exports = TwitchService;
