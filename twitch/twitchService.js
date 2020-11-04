const { ApiClient } = require("twitch");
const {
  ClientCredentialsAuthProvider,
  RefreshableAuthProvider,
  StaticAuthProvider,
} = require("twitch-auth");
const { SimpleAdapter, WebHookListener } = require("twitch-webhooks");
const { NgrokAdapter } = require("twitch-webhooks-ngrok/lib");

class TwitchService {
  constructor(id, secret) {
    this.authProvider = new ClientCredentialsAuthProvider(
      process.env.TWITCH_CLIENT_ID,
      TWITCH_SECRET
    );
    this.client = new ApiClient(this.authProvider);
    this.listener = new WebHookListener(this.client, new NgrokAdapter(), {
      hookValidity: 60,
    });
  }
}
