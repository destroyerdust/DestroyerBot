const mongoose = require('mongoose')

const deckEntrySchema = new mongoose.Schema(
  {
    deckId: { type: Number, required: true },
    deckName: { type: String, default: null },
    deckOwner: { type: String, default: null },
    alias: { type: String, default: null },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
)

const archidektUserDeckSchema = new mongoose.Schema(
  {
    discordUserId: {
      type: String,
      required: true,
      unique: true,
    },
    decks: {
      type: [deckEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

archidektUserDeckSchema.index({ discordUserId: 1 }, { unique: true, name: 'user_deck_unique' })
archidektUserDeckSchema.index({ 'decks.deckId': 1 }, { name: 'deck_lookup' })
archidektUserDeckSchema.index({ 'decks.alias': 1 }, { name: 'deck_alias_lookup', sparse: true })

module.exports = mongoose.model('ArchidektUserDeck', archidektUserDeckSchema)
