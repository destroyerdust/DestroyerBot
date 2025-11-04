# Project Brief: DestroyerBot

## Overview
DestroyerBot is a comprehensive Discord bot built with Discord.js v14, designed to provide utility commands, gaming integrations, server moderation tools, and advanced permission management for Discord servers.

## Core Requirements
- **Discord Integration**: Full Discord.js v14 implementation with slash commands
- **Permission System**: Role-based access control for commands with per-guild configuration
- **Message Logging**: Automated moderation logging for message creation/deletion events
- **Gaming Features**: Integration with Raider.IO (WoW), Pokemon TCG API, and weather services
- **Moderation Tools**: Server management commands (kick, nickname setting)
- **Utility Commands**: Server/channel/user information, help system, ping tests
- **Database Storage**: MongoDB persistence for guild settings and permissions
- **Process Management**: PM2-based deployment and monitoring

## Technical Scope
- Node.js application with modern JavaScript (ES6+)
- Event-driven architecture with Discord.js event handlers
- Modular command structure with category organization
- Environment-based configuration management
- Comprehensive error handling and logging
- Code formatting and linting standards

## Success Criteria
- Bot successfully deploys slash commands to configured guilds
- Permission system allows fine-grained access control
- Message logging captures and reports moderation events
- All gaming/utility commands function correctly
- Database operations maintain data integrity
- Application runs stably under PM2 process management
- Code passes linting and formatting checks

## Constraints
- Must use Discord.js v14 (latest stable version)
- Requires MongoDB for data persistence
- Must support multiple guilds with isolated configurations
- Owner-only commands must remain secure
- API rate limits must be respected for external services
