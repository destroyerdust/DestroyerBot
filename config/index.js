const dotenv = require('dotenv');

dotenv.config();

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const config = {
  port: process.env.PORT,
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    secret: process.env.TWITCH_SECRET,
    callbackUrl: process.env.TWITCH_CALLBACK_URL,
    defaultUser: 'shroud',
  },
  discord: {
    token: process.env.DISCORD_TOKEN,
    botPrefix: '!db',
    botChannelId: '339828190383964160',
  },
  mongodb: {
    username: process.env.MONGODB_USERNAME,
    password: process.env.MONGODB_PASSWORD,
    url: process.env.MONGODB_URL,
    dbName: process.env.MONGODB_DBNAME,
  },
};

module.exports = config;
