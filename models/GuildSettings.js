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
  messageUpdate: {
    type: Boolean,
    default: true,
  },
})

const welcomeSettingsSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false,
  },
  channelId: {
    type: String,
    default: null,
  },
  message: {
    type: String,
    default: 'Welcome to the server!',
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
    welcome: welcomeSettingsSchema,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
)

// Create optimized indexes for better query performance
// Note: guildId index is automatically created by unique: true constraint

// Essential single-field indexes for frequent queries
guildSettingsSchema.index({ disabledCommands: 1 }, { name: 'disabled_commands' })
guildSettingsSchema.index({ 'logs.channelId': 1 }, { name: 'log_channel' })
guildSettingsSchema.index({ 'welcome.channelId': 1 }, { name: 'welcome_channel' })

// Critical compound indexes for common query patterns
guildSettingsSchema.index(
  {
    guildId: 1,
    disabledCommands: 1,
  },
  { name: 'guild_disabled_commands' }
)

guildSettingsSchema.index(
  {
    guildId: 1,
    'logs.channelId': 1,
  },
  { name: 'guild_log_channel' }
)

guildSettingsSchema.index(
  {
    guildId: 1,
    'welcome.enabled': 1,
    'welcome.channelId': 1,
  },
  { name: 'guild_welcome_settings' }
)

// Permission query optimization with partial index
guildSettingsSchema.index(
  {
    guildId: 1,
    commandPermissions: 1,
  },
  {
    name: 'guild_command_permissions',
    partialFilterExpression: {
      commandPermissions: { $exists: true, $ne: {} },
    },
  }
)

// Sparse indexes for optional features (only index active configurations)
guildSettingsSchema.index(
  {
    'logs.channelId': 1,
  },
  {
    name: 'active_log_channels',
    sparse: true,
    partialFilterExpression: {
      'logs.channelId': { $ne: null },
    },
  }
)

guildSettingsSchema.index(
  {
    'welcome.channelId': 1,
  },
  {
    name: 'active_welcome_channels',
    sparse: true,
    partialFilterExpression: {
      'welcome.enabled': true,
      'welcome.channelId': { $ne: null },
    },
  }
)

// Query performance indexes for maintenance and analytics
guildSettingsSchema.index(
  {
    updatedAt: 1,
    guildId: 1,
  },
  { name: 'recent_updates' }
)

guildSettingsSchema.index(
  {
    createdAt: 1,
  },
  { name: 'creation_date' }
)

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
