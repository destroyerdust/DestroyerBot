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
   npm install
   ```

3. Edit `config.json` in the root directory with your Discord bot details and API keys. See the [Config](#config) section below for all required parameters.

## Usage

1. Deploy slash commands:

   ```bash
   node deploy-commands.js
   ```

   The deployment script now supports multiple guilds as configured in `config.json`.

2. Start the bot:

   ```bash
   npm run dev  # For development with PM2 watch
   npm start    # For production with PM2
   npm stop     # To stop the bot
   ```

3. Invite the bot to your server with the required permissions.

## Features

### Permission System

DestroyerBot includes a comprehensive role-based permission system that allows server administrators to control which roles can use specific commands.

**Features:**

- Per-guild configuration with local JSON storage
- Role-based access control for any command
- 6 admin commands for managing permissions and logging (requires `Manage Server`)
- Autocomplete support for easy command selection
- Guild-only admin commands (cannot be used in DMs)

**Admin Commands:**

- `/setcommandrole` - Assign a role to a command
- `/removecommandrole` - Remove a role from a command
- `/listpermissions` - View all command permissions for the server
- `/resetpermissions` - Clear all command permissions
- `/setlogchannel` - Set the channel for message logging
- `/logsettings` - Enable or disable message create/delete logging

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

1. Set the log channel: `/setlogchannel channel:#logs`
2. Enable features: `/logsettings messagecreate enable` and `/logsettings messagedelete enable`
3. Enable Message Content Intent in [Discord Developer Portal](https://discord.com/developers/applications) under Bot settings
4. Restart bot and test by creating/deleting messages

---

## Commands

### Utility Commands

- `/help` - Display comprehensive information about all available bot commands (owner-only commands are hidden from regular users)
- `/ping` - Replies with Pong!
- `/user-info` - Display info about yourself
- `/server` - Display comprehensive server information
- `/role-info <role>` - Display detailed information about a server role (ID, color, permissions, member count, etc.)
- `/channel-info [channel]` - Display detailed information about a channel (defaults to current channel, supports all channel types)

### Gaming Commands

- `/rio` - Raider IO World of Warcraft information
  - `character` subcommand with required `realm` option
  - `guild` subcommand with required `realm` option

### Moderation Commands

- `/kick` - Select a member and kick them (note: this is a demo command)

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

- `npm run dev` - Start the bot with PM2 watch mode
- `npm run dev-win` / `npm run dev-unix` - Platform-specific development commands
- `npm start` - Start the bot in production mode with PM2
- `npm stop` - Stop the bot
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting with Prettier
- `npm test` - Run tests (placeholder script)

### Tools

- **ESLint**: Code linting with `.eslintrc.json` configuration
- **Prettier**: Code formatting with `.prettierrc.json` configuration
- **Pino**: Advanced logging library for better log management

## Deployment

The bot is designed to run with PM2 for process management. Use the provided scripts or run PM2 commands directly.

For production deployment, ensure you have PM2 installed globally and set up your environment variables.

## Config

Edit `config.json` in the root directory with your Discord bot details and API keys. Full configuration example:

```json
{
  "clientId": "your_discord_client_id",
  "guildIds": ["your_guild_id_1", "your_guild_id_2"],
  "token": "your_discord_bot_token",
  "ownerId": "your_discord_user_id",
  "miniAPI": "your_3d_printer_api_endpoint_url",
  "pirateWeatherApiKey": "your_pirate_weather_api_key",
  "pokemonApiKey": "your_pokemon_tcg_api_key",
  "raiderIOApiKey": "your_raider_io_api_key"
}
```

### Configuration Parameters:

- `clientId`: Your Discord application client ID
- `guildIds`: Array of server/guild IDs for command deployment
- `token`: Your Discord bot token from the Discord Developer Portal
- `ownerId`: Your Discord user ID (required for private commands like 3d-print-status)
- `miniAPI`: URL for your 3D printer's telemetry API (required for 3d-print-status command)
- `pirateWeatherApiKey`: Free API key obtained from [pirateweather.net](https://pirateweather.net/) (required for weather command)
- `pokemonApiKey`: Free API key obtained from [pokemontcg.io](https://pokemontcg.io/) (required for pokemon command)
- `raiderIOApiKey`: Optional API key obtained from [raider.io](https://raider.io/) (provides higher rate limits for WoW character/guild lookups)

## Environment Variables

Create a `.env` file in the root directory (automatically ignored by .gitignore):

```
LOG_LEVEL=debug
```

- `LOG_LEVEL`: Set the logging level (default: info, options: trace, debug, info, warn, error, fatal)

This controls the verbosity of Pino logging throughout the application.

## Database

Currently, no database is configured. Commands operate with in-memory data or external API calls.

## Logging

Logs are handled by the Pino logger library and output through PM2.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run `npm run format` before committing
4. Submit a pull request

## License

ISC License - see LICENSE file for details
