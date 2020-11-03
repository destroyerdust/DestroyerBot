const winston = require("winston");
const path = require("path");

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.resolve(__dirname, "../logs/server.log"),
    }),
  ],
  format: winston.format.printf(
    (log) =>
      `[${new Date().toLocaleString()}] - [${log.level.toUpperCase()}] - ${
        log.message
      }`
  ),
});

module.exports = logger;
