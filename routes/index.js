module.exports = function (app) {
  app.get("/", function (req, res) {
    res.send(global.gConfig);
  });

  app.get("/test", function (req, res) {
    res.send("Hello Test!");
  });
};
