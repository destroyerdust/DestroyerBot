const winston = require('winston');
const path = require('path');
const chalk = require('chalk');

const logLevelColors = {
  emerg: 'red',
  alert: 'red',
  crit: 'red',
  error: 'red',
  warning: 'yellow',
  notice: 'green',
  info: 'blue',
  debug: 'cyan',
};

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.printf(
        (log) =>
          `[${new Date().toLocaleString()}] - [${chalk.redBright(
            log.level.toUpperCase()
          )}] - ${log.message}`
      ),
    }),
    new winston.transports.File({
      filename: path.resolve(__dirname, '../logs/server.log'),
      format: winston.format.printf(
        (log) =>
          `[${new Date().toLocaleString()}] - [${log.level.toUpperCase()}] - ${
            log.message
          }`
      ),
    }),
  ],
});

module.exports = logger;
