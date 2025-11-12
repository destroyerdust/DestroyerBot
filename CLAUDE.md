# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DestroyerBot is a personal Discord bot built with Discord.js v14. Features include utility commands, gaming stats integration (WoW/Raider.IO, Pokemon TCG), server moderation tools, a role-based permission system, and message logging capabilities.

**Key Tech Stack:**

- Discord.js v14 (slash commands, embeds, autocomplete)
- MongoDB + Mongoose (persistent storage with optimized indexes)
- PM2 (process management, development watch mode)
- Pino (structured logging)
- Node.js 16.9+

## Essential Commands

### Development Workflow

```bash
# Install dependencies
npm install

# Deploy slash commands to Discord (required after any command changes)
node deploy-commands.js

# Run bot in development (PM2 watch mode)
npm run dev

# Run bot without PM2 (useful for debugging)
node .

# Start bot in production (PM2)
npm start

# Stop bot
npm stop

# Format code
npm run format
```

### Running Individual Commands

- **Direct execution:** `node .` (no PM2, good for immediate testing)
- **Windows dev with pretty logs:** `npm run dev-win` (pipes to pino-pretty)
- **Unix dev with pretty logs:** `npm run dev-unix`

### Command Deployment

**CRITICAL:** After modifying any `SlashCommandBuilder` in a command file (name, description, options, contexts), you MUST run `node deploy-commands.js` to push changes to Discord. The bot will not reflect command definition changes until deployed.

## High-Level Architecture

### Bot Initialization Flow (index.js)

1. Load environment variables from `.env`
2. Create Discord Client with required Gateway Intents (Guilds, GuildMembers, GuildMessages, GuildPresences, GuildVoiceStates, MessageContent)
3. **Recursive Command Discovery:** Scan `commands/` directory recursively, load all `.js` files, store in `client.commands` Collection keyed by `command.data.name`
4. **Event Handler Registration:** Load all event modules from `events/`, register as `client.on()` or `client.once()` based on `event.once` property
5. On `clientReady` event:
   - Connect to MongoDB via `utils/database.js`
   - Run automatic migration from JSON to MongoDB (`utils/migrateToMongoDB.js`)
   - Enable database performance monitoring in non-production environments
6. **Runtime Command Execution:**
   - Listen for `interactionCreate` events
   - Handle autocomplete requests via `command.autocomplete(interaction)`
   - **Permission Validation:** Check role-based permissions via `hasCommandPermissionAsync(guildId, commandName, member)` from `utils/guildSettings.js`
   - Execute command via `command.execute(interaction)`

### Data Persistence: Dual-Layer Architecture

**MongoDB Primary + JSON Backup Strategy:**

- All guild settings stored in MongoDB (`models/GuildSettings.js`) as primary data source
- JSON file (`data/guildSettings.json`) maintained as backup/fallback
- All write operations update both MongoDB and JSON
- Read operations prefer MongoDB, fall back to JSON on connection failure
- Automatic migration on startup converts legacy JSON-only data to MongoDB

**GuildSettings Model Structure:**

```javascript
{
  guildId: String (unique, indexed),
  commandPermissions: Map<commandName, [roleIds]>,
  disabledCommands: [commandNames],
  logs: {
    channelId: String,
    messageCreate: Boolean,
    messageDelete: Boolean
  },
  welcome: {
    enabled: Boolean,
    channelId: String,
    message: String
  },
  timestamps: { createdAt, updatedAt }
}
```

**Performance Optimization:** 9 strategic indexes on GuildSettings collection for fast queries (guild_disabled_commands, guild_log_channel, guild_welcome_settings, etc.). Use `getGuildSettingsOptimized()` for covered queries.

### Permission System

**Role-Based Access Control (RBAC):**

- Permissions stored per-guild in `commandPermissions` Map
- **Default-Restricted Commands:** `['kick', 'clean', 'setnick']` (defined in `utils/guildSettings.js:13`)
- Server owner always bypasses all permission checks
- If a command has no configured roles AND is not default-restricted → everyone can use it
- If a command has no configured roles AND is default-restricted → only owner can use it
- If a command has configured roles → only users with those roles (or owner) can use it

**Permission Check Flow (index.js:179-212):**

