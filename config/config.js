const _ = require('lodash');

// module variables
const config = require('./config.json');

const { discordConfig } = config;
const { twitchConfig } = config;
const environment = process.env.NODE_ENV || 'development';
const environmentConfig = config[environment];
const finalConfig = _.merge(discordConfig, twitchConfig, environmentConfig);

global.gConfig = finalConfig;

console.log(
  `global.gConfig: ${JSON.stringify(
    global.gConfig,
    undefined,
    global.gConfig.json_indentation
  )}`
);
