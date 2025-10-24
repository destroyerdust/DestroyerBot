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

3. Create a `.env` file in the root directory and add your Discord bot token:
   ```
   BOT_TOKEN=your_discord_bot_token_here
   ```

## Usage

1. Deploy slash commands:
   ```bash
   node deploy-commands.js
   ```

2. Start the bot:
   ```bash
   npm run dev  # For development with PM2 watch
   npm start    # For production with PM2
   npm stop     # To stop the bot
   ```

3. Invite the bot to your server with the required permissions.

## Commands

### Utility Commands
- `/ping` - Replies with Pong!
- `/user-info` - Display info about yourself
- `/server` - Display comprehensive server information

### Gaming Commands
- `/rio` - Raider IO World of Warcraft information
  - `character` subcommand with required `realm` option
  - `guild` subcommand with required `realm` option

### Moderation Commands
- `/kick` - Select a member and kick them (note: this is a demo command)

### Global Commands
- `/3d-print-status` - Check 3D print status (global command accessible from all servers)

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

Environment variables (in `.env` file):
- `BOT_TOKEN`: Your Discord bot token from the Discord Developer Portal

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
