# System Patterns: DestroyerBot

## System Architecture

### Core Application Structure

```
DestroyerBot/
├── index.js                 # Main application entry point
├── deploy-commands.js       # Slash command deployment script
├── logger.js               # Pino logger configuration
├── commands/               # Command modules by category
│   ├── admin/             # Administrative commands
│   │   ├── togglecommand.js
│   │   ├── log/           # Message logging commands
│   │   │   └── log.js
│   │   ├── welcome/       # Welcome system commands
│   │   │   └── welcome.js
│   │   └── permissions/   # Permission management
│   │       ├── listpermissions.js
│   │       ├── removecommandrole.js
│   │       ├── resetpermissions.js
│   │       └── setcommandrole.js
│   ├── games/             # Gaming commands
│   │   ├── rio.js
│   │   └── wow.js
│   ├── hardware/          # Hardware monitoring
│   │   └── 3d-print-status.js
│   ├── moderation/        # Server moderation
│   │   ├── kick.js
│   │   └── setnick.js
│   ├── pokemon/           # Pokemon TCG
│   │   ├── pokemon.js
│   │   └── test.js
│   ├── utility/           # Utility commands
│   │   ├── clean.js
│   │   ├── help.js
│   │   ├── info/          # Info lookup commands
│   │   │   ├── avatar-info.js
│   │   │   ├── channel-info.js
│   │   │   ├── role-info.js
│   │   │   ├── role-list.js
│   │   │   ├── server-info.js
│   │   │   └── user-info.js
│   │   └── status/        # Bot status commands
│   │       ├── bot-stats.js
│   │       └── ping.js
│   └── weather/           # Weather commands
│       └── weather.js
├── events/                # Discord event handlers
│   ├── guildCreate.js
│   ├── guildDelete.js
│   ├── guildMemberAdd.js
│   ├── guildMemberRemove.js
│   ├── messageCreate.js
│   ├── messageDelete.js
│   ├── messageUpdate.js
│   ├── presenceUpdate.js
│   └── voiceStateUpdate.js
├── models/                # Mongoose data models
│   └── GuildSettings.js
├── utils/                 # Shared utility functions
│   ├── database.js
│   ├── guildSettings.js
│   ├── migrateLogsToNested.js
│   └── migrateToMongoDB.js
├── memory-bank/           # Project documentation
│   ├── projectbrief.md
│   ├── productContext.md
│   ├── activeContext.md
│   ├── systemPatterns.md
│   ├── techContext.md
│   └── progress.md
└── Configuration Files
    ├── package.json
    ├── .env.example
    ├── .eslintrc.json
    ├── .prettierrc.json
    └── .gitignore
```

### Application Flow

1. **Initialization**:
   - Load environment variables from .env
   - Create Discord.js Client with required intents
   - Establish database connection
   - Initialize logger

2. **Command Registration**:
   - Recursively discover all .js files in /commands directory
   - Load command modules (supports nested folder structure)
   - Store commands in Collection indexed by command name
   - Log successful command loading

3. **Event Binding**:
   - Discover all event files in /events directory
   - Bind event handlers to client
   - Support both once() and on() event patterns
   - Track loaded events for debugging

4. **Bot Ready**:
   - Log bot initialization with detailed stats
   - Connect to MongoDB database
   - Run database migrations if needed
   - Enable performance monitoring in development
   - Set up periodic performance checks

5. **Runtime Loop**:
   - Listen for interactions (slash commands, autocomplete)
   - Validate permissions for guild commands
   - Execute command handlers
   - Log all activities with structured logging

6. **Graceful Shutdown**:
   - Close database connections
   - Stop event listeners
   - Clean up resources
   - Exit process

## Key Technical Decisions

### Discord.js v14+ Full Compliance

- **Decision**: Maintain strict v14+ compliance across all code
- **Rationale**: Latest stable version with modern API, active maintenance, better TypeScript support
- **Implementation**:
  - All commands use SlashCommandBuilder for command definition
  - Proper handling of interaction context and options
  - Autocomplete implementation for dynamic options
  - Ephemeral messages for sensitive information
  - Embed formatting for rich responses
- **Impact**:
  - Requires Node.js 16.9+
  - Enables modern Discord features (buttons, select menus, modals)
  - Future-proof for Discord API updates
  - Better tooling and type support

### MongoDB with Mongoose for Data Persistence

- **Decision**: Use MongoDB + Mongoose for all persistent data
- **Rationale**:
  - Flexible schema design for evolving requirements
  - JSON-native document format matches JavaScript
  - Horizontal scaling potential with sharding
  - Strong query optimization through indexing
