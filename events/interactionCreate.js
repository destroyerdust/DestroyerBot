const logger = require('../logger')

module.exports = {
  name: 'interactionCreate',
  execute(interaction) {
    logger.info(`${interaction.user.tag} executed ${interaction.commandName}`)
  },
}
