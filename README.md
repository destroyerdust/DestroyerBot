# DestroyerBot

[![Known Vulnerabilities](https://snyk.io/test/github/destroyerdust/DestroyerBot/badge.svg)](https://snyk.io/test/github/destroyerdust/DestroyerBot)

A personal Discord bot built with Discord.js v14, featuring utility commands, gaming stats integration, and server moderation tools.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/destroyerdust/DestroyerBot.git
   cd DestroyerBot
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Copy `.env.example` to `.env` and fill in your Discord bot details and API keys:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your actual values. See the [Environment Variables](#environment-variables) section below for all required parameters.

## Usage

1. Deploy slash commands:

   ```bash
   bun run deploy-commands.js
   ```

   The deployment script now supports multiple guilds as configured in `.env`.

2. Start the bot:

   ```bash
   bun run dev  # For development with PM2 watch
   bun start    # For production with PM2
   bun stop     # To stop the bot
   ```

3. Invite the bot to your server with the required permissions.

## Features

### Welcome System

Let new members know they're in the right place using the `/welcome` command suite.

**Features:**

- Configure welcome channel with `/welcome channel set` plus quick status checks
- Customize welcome copy with `/welcome message set|show`, including preview output
- Toggle, status overview, and test sends (`/welcome toggle|status|test`)
- Per-guild settings persisted to MongoDB with JSON fallback for resilience

### Permission System

DestroyerBot includes a comprehensive role-based permission system that allows server administrators to control which roles can use specific commands.

**Features:**

- Per-guild configuration with local JSON storage
- Role-based access control for any command
- 5 admin commands for managing permissions and logging (requires `Manage Server`)
- Autocomplete support for easy command selection
- Guild-only admin commands (cannot be used in DMs)

**Admin Commands:**

- `/setcommandrole` - Assign a role to a command
- `/removecommandrole` - Remove a role from a command
- `/listpermissions` - View all command permissions for the server
- `/resetpermissions` - Clear all command permissions
- `/log` - Configure logging channels and event toggles (including channel set/status and test)

📖 **[View Complete Permission System Documentation](PERMISSIONS_GUIDE.md)**

### Message Logging System

An automated moderation logging system that tracks message activities in Discord servers.

**Features:**

- Automatic logging of message creation and deletion events
- Detailed embeds showing author, channel, timestamp, and content (when available)
- Audit log integration to identify who deleted messages
- Per-guild configuration with enable/disable toggles
- Extensive debugging support for troubleshooting
- Human-readable embed format with clear information

**Requirements:**

- Bot needs `View Audit Logs` permission for deletion details
- Bot needs `Message Content Intent` enabled in Developer Portal (privileged intent)
- Guild members need appropriate permissions for admin commands

**What Gets Logged:**

- **Message Creations**: Who posted, where, when, and the message content (if bot has proper intents)
- **Message Deletions**: Who deleted, which message was removed, original author, and content (when cached)
- **Filtering**: Bot messages and DMs are automatically excluded

**Setup Steps:**

1. Set the log channel: `/log channel set #logs`
2. Enable features: `/log events enable message.create` and `/log events enable message.delete`
3. Enable Message Content Intent in [Discord Developer Portal](https://discord.com/developers/applications) under Bot settings
4. Restart bot and test by creating/deleting messages

---

## Commands

### Utility Commands

- `/help` - Display comprehensive information about all available bot commands (owner-only commands are hidden from regular users)
- `/ping` - Replies with Pong!
- `/user-info` - Display info about yourself
- `/server-info` - Display comprehensive server information including channels, roles, members, and features
- `/role-info <role>` - Display detailed information about a server role (ID, color, permissions, member count, etc.)
- `/role-list` - Display a complete list of all server roles sorted by hierarchy with member counts and color indicators
- `/channel-info [channel]` - Display detailed information about a channel (defaults to current channel, supports all channel types)
- `/avatar-info [user]` - Display a user's avatar with high-quality image and download links (defaults to command user)

### Gaming Commands

- `/rio` - Raider IO World of Warcraft information
  - `character` subcommand with required `realm` option
  - `guild` subcommand with required `realm` option

- `/archidekt` - Archidekt deck lookup and card search
  - `deck` subcommand with optional `deck_id` or `alias` (uses your default linked deck if omitted): Show deck summary, owner, and card count
  - `search` subcommand with required `query` and optional `deck_id` or `alias`: Find cards by `oracleCard.name` (case-insensitive) with safe, truncated results
  - `link` (with optional alias + default flag) / `unlink` (by deck_id or alias) / `default` (show or set) / `list` to manage multiple linked decks per user

- `/wow` - World of Warcraft information and utilities
  - `realm` subcommand with required `realm` option and optional `region` option: Get realm status, population, and connected realm information
  - `token` subcommand with optional `region` option: Get current WoW Token prices and market data
  - Uses Blizzard API (requires `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` environment variables)

### Moderation Commands

- `/kick` - Select a member and kick them (note: this is a demo command)
- `/setnick` - Set a member's nickname in the server (server owner only by default, configurable via permission system)

### Administrative Commands

- `/welcome` - Configure the welcome system (channel, message, toggle, status, test)
- `/log` - Configure logging (channel, event toggles, status, test)
- `/togglecommand` - Enable or disable individual commands per guild
- `/setcommandrole`, `/removecommandrole`, `/listpermissions`, `/resetpermissions` - Manage command-level permissions

### Global Commands

- `/3d-print-status` - Check 3D print status (private command, only accessible by bot owner and hidden from help for regular users)
- `/weather` - Get current weather for a location
  - Required `location` option: City name (e.g., "New York" or "London,UK")
  - Optional `units` option: Temperature units (Celsius (default), Fahrenheit, or Canadian)
  - Uses Pirate Weather API (free, government weather data)
  - Responses are private/ ephemeral (only visible to the command user)

### Pokemon Commands

- `/pokemon` - Pokemon TCG card information
  - `search` subcommand with required `query` option: Search cards by name (e.g., "charizard")
  - `random` subcommand: Get a random Pokemon card
  - Uses Pokemon TCG API (free with API key)
  - Shows card images, stats, types, prices, and more

## Development

### Scripts

- `bun run dev` - Start the bot with PM2 watch mode
- `bun run dev-win` / `bun run dev-unix` - Platform-specific development commands
- `bun start` - Start the bot in production mode with PM2
- `bun stop` - Stop the bot
- `bun run format` - Format code with Prettier
- `bun run format:check` - Check code formatting with Prettier
- `bun test` - Run tests (placeholder script)

### Tools

- **ESLint**: Code linting with `.eslintrc.json` configuration
- **Prettier**: Code formatting with `.prettierrc.json` configuration
- **Pino**: Advanced logging library for better log management
- **Husky**: Pre-commit hook runs `bun format` to enforce Prettier before commits (installed via the `prepare` script run during `bun install`; if the hook is missing, run `bun run prepare`)

### Project Documentation

The project includes comprehensive memory bank documentation located in `/memory-bank/`:

- **projectbrief.md** - Project overview, core requirements, and success criteria
- **productContext.md** - Product vision, problems solved, and user experience goals
- **systemPatterns.md** - System architecture, design patterns, and implementation flows
- **techContext.md** - Technology stack and development setup
- **activeContext.md** - Current work focus, recent changes, and next steps
- **progress.md** - Feature status, development progress, and future roadmap

These files provide detailed context for understanding the project architecture and contributing effectively.

## Deployment

The bot is designed to run with PM2 for process management. Use the provided scripts or run PM2 commands directly.

For production deployment, ensure you have PM2 installed globally and set up your environment variables.

## Environment Variables

Create a `.env` file in the root directory (automatically ignored by .gitignore). Full configuration example:

```
CLIENT_ID=your_discord_client_id
GUILD_IDS=your_guild_id_1,your_guild_id_2
TOKEN=your_discord_bot_token
OWNER_ID=your_discord_user_id
MINI_API=your_3d_printer_api_endpoint_url
PIRATE_WEATHER_API_KEY=your_pirate_weather_api_key
POKEMON_API_KEY=your_pokemon_tcg_api_key
RAIDER_IO_API_KEY=your_raider_io_api_key
BLIZZARD_CLIENT_ID=your_blizzard_api_client_id
BLIZZARD_CLIENT_SECRET=your_blizzard_api_client_secret
NOMINATIM_CONTACT=your_contact_email_for_geocoding
MONGO_CONNECTION_STRING=mongodb+srv://username:password@cluster.mongodb.net/
MONGO_DATABASE_NAME=database_name
LOG_LEVEL=debug
```

### Configuration Parameters:

- `CLIENT_ID`: Your Discord application client ID
- `GUILD_IDS`: Comma-separated list of server/guild IDs for command deployment
- `TOKEN`: Your Discord bot token from the Discord Developer Portal
- `OWNER_ID`: Your Discord user ID (required for private commands like 3d-print-status)
- `MINI_API`: URL for your 3D printer's telemetry API (required for 3d-print-status command)
- `PIRATE_WEATHER_API_KEY`: Free API key obtained from [pirateweather.net](https://pirateweather.net/) (required for weather command)
- `POKEMON_API_KEY`: Free API key obtained from [pokemontcg.io](https://pokemontcg.io/) (required for pokemon command)
- `RAIDER_IO_API_KEY`: Optional API key obtained from [raider.io](https://raider.io/) (provides higher rate limits for WoW character/guild lookups)
- `BLIZZARD_CLIENT_ID`: Your Blizzard API client ID obtained from [Battle.net Developer Portal](https://develop.battle.net/) (required for wow command)
- `BLIZZARD_CLIENT_SECRET`: Your Blizzard API client secret obtained from [Battle.net Developer Portal](https://develop.battle.net/) (required for wow command)
- `MONGO_CONNECTION_STRING`: MongoDB connection string for database storage
- `MONGO_DATABASE_NAME`: Name of the MongoDB database to use
- `LOG_LEVEL`: Set the logging level (default: info, options: trace, debug, info, warn, error, fatal)
- `NOMINATIM_CONTACT`: Contact email used with the Nominatim geocoding API (per their usage policy)

## Database

The bot uses MongoDB with Mongoose for persistent data storage, including guild settings, permissions, and logging configurations. Configure the `MONGO_CONNECTION_STRING` and `MONGO_DATABASE_NAME` environment variables to connect to your MongoDB instance.

## Logging

Logs are handled by the Pino logger library and output through PM2.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run `bun run format` before committing
4. Submit a pull request

## License

ISC License - see LICENSE file for details
