const { NewsChannel } = require('discord.js');
const { ApiClient } = require('twitch');
const {
  ClientCredentialsAuthProvider,
  RefreshableAuthProvider,
  StaticAuthProvider,
} = require('twitch-auth');
const { SimpleAdapter, WebHookListener } = require('twitch-webhooks');
const { NgrokAdapter } = require('twitch-webhooks-ngrok');
const logger = require('../util/logger.js');
const config = require('../config');

class TwitchService {
  constructor() {
    this.authProvider = new ClientCredentialsAuthProvider(
      config.twitch.clientId,
      config.twitch.secret,
    );
    this.client = new ApiClient({ authProvider: this.authProvider });
  }

  async getUserById(username) {
    return await this.client.helix.users.getUserByName(username);
  }

  async getSubscriptions(discordBot) {
    this.discordClient = discordBot.client;

    const user = await this.getUserById(config.twitch.defaultUser);
    logger.info(`${user.displayName} ID: ${user.id}`);

    // this.listener.subscribeToFollowsToUser(user, async (follow) => {
    //   if (follow) {
    //     console.info(
    //       `${follow.userDisplayName} has followed ${user.displayName}`
    //     );

    //     // this.discordClient.channels.cache
    //     //   .get("339828190383964160")
    //     //   .send(`${follow.userDisplayName} has followed ${user.displayName}`);
    //   }
    // });

    let prevStream = await this.client.helix.streams.getStreamByUserId(user.id);

    this.listener.subscribeToStreamChanges(user.id, async (stream) => {
      if (stream) {
        if (!prevStream) {
          logger.info(
            `${stream.userDisplayName} just went Live with Title: ${stream.title}`,
          );
          console.log(
            `${stream.userDisplayName} just went Live with Title: ${stream.title}`,
          );
        }
      } else {
        logger.info(`${user.displayName} just went offline`);
      }
      prevStream = stream;
    });

    return this.listener;
  }

  async followToUser(channelName) {
    const user = await this.getUserById(channelName);

    this.listener.subscribeToFollowsToUser(user, (follow) => {
      if (follow) {
        console.log(
          `${follow.userDisplayName} has just followed ${user.displayName}!`,
        );
      }
    });

    logger.info(`Follow Subscription for Channel: ${channelName}`);
  }

  async start() {
    logger.info('Twitch Webhook Start');
    this.listener = new WebHookListener(this.client, new NgrokAdapter(), {
      hookValidity: 60,
    });
    this.listener.listen();
  }
}

module.exports = TwitchService;