- **Implementation**:
  - GuildSettings model stores all guild-specific configuration
  - Connection pooling for efficient resource usage
  - Automatic reconnection on connection loss
  - 9 optimized indexes for query performance
- **Impact**:
  - Requires MongoDB instance (local or Atlas)
  - Schema versioning and migrations handled by utility scripts
  - All data survives bot restarts

### PM2 Process Management

- **Decision**: Use PM2 for production and development process management
- **Rationale**:
  - Automatic restart on crashes
  - Log management and aggregation
  - Development watch mode for testing changes
  - Cluster mode support for scaling
- **Implementation**:
  - `npm run dev` watches for file changes (development)
  - `npm start` runs production instance
  - `npm stop` cleanly stops the bot
  - PM2 logs accessible via `pm2 logs`
- **Impact**:
  - Platform integration for process management
  - Reliable production deployment
  - Enhanced logging and monitoring

### Pino Structured Logging

- **Decision**: Use Pino for all logging with environment-aware formatting
- **Rationale**:
  - High performance structured logging
  - JSON output for production log aggregation
  - Pretty-printing for development readability
  - Child logger support for contextual logging
- **Implementation**:
  - Centralized logger in logger.js
  - Pino-pretty for development (NODE_ENV !== 'production')
  - Structured data included with log entries
  - Multiple log levels (debug, info, warn, error)
- **Impact**:
  - Production-ready observability
  - Development logging aids debugging
  - Easy integration with log aggregation services

### Nested Command Organization

- **Decision**: Organize commands in logical category subfolders
- **Rationale**:
  - Improves code navigation and discoverability
  - Categories group related functionality
  - Subfolders organize by function within category
  - Better scalability as command count grows
- **Implementation**:
  - Recursive file discovery in index.js
  - Dynamic path handling via `getAllJsFiles()` function
  - Commands organized: admin, games, hardware, moderation, pokemon, utility, weather
  - Further subdivision: admin (logging, welcome, permissions), utility (info, status)
- **Impact**:
  - No impact on performance (discovered at startup)
  - Improved developer experience and code organization
  - Easier to locate and modify specific commands

## Design Patterns

### Command Pattern (Discord.js v14+)

- **Structure**: Each command exports an object with `data` and `execute` properties
- **Data**: SlashCommandBuilder instance defining command properties
  ```javascript
  data: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('Description')
    .addStringOption((option) => option.setName('param').setDescription('Param'))
  ```
- **Execute**: Async function handling the interaction
  ```javascript
  async execute(interaction) {
    await interaction.reply({ content: 'Response' })
  }
  ```
- **Optional**: Autocomplete handler for dynamic options
  ```javascript
  async autocomplete(interaction) {
    // Return autocomplete suggestions
  }
  ```
- **Benefits**:
  - Modular command development
  - Easy testing and mocking
  - Clear separation of declaration and execution
  - Supports advanced features (autocomplete, options)

### Event Listener Pattern

- **Implementation**: Dedicated modules in `/events` directory
- **Structure**: Each event file exports an object with `name`, `once`, and `execute` properties
  ```javascript
  module.exports = {
    name: 'eventName',
    once: false, // true for one-time listeners
    execute(client, ...args) {
      // Event handling logic
    },
  }
  ```
- **Benefits**:
  - Clean event handling separation
  - Easy to add/remove events without modifying index.js
  - Events are testable in isolation
  - Supports both persistent and one-time listeners

### Repository Pattern (Database)

- **Implementation**: Database operations abstracted through utility functions
- **Location**: `/utils/database.js` and `/utils/guildSettings.js`
- **Pattern**:
  - All database queries go through utility functions
  - Commands never directly call MongoDB methods
  - Utilities handle connection management and error handling
  - Consistent error responses across all queries
- **Benefits**:
  - Centralized database logic
  - Easier testing with mocking
  - Simplified error handling
  - Schema changes isolated to utilities

### Factory Pattern (Command Loading)

- **Implementation**: Dynamic command loading via `getAllJsFiles()` function
- **Process**:
  - Recursively discover all .js files in /commands directory
  - Load and register each command module
  - Store in Collection indexed by command name
  - Handle nested folder structures automatically
- **Benefits**:
  - Zero-configuration command registration
  - Automatic categorization via folder structure
  - Easy to add new commands (just create file)
  - Scalable to large command sets

