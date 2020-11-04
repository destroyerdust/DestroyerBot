module.exports = async (bot, oldMember, newMember) => {
  try {
    console.log(`${oldMember.displayName} New ${newMember.displayName}`);
  } catch (err) {
    console.log(err);
  }
};
