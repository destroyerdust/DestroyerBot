# Technical Context: DestroyerBot

## Technology Stack

### Core Runtime

- **Node.js**: Server-side JavaScript runtime
- **Discord.js v14**: Official Discord API library for bot interactions
- **PM2**: Process manager for production deployment and monitoring

### Data Storage

- **MongoDB**: NoSQL database for persistent data storage
- **Mongoose**: ODM for MongoDB with schema validation and middleware

### External APIs

- **Raider.IO API**: World of Warcraft character and guild statistics
- **Pokemon TCG API**: Pokemon card database and information
- **Archidekt API**: Magic: The Gathering deck data and card search
- **Pirate Weather API**: Free weather data service (government data)
- **Discord API**: Core bot functionality and slash commands

### Development Tools

- **Bun**: Package manager/runtime for dependency management and scripts
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting and consistency
- **Pino**: Advanced logging library with structured output
- **Pino-Pretty**: Development-friendly log formatting

## Development Setup

### Environment Requirements

- Node.js 16.9.0 or higher (Discord.js v14 requirement)
- MongoDB instance (local or cloud)
- Discord Bot Token and Application ID
- API keys for external services (optional but recommended)

### Local Development

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with actual values

# Deploy commands to test guilds
node deploy-commands.js

# Start development server
bun run dev  # PM2 watch mode
```

### Production Deployment

```bash
# Start production server
bun start  # PM2 production mode

# Stop server
bun stop
```

## Technical Constraints

### Discord API Limitations

- Rate limits: 50 requests per second globally
- Command deployment limited to configured guilds
- Message content intent required for logging features
- Privileged intents need explicit enabling

### Database Constraints

- MongoDB connection required for guild settings persistence
- Schema migrations needed for data structure changes
- Connection pooling and error handling required

### Performance Considerations

- Command responses should be < 3 seconds
- Memory usage should remain stable under load
- Database queries should be optimized for common operations
- External API calls should implement proper error handling

## Dependencies Overview

### Production Dependencies

- `discord.js@^14.24.2`: Core Discord bot functionality
- `mongoose@^8.19.2`: MongoDB object modeling
- `dotenv@^17.2.3`: Environment variable management
- `@tcgdex/sdk@^2.7.1`: Pokemon TCG API client
- `pino@^10.1.0`: Structured logging

### Development Dependencies

- `eslint@^9.39.0`: Code linting
- `prettier@^3.6.2`: Code formatting
- `pino-pretty@^13.1.2`: Development log formatting

## Tool Usage Patterns

### Code Quality

- **ESLint**: Run automatically on file changes, fix issues with `bun run format`
- **Prettier**: Format all code with `bun run format`, check with `bun run format:check`
- **Git Hooks**: Pre-commit hooks ensure code quality before commits

### Logging Strategy

- **Pino Logger**: Structured JSON logging for production
- **Log Levels**: Configurable via LOG_LEVEL environment variable
- **PM2 Integration**: Logs managed through PM2 process manager
- **Development**: Pino-pretty for human-readable development logs

### Database Patterns

- **Mongoose Models**: Schema-based data modeling in `/models` directory
- **Guild Isolation**: All settings scoped to individual Discord guilds
- **Migration Scripts**: Database updates handled through utility scripts
- **Connection Management**: Centralized database utilities in `/utils`

### Command Architecture

- **Modular Structure**: Commands organized by category in `/commands` directory
- **Permission Checks**: Role-based access control for sensitive commands
- **Error Handling**: Comprehensive error catching with user-friendly messages
- **Autocomplete**: Dynamic command options where applicable

### Event Handling

- **Event Listeners**: Discord events processed in `/events` directory
- **Message Logging**: Automated moderation event tracking
- **Guild Management**: Dynamic guild configuration loading
- **Presence Tracking**: Voice state and member activity monitoring
