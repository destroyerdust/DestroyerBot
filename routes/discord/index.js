const { discord } = require('../../config');

const router = require('express').Router();

module.exports = function (discordBot) {
  router.get('/', (req, res) => {
    res.send(
      `Discord Number of Guilds: ${discordBot.client.guilds.cache.size}`,
    );
  });

  router.get('/update', (req, res) => {
    discordBot.client.user.setPresence({
      activity: {
        name: `in ${discordBot.client.guilds.cache.size} servers | !db help`,
        type: 'PLAYING',
      },
    });
    res.send('Bot Updated');
  });

  return router;
};