1. Command received → Check if in guild (skip permission check for DMs)
2. Call `hasCommandPermissionAsync(guildId, commandName, member)`
3. If permission denied → reply with ephemeral error, log warning
4. If permission granted → execute command

### Command Module Contract

**Required Exports:**

```javascript
module.exports = {
  data: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('Description')
    .setContexts([...])
    .setDefaultMemberPermissions(...),

  async execute(interaction) {
    // Command logic here
  },

  // Optional: for dynamic option suggestions
  async autocomplete(interaction) {
    // Return autocomplete choices
  }
}
```

**Command Organization:**

- Commands organized in `commands/<category>/<name>.js`
- Categories: `admin`, `games`, `hardware`, `moderation`, `pokemon`, `utility`, `weather`
- Further subdivision: `admin/logging/`, `admin/welcome/`, `admin/permissions/`, `utility/info/`, `utility/status/`
- Loader in `index.js` recursively discovers all `.js` files via `getAllJsFiles()` function

### Event Handler Contract

**Required Exports:**

```javascript
module.exports = {
  name: 'eventName', // Discord.js event name (e.g., 'messageCreate')
  once: false, // true for one-time listeners
  execute(...args) {
    // Event handling logic
    // Process event
  },
}
```

Events in `events/` directory: `guildCreate.js`, `guildDelete.js`, `guildMemberAdd.js`, `guildMemberRemove.js`, `messageCreate.js`, `messageDelete.js`, `messageUpdate.js`, `presenceUpdate.js`, `voiceStateUpdate.js`

### Database Query Patterns

**Prefer Async MongoDB Functions:**

- Use `*Async()` variants from `utils/guildSettings.js` (e.g., `hasCommandPermissionAsync`, `getGuildSettingsAsync`)
- These handle MongoDB-first with automatic JSON fallback
- For batch operations, use `getMultipleGuildSettings()` or `checkMultiplePermissions()` to reduce query count

**Common Utility Functions:**

- `utils/guildSettings.js` - All guild settings operations (permissions, logging, welcome messages)
- `utils/database.js` - MongoDB connection management, performance monitoring, index analysis
- `models/GuildSettings.js` - Mongoose schema with `findOrCreate()` static method

## Important Conventions

### Command Development

1. **Command Naming:** `command.data.name` must be unique across all commands (loader uses this as Collection key)
2. **Guild vs Global Commands:** Commands with `.setContexts([1])` (InteractionContextType.Guild) are deployed globally; all commands are deployed to guilds specified in `GUILD_IDS` env var
3. **Ephemeral Replies:** Use `{ flags: MessageFlags.Ephemeral }` for private user responses (permissions errors, sensitive info)
4. **Embeds for Rich Output:** Use EmbedBuilder for formatted responses (see `commands/utility/help.js`)

### Permission System Updates

When adding default-restricted commands:

1. Update `DEFAULT_RESTRICTED_COMMANDS` Set in `utils/guildSettings.js:13`
2. Update any admin commands that reference the same set (e.g., `commands/admin/permissions/listpermissions.js`)
3. Document the restriction in README.md

### Logging

- Use the centralized `logger` from `logger.js` (Pino-based)
- Include structured context: `logger.info({ guildId, userId, commandName }, 'Message')`
- Respect `LOG_LEVEL` environment variable (trace, debug, info, warn, error, fatal)
- Development: Pretty-printed logs via pino-pretty
- Production: JSON logs for aggregation

### Error Handling

- **Command-level:** Wrap `command.execute()` in try/catch, reply with ephemeral error message
- **Permission errors:** Logged at WARN level (security-relevant), shown as ephemeral to user
- **Database errors:** Logged at ERROR level, fallback to JSON, bot continues running
- **API errors:** Timeout handling (3-5s), user-friendly error messages, detailed logging

## Integration Points

### External APIs

- **Raider.IO:** WoW character/guild stats (`/rio` command) - Optional API key in `RAIDER_IO_API_KEY`
- **Blizzard API:** WoW realm status, token prices (`/wow` command) - Requires `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET`
- **Pokemon TCG API:** Card search (`/pokemon` command) - Requires `POKEMON_API_KEY` from pokemontcg.io
- **Pirate Weather API:** Weather data (`/weather` command) - Requires `PIRATE_WEATHER_API_KEY` from pirateweather.net
- **3D Printer API:** Custom hardware monitoring (`/3d-print-status` command, owner-only) - Requires `MINI_API` endpoint URL

