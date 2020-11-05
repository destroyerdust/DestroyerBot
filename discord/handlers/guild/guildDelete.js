module.exports = async (bot, guild) => {
  try {
    console.log(`Guild ${guild.name} removed Discord Client`);
  } catch (err) {
    console.log(err);
  }
};
