## Quick context

This repo is a Discord bot (Discord.js v14) that loads slash-command modules from `./commands/` and event handlers from `./events/`. Commands must export an object with `data` (a `SlashCommandBuilder`) and an `execute(interaction)` function. See `index.js` for the command/event loader and `deploy-commands.js` for how slash commands are deployed to Discord.

Key files to inspect when implementing or changing behavior:

- `index.js` — command & event bootstrap, runtime permission checks via `utils/guildSettings.js`.
- `deploy-commands.js` — how commands are discovered and deployed (guild vs global detection).
- `utils/guildSettings.js` — JSON-backed role-based command permission system (`data/guildSettings.json`).
- `commands/` — directory structure and examples (e.g. `commands/utility/help.js`, `commands/admin/listpermissions.js`).
- `README.md` and `config.json` — development/deployment steps and required config keys.

## Architecture & data flow (short)

- On startup (`index.js`) the bot recursively loads `commands/*/*.js` and stores them in `client.commands` keyed by `command.data.name`.
- Event files in `events/` are registered as `client.on` or `client.once` depending on `event.once`.
- `interactionCreate` handler in `index.js` handles autocomplete, permission checks (via `hasCommandPermission(guildId, commandName, member)`), and then calls `command.execute(interaction)`.
- Permissions are stored in `data/guildSettings.json`; `utils/guildSettings.js` provides read/write helpers and enforces a small set of default-restricted commands (e.g. `kick`, `clean`).

Why this matters to an AI agent:

- Changing command names or `data.name` must be reflected wherever the command is referenced — loader uses `command.data.name` as the key.
- Deploying commands requires running `node deploy-commands.js` — see `deploy-commands.js` to understand how guild vs global commands are detected (it checks `command.data.contexts?.includes(1)`).

## Project-specific conventions & patterns

- Command module contract: export `{ data, execute, [autocomplete] }` where `data` is a `SlashCommandBuilder`. Examples: `commands/utility/help.js`.
- Commands may set `.setContexts(...)` and `.setDefaultMemberPermissions(...)` — the deploy script reads `.data` and expects `data.toJSON()` to be valid.
- Files are discovered recursively; place new command modules under `commands/<category>/name.js`.
- Permission system: `utils/guildSettings.js` contains `DEFAULT_RESTRICTED_COMMANDS` which is also referenced in some admin commands — update both if you change defaults.
- Logging: use `logger` (Pino wrapper) for structured logs. Respect `LOG_LEVEL` env var in `.env` for verbosity.
- Ephemeral replies and embeds are used widely (see `help.js` and `listpermissions.js`). Prefer `MessageFlags.Ephemeral` for user-facing private responses.

## Developer workflows & commands

- Install deps: `npm install` (see `package.json`).
- Deploy slash commands (guild + global): `node deploy-commands.js` — required when adding/changing command definitions.
- Run bot in development: `npm run dev` (uses PM2 watch). On Windows: `npm run dev-win` (pipes to `pino-pretty`). For quick debugging you can run `node .` but the repo expects PM2 in scripts.
- Format: `npm run format` / check: `npm run format:check`.

## Integration points & external dependencies

- Discord API via `discord.js` (v14) — commands and events follow Discord.js patterns.
- External APIs used by commands: Pirate Weather (weather), Pokemon TCG API (pokemon), a 3D printer `miniAPI` endpoint (3d-print-status), and `@tcgdex/sdk` for TCG features. API keys live in `config.json`.
- Persistent state: `data/guildSettings.json` is the single local storage file for per-guild permissions. `utils/guildSettings.js` creates the file/dir if missing.

## Common pitfalls & actionable checks for PRs

- If adding a command, ensure: `module.exports = { data: <SlashCommandBuilder>, execute }` and that `data.name` is unique.
- After modifying `data` (options, names), run `node deploy-commands.js` to push changes to Discord — otherwise slash command shape may be stale in Discord.
- When changing default-restricted commands, update the `DEFAULT_RESTRICTED_COMMANDS` set in `utils/guildSettings.js` and any admin commands that reference the same set (e.g. `commands/admin/listpermissions.js`).
- Permission checks occur in `index.js` before `command.execute()`. For commands intended to run in DMs, include appropriate `.setContexts(...)` and handle guild-less interactions.

## Short examples to reference in-code

- Loader keying: `client.commands.set(command.data.name, command)` (see `index.js`).
- Permission check snippet (index.js):
  - `const hasPermission = hasCommandPermission(interaction.guild.id, interaction.commandName, interaction.member)`
  - If false -> reply ephemeral: `You don't have permission to use this command.`
- Deploy setup: `commands.push(command.data.toJSON())` and REST PUT to `Routes.applicationGuildCommands(clientId, guildId)`.

## What I did and next steps

- Created this guidance file to summarize repo-specific conventions and workflows.
- If you want, I can: add small code comments to `deploy-commands.js` and `utils/guildSettings.js`, or generate a short checklist for PR reviewers to validate new commands.

## PR reviewer checklist

Use this quick checklist when reviewing PRs that add or modify commands or permissions:

- Command module shape: verify the file exports `module.exports = { data, execute }` and `data` is a valid `SlashCommandBuilder` (see `commands/utility/help.js`).
- Unique command name: confirm `data.name` does not collide with an existing command in `commands/` and that loaders use `command.data.name` as the key (`index.js`).
- Deploy changes: if `data` (options, contexts, names) changed, the author ran `node deploy-commands.js` or documented why it's not necessary (deploys update Discord-side command schema).
- Contexts & permissions: ensure `.setContexts(...)` and `.setDefaultMemberPermissions(...)` are set when appropriate (guild-only vs DM-capable). If the command must be restricted, confirm updates to `utils/guildSettings.js` if default restrictions changed.
- DEFAULT_RESTRICTED_COMMANDS parity: if new default-restricted commands are added, update `DEFAULT_RESTRICTED_COMMANDS` in `utils/guildSettings.js` and references in admin commands like `commands/admin/listpermissions.js`.
- Data persistence: for changes touching `data/guildSettings.json`, ensure migrations are handled or documented; confirm no secrets are written to repo files (use `config.json` or env for keys).
- Logging and errors: confirm use of `logger` for important actions and that user-facing errors are ephemeral where appropriate (see `help.js` and `listpermissions.js`).
- Formatting: run `npm run format` and ensure Prettier/ESLint issues are addressed.

Please review and tell me any missing specifics you'd like included (e.g., more examples, mention of CI, or an explicit PR checklist).
