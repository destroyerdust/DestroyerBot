module.exports = async (bot, oldMember, newMember) => {
  try {
    console.log(`${oldMember.nickname} New ${newMember.nickname}`);
  } catch (err) {
    console.log(err);
  }
};
