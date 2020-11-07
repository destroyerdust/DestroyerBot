const router = require('express').Router();
const config = require('../config');

const discordRoutes = require('./discord');

module.exports = function (discordBot) {
  router.get('/', (req, res) => {
    res.render('pages/index');
  });

  router.get('/test', (req, res) => {
    res.send('Hello Test');
  });

  router.use('/discord', discordRoutes(discordBot));

  return router;
};
