# System Patterns: DestroyerBot

## System Architecture

### Core Application Structure
```
DestroyerBot/
├── index.js                 # Main application entry point
├── deploy-commands.js       # Slash command deployment script
├── commands/                # Command modules by category
│   ├── admin/              # Administrative commands
│   ├── games/              # Gaming-related commands
│   ├── hardware/           # Hardware-specific commands
│   ├── moderation/         # Server moderation commands
│   ├── pokemon/            # Pokemon TCG commands
│   ├── utility/            # General utility commands
│   └── weather/            # Weather information commands
├── events/                 # Discord event handlers
├── models/                 # Mongoose data models
├── utils/                  # Shared utility functions
├── memory-bank/            # Project documentation
└── tests/                  # Test suites
```

### Application Flow
1. **Initialization**: Load environment variables and establish database connection
2. **Command Registration**: Deploy slash commands to configured guilds
3. **Event Binding**: Register Discord event listeners
4. **Runtime Loop**: Process incoming interactions and events
5. **Graceful Shutdown**: Clean up connections and exit

## Key Technical Decisions

### Discord.js v14 Adoption
- **Decision**: Use Discord.js v14 for modern API features and long-term support
- **Rationale**: v14 provides improved slash command handling, better TypeScript support, and active maintenance
- **Impact**: Requires Node.js 16.9+, enables modern Discord features like autocomplete and modals

### MongoDB for Data Persistence
- **Decision**: Use MongoDB with Mongoose for all data storage
- **Rationale**: Flexible schema design, horizontal scaling potential, JSON-native data format
- **Impact**: Requires connection management, schema versioning, and migration strategies

### PM2 Process Management
- **Decision**: Use PM2 for production process management
- **Rationale**: Automatic restarts, log management, cluster mode support, development watch mode
- **Impact**: Platform-specific scripts needed, log aggregation through PM2

### Pino Logging Strategy
- **Decision**: Use Pino for structured logging with development pretty-printing
- **Rationale**: High performance, structured JSON output, child loggers, transport ecosystem
- **Impact**: Log levels configurable via environment, different formatting for dev/prod

## Design Patterns

### Command Pattern
- **Implementation**: Each command is a separate module exporting a data structure and execute function
- **Benefits**: Modular command development, easy testing, clear separation of concerns
- **Structure**:
  ```javascript
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('command')
      .setDescription('Description'),
    async execute(interaction) {
      // Command logic
    }
  };
  ```

### Event Listener Pattern
- **Implementation**: Discord events handled by dedicated modules in `/events` directory
- **Benefits**: Clean event handling, easy to add/remove events, testable event logic
- **Structure**: Each event file exports a function that takes the client parameter

### Repository Pattern (Database)
- **Implementation**: Database operations abstracted through utility functions
- **Benefits**: Consistent data access, easier testing, centralized query logic
- **Location**: `/utils/database.js` and `/utils/guildSettings.js`

### Factory Pattern (Command Loading)
- **Implementation**: Dynamic command loading from filesystem structure
- **Benefits**: Zero-configuration command registration, automatic categorization
- **Location**: Main `index.js` command collection logic

## Component Relationships

### Core Components
- **Client**: Discord.js client instance (central hub)
- **Database**: MongoDB connection (data persistence)
- **Logger**: Pino logger instance (observability)
- **Commands**: Collection of command modules (functionality)
- **Events**: Collection of event handlers (reactivity)

### Data Flow
1. **User Interaction** → Discord API → Client → Command/Event Handler
2. **Command Handler** → Permission Check → Database Query → External API → Response
3. **Event Handler** → Database Update → Log Entry → Channel Message (if applicable)

### Dependency Injection
- **Logger**: Passed to command handlers for consistent logging
- **Database**: Accessed through utility functions for data operations
- **Client**: Available globally for Discord API interactions

## Critical Implementation Paths

### Command Execution Flow
```
User Slash Command
    ↓
Permission Check (guildSettings.js)
    ↓
Command Validation
    ↓
Database Operations (if needed)
    ↓
External API Calls (if applicable)
    ↓
Response Formatting
    ↓
Interaction Reply
```

### Message Logging Flow
```
Discord Event (messageCreate/messageDelete)
    ↓
Event Handler (events/messageCreate.js)
    ↓
Permission Check (guild settings)
    ↓
Content Filtering (bot messages excluded)
    ↓
Embed Creation (detailed message info)
    ↓
Channel Message (to configured log channel)
```

### Guild Settings Management
```
Admin Command (/setcommandrole)
    ↓
Permission Validation (Manage Server)
    ↓
Database Update (GuildSettings model)
    ↓
Cache Invalidation (if applicable)
    ↓
Success Confirmation
```

### Error Handling Patterns
- **Command Errors**: Caught at command level, user-friendly error messages
- **Database Errors**: Logged with Pino, graceful degradation where possible
- **API Errors**: Rate limit handling, fallback responses, timeout management
- **Discord API Errors**: Reconnection logic, permission validation

## Security Patterns

### Permission Validation
- **Role-Based Access**: Commands check user roles against configured permissions
- **Guild Isolation**: All settings scoped to individual guilds
- **Owner Commands**: Hardcoded owner ID checks for sensitive operations

### Input Validation
- **Discord.js Built-in**: Automatic input sanitization and validation
- **Custom Validation**: Additional checks for external API parameters
- **Rate Limiting**: Respect Discord API limits and external service quotas

### Data Protection
- **Environment Variables**: Sensitive data stored in .env files
- **Git Ignore**: .env files excluded from version control
- **Audit Logging**: All administrative actions logged for accountability