### Caching Pattern (Guild Settings)

- **Implementation**: Settings loaded on-demand and cached in memory
- **Process**:
  - Permission checks query cached guild settings
  - Cache miss triggers database query
  - Results stored in memory for subsequent requests
  - Cache invalidation on settings update
- **Benefits**:
  - Reduced database queries for repeated permission checks
  - Faster permission validation during command execution
  - Minimal latency for common operations

## Component Relationships

### Core Components

- **Client**: Discord.js Client instance (central hub for all bot functionality)
- **Database**: MongoDB connection (persistent data storage)
- **Logger**: Pino logger (structured logging and observability)
- **Commands**: Collection of command modules (user-facing functionality)
- **Events**: Collection of event handlers (bot reactivity)
- **GuildSettings**: Mongoose model (guild configuration schema)

### Data Flow Architecture

```
User Interaction (Slash Command)
    ↓
Discord API → Client Event Listener
    ↓
index.js: interactionCreate handler
    ↓
Permission Check (via guildSettings.js)
    ├─→ Guild settings in memory cache?
    │   └─→ No: Query MongoDB
    │       └─→ Cache result
    ├─→ User has permission?
    │   └─→ No: Return ephemeral error
    └─→ Yes: Continue
    ↓
Command Lookup (client.commands Collection)
    ↓
Command Validation (v14+ interaction handling)
    ↓
Database Operations if needed (via database.js utilities)
    ├─→ Query MongoDB
    └─→ Handle errors gracefully
    ↓
External API Calls if applicable
    ├─→ Raider.IO, Pokemon TCG, Weather API
    └─→ Timeout and error handling
    ↓
Response Formatting (Embeds, ephemeral flags)
    ↓
Interaction Reply (via interaction.reply())
    ↓
Logging (Pino logger with context)
```

### Event Flow Architecture

```
Discord Event (messageCreate, messageDelete, etc.)
    ↓
Client Event Listener (in /events/)
    ↓
Event Validation
    ├─→ Is this a bot message?
    ├─→ Is logging enabled for this guild?
    └─→ Are we authorized to log?
    ↓
Database Query (get guild settings)
    ↓
Formatting (Create detailed embed with context)
    ↓
Channel Message (to configured log channel)
    ↓
Error Handling & Logging
```

## Critical Implementation Paths

### Command Execution Flow (v14+ Compliant)

```
1. User sends slash command in Discord
2. Discord API sends interactionCreate event
3. Client emits event with interaction object
4. index.js interactionCreate handler triggered

5. CHECK: interaction.isChatInputCommand()?
   No → Return (skip non-chat commands)

6. Lookup command: client.commands.get(interaction.commandName)
   Not found → Return (command doesn't exist)

7. CHECK: interaction.guild exists?
   Yes → Continue with permission check
   No  → Skip permission check (DM command)

8. PERMISSION CHECK: hasCommandPermissionAsync()
   ├─→ Get guild settings from database
   ├─→ Extract user roles from interaction.member
   ├─→ Check if role has command permission
   └─→ Return boolean result

9. Access denied?
   Yes → interaction.reply with ephemeral error message, return

10. Execute command: await command.execute(interaction)
    ├─→ Try/catch block around execution
    └─→ Handle errors gracefully

11. Error caught?
    Yes → interaction.reply with generic error message
    No  → Continue with command response

12. Logging: Log command execution with context
```

### Permission Validation System

```
Command executed with interaction
    ↓
Call: hasCommandPermissionAsync(guildId, commandName, member)
    ↓
Query: GuildSettings.findOne({ guildId })
    ├─→ Error in query? Return true (allow access, continue)
    └─→ Settings found? Continue
    ↓
Check: permissions[commandName] role array
    ├─→ Not configured? Return true (allow access, no restrictions)
    ├─→ Empty array? Return false (deny access, explicitly disabled)
    └─→ Array has roles? Continue
    ↓
Loop: Check each required role
    ├─→ User has role? Set permission = true
    └─→ Continue to next role
    ↓
Decision: Return permission boolean
    ├─→ true: Allow command execution
    └─→ false: Deny with ephemeral error
```

### Database Query Optimization

```
Command needs guild data
    ↓
Call database utility function
    ↓
Check: Does query use optimized index?
    ├─→ Yes: Fast covered query (< 5ms typical)
    ├─→ No: Index scan (slower, but still fast with indexing)
    └─→ No index: Full collection scan (slow, should not happen)
    ↓
Return results
    ↓
Cache results in memory (if applicable)
    ↓
Process results in command
    ↓
Return to user
```

