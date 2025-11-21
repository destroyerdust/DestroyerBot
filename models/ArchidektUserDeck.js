const mongoose = require('mongoose')

const archidektUserDeckSchema = new mongoose.Schema(
  {
    discordUserId: {
      type: String,
      required: true,
      unique: true,
    },
    deckId: {
      type: Number,
      required: true,
    },
    deckName: {
      type: String,
      default: null,
    },
    deckOwner: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

archidektUserDeckSchema.index({ discordUserId: 1 }, { unique: true, name: 'user_deck_unique' })
archidektUserDeckSchema.index({ deckId: 1 }, { name: 'deck_lookup' })

module.exports = mongoose.model('ArchidektUserDeck', archidektUserDeckSchema)
