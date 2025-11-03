const mongoose = require('mongoose')

const logSettingsSchema = new mongoose.Schema({
  channelId: {
    type: String,
    default: null,
  },
  messageCreate: {
    type: Boolean,
    default: true,
  },
  messageDelete: {
    type: Boolean,
    default: true,
  },
})

const guildSettingsSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
    },
    commandPermissions: {
      type: Map,
      of: [String], // Array of role IDs
      default: {},
    },
    disabledCommands: {
      type: [String], // Array of command names
      default: [],
    },
    logs: logSettingsSchema,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
)

// Create indexes for better query performance
guildSettingsSchema.index({ guildId: 1 })
guildSettingsSchema.index({ commandPermissions: 1 })

// Static method to find or create guild settings
guildSettingsSchema.statics.findOrCreate = async function (guildId) {
  let settings = await this.findOne({ guildId })
  if (!settings) {
    settings = new this({ guildId })
    await settings.save()
  }
  return settings
}

module.exports = mongoose.model('GuildSettings', guildSettingsSchema)