### Environment Variables

Required in `.env` file:

- `CLIENT_ID` - Discord application client ID
- `GUILD_IDS` - Comma-separated guild IDs for command deployment
- `TOKEN` - Discord bot token
- `OWNER_ID` - Discord user ID for owner-only commands
- `MONGO_CONNECTION_STRING` - MongoDB connection string
- `MONGO_DATABASE_NAME` - MongoDB database name
- `LOG_LEVEL` - Logging verbosity (default: info)

Optional (feature-specific):

- `MINI_API`, `PIRATE_WEATHER_API_KEY`, `POKEMON_API_KEY`, `RAIDER_IO_API_KEY`, `BLIZZARD_CLIENT_ID`, `BLIZZARD_CLIENT_SECRET`

## Critical Implementation Details

### Command Loader Keying

- `client.commands.set(command.data.name, command)` in `index.js:47`
- Changing `data.name` breaks references - update all code that looks up the command

### Deploy Script Logic (deploy-commands.js)

- Discovers commands via `getCommandFiles()` recursive scan
- **Global detection:** Checks if `command.data.contexts?.includes(1)` (InteractionContextType.Guild)
- Deploys to all guilds in `GUILD_IDS` + deploys global commands application-wide
- Validates `data` and `execute` properties exist before deployment

### Permission Check Location

- **Entry point:** `index.js:178-212` in `interactionCreate` handler
- Calls `hasCommandPermissionAsync()` before `command.execute()`
- Skips check for DM commands (no guild context)
- Owner check in `utils/guildSettings.js:1007-1010`

### Database Migration

- Automatic migration from JSON to MongoDB on bot startup (`index.js:88`)
- Migration script: `utils/migrateToMongoDB.js`
- Checks for existing data in MongoDB before migrating
- Preserves JSON file as backup even after migration

### Message Logging System

- Events: `messageCreate.js`, `messageDelete.js`, `messageUpdate.js`
- Configuration via `/setlogchannel` and `/logsettings` commands
- Requires `Message Content Intent` enabled in Discord Developer Portal (privileged intent)
- Audit log integration for deletion tracking (requires `View Audit Logs` permission)

## Testing and Debugging

### Quick Debug Workflow

1. Make code changes
2. If command structure changed: `node deploy-commands.js`
3. Run `node .` for immediate testing (no PM2, direct console output)
4. Check logs for errors with structured context
5. Test in Discord with slash command

### Performance Monitoring

- Development mode enables slow query logging (> 100ms)
- Periodic performance checks every 30 minutes (`index.js:133-151`)
- Database metrics available via `utils/database.js` functions:
  - `analyzeIndexUsage()` - Index usage statistics
  - `getDatabaseMetrics()` - Database size, collections, indexes
  - `getSlowQueries(limit)` - Recent slow queries from system.profile

### Common Pitfalls

1. **Forgot to deploy:** Command changes not reflected in Discord → Run `node deploy-commands.js`
2. **Permission system not checked:** New restricted command accessible to everyone → Add to `DEFAULT_RESTRICTED_COMMANDS` or configure roles
3. **MongoDB connection failure:** Bot continues with JSON fallback, but slower performance
4. **Missing Message Content Intent:** Message logging shows empty content → Enable in Discord Developer Portal
5. **Command name collision:** Loader overwrites previous command → Ensure unique `data.name` values

## Code Style and Formatting

- **ESLint:** Configuration in `.eslintrc.json`
- **Prettier:** Configuration in `.prettierrc.json`
- Run `npm run format` before committing
- Check formatting with `npm run format:check`

## Additional Documentation

Comprehensive project documentation in `/memory-bank/`:

- `projectbrief.md` - Project overview, requirements, success criteria
- `productContext.md` - Product vision, user experience goals
- `systemPatterns.md` - Detailed architecture, design patterns, data flows
- `techContext.md` - Technology stack, development setup
- `activeContext.md` - Current work focus, recent changes
- `progress.md` - Feature status, roadmap
