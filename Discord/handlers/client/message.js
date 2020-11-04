module.exports = async (bot, message) => {
  if (message.author.bot || message.channel.type === "dm") return;
  console.log(`message: ${message.author}`);
};
