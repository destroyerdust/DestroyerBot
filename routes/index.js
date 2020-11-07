const config = require('../config');

module.exports = function (app) {
  app.get('/', function (req, res) {
    res.send(config.twitch.defaultUser);
  });

  app.get('/test', function (req, res) {
    res.send('Hello Test!');
  });
};