### External API Fallback Pattern

```
Command needs external API data (Pokemon, WoW stats, Weather)
    ↓
Make API request with timeout (3-5 seconds)
    ├─→ Success? Parse and return data
    ├─→ Timeout? Show error to user, log timeout
    └─→ Error? Show error to user, log details
    ↓
Format response
    ↓
Send to user (or cached response if available)
```

## Error Handling Patterns

### Command-Level Error Handling (v14+ Pattern)

- **Pattern**: Try/catch blocks in command.execute()
- **Implementation**:
  ```javascript
  try {
    await interaction.reply({ content: 'Response' })
  } catch (error) {
    logger.error({ error: error.message }, 'Command execution failed')
    await interaction.reply({
      content: 'An error occurred',
      flags: MessageFlags.Ephemeral,
    })
  }
  ```
- **Benefits**: Commands isolated from crashing bot

### Database Error Handling

- **Pattern**: Connection errors logged, graceful degradation
- **Implementation**:
  - Connection failures don't crash bot
  - Commands fail gracefully with error messages
  - Automatic reconnection attempted
  - Detailed error logging with context
- **Benefits**: Bot remains operational even if database unavailable

### Permission Error Handling

- **Pattern**: Permission denials logged separately from access errors
- **Logging Levels**:
  - Permission denied: WARN level (security-relevant)
  - Check error: ERROR level (system problem)
  - Access granted: DEBUG level (normal operation)
- **Benefits**: Security monitoring and troubleshooting

### API Error Handling

- **Pattern**: External API errors don't crash bot or compromise user experience
- **Implementation**:
  - Timeout handling (3-5 second limits)
  - Rate limit respect
  - Fallback responses
  - Error messages to users
  - Detailed error logging
- **Benefits**: Resilient to external service issues

## Security Patterns

### Permission Validation

- **Role-Based Access Control (RBAC)**: Commands restricted by Discord roles
- **Guild Isolation**: All settings scoped to individual guilds
- **Database Query Isolation**: Guild queries filtered by guildId
- **Owner Commands**: Hardcoded owner ID checks for sensitive operations
- **Autocomplete Security**: Autocomplete respects permission settings

### Input Validation

- **Discord.js Built-in**: Automatic input sanitization via SlashCommandBuilder
- **Custom Validation**: Additional checks for external API parameters
- **Type Checking**: All options validated by Discord.js types
- **Length Limits**: Messages and inputs limited to Discord constraints

### Data Protection

- **Environment Variables**: Sensitive data in .env (Discord token, database URL, API keys)
- **Git Ignore**: .env files excluded from version control
- **Audit Logging**: All administrative actions logged for accountability
- **No Secrets in Logs**: Sensitive data filtered from log output

### Rate Limiting

- **Discord API Limits**: Respected globally (50 requests/second)
- **External API Limits**: Handled per service (Pokemon TCG, Raider.IO, Weather)
- **Command Usage**: Per-user command cooldowns (implementation planned)
- **Graceful Degradation**: Rate limit responses show user-friendly messages

## Performance Optimization Patterns

### Database Query Performance

- **Indexes**: 9 strategic indexes for common queries
- **Covered Queries**: Query results include only indexed fields
- **Batch Operations**: Multiple documents processed in single query
- **Pagination**: Large result sets paged for efficiency
- **Monitoring**: Slow queries logged for analysis (> 100ms in development)

### Memory Management

- **Guild Settings Cache**: In-memory caching of frequently accessed settings
- **Command Collection**: Efficient Collection data structure for lookups
- **Event Listeners**: Single listener per event (not per-command)
- **Garbage Collection**: Proper cleanup of resources

### Request Optimization

- **Lazy Task Execution**: Database queries only when needed
- **Connection Pooling**: Reuse database connections
- **Batch API Calls**: Combine multiple lookups when possible
- **Response Caching**: Cache API responses for repeated queries

## Code Organization Principles

### Modularity

- Each command is independent and testable
- Event handlers isolated in separate files
- Utility functions grouped by concern (database, settings, logging)
- Models define schema structure separately from usage

### Consistency

- All commands follow same data/execute structure
- Error handling patterns consistent across codebase
- Logging format standardized with Pino
- Code style enforced with ESLint/Prettier

### Maintainability

- Clear file naming (command name matches file name)
- Logical folder organization (by category and function)
- Documentation via comments (focusing on "why")
- Memory bank documents overall patterns and decisions
