# Command Role Permission System - Implementation Guide

## Overview

Your DestroyerBot now has a complete role-based permission system that allows server administrators to control which roles can use specific commands. The system is lightweight, local (no external database), and fully compatible with Discord.js v14.

---

## Features

✅ **Per-Guild Configuration** - Each server can have its own permission settings
✅ **Role-Based Access Control** - Restrict commands to specific roles
✅ **Server Owner Privilege** - Server owners always have access to all commands
✅ **Default-Restricted Commands** - Certain sensitive commands (e.g., kick) are owner-only by default
✅ **Admin Commands** - Manage permissions via slash commands (4 commands available)
✅ **Autocomplete Support** - Dynamic command selection with smart filtering
✅ **Persistent Storage** - Settings saved locally in JSON format
✅ **Automatic Initialization** - Data directory and file created automatically
✅ **Guild-Only Admin Commands** - Permission commands restricted to servers only

---

## Files Added/Modified

### New Files

1. **`utils/guildSettings.js`** - Core permission system utilities
2. **`commands/admin/permission.js`** - Unified permission management command with 4 subcommands
3. **`data/guildSettings.json`** - Stores guild configurations (auto-generated)

### Modified Files

1. **`index.js`** - Added permission checking in interaction handler
2. **`.gitignore`** - Added `data` directory to prevent committing settings

### New Commands Added

1. **`commands/moderation/setnick.js`** - Set member nicknames (restricted to server owner by default)
2. **`commands/utility/role-list.js`** - Display comprehensive server role list
3. **`commands/utility/avatar-info.js`** - Display user avatar information

---

## How It Works

### Permission Flow

1. User executes a slash command
2. **Server owner check**: Owner always has access to all commands
3. **Default-restricted commands**: If command needs owner-only access by default
   - If no specific roles configured → Only owner can use (or assigned roles)
   - If roles configured → Users with those roles can use + owner bypasses restrictions
4. **Regular commands**: If no roles configured → ✅ Allow everyone
5. **Role requirements**: If roles are configured → Check if user has any of those roles
6. If user doesn't have required access → ❌ Block with ephemeral message

### Data Structure

```json
{
  "123456789012345678": {
    "guildId": "123456789012345678",
    "commandPermissions": {
      "kick": ["987654321098765432", "876543210987654321"],
      "ban": ["987654321098765432"],
      "ping": []
    }
  }
}
```

---

## Admin Commands

### `/permission` - Unified Permission Management

**Required Permission:** `Manage Server`
**Description:** Manage command role permissions with 4 subcommands

#### Subcommand: `list`

**Description:** View all command permissions for the current server

**Usage:**

```
/permission list
```

**Example Output:**

```
📋 Command Permissions & Status

✅ /ping
✅ Everyone can use this command

🔒 /kick
🔒 Restricted to: @Moderator, @Admin

🔒 /ban
🔒 Restricted to: @Admin
```

---

#### Subcommand: `set`

**Description:** Assign a role to a command

**Usage:**

```
/permission set command:kick role:@Moderator
/permission set command:ban role:@Admin
/permission set command:weather role:@Member
```

**Example Output:**

```
✅ Role @Moderator can now use the `/kick` command.
```

**Notes:**

- You can add multiple roles to the same command by running the command multiple times
- Command names are selected from an autocomplete dropdown (no typing required)
- Admin commands are excluded from the autocomplete list
- The role must exist in the server

---

#### Subcommand: `remove`

**Description:** Remove a specific role from a command's permission list

**Usage:**

```
/permission remove command:kick role:@Moderator
/permission remove command:weather role:@VIP
```

**Example Output:**

```
✅ Role @Moderator has been removed from the `/kick` command.
```

**Notes:**

- Only removes the specified role, other roles remain
- Command names are selected from an autocomplete dropdown
- Admin commands are excluded from the autocomplete list
- If the last role is removed, the command becomes available to everyone

---

#### Subcommand: `reset`

**Description:** Clear all command permissions for the server

**Usage:**

```
/permission reset
```

**Example Output:**

```
✅ All command permissions have been reset. Everyone can now use all commands.
```

**Warning:** This removes ALL role restrictions for the server. Use with caution.

---

### `/log`

**Required Permission:** `Manage Server`  
**Description:** Configure logging – set the destination channel, toggle events, view status, and send a test log

**Usage:**

```
/log channel set #logs                     # Set the log channel
/log channel status                        # See which channel is configured
/log events enable message.create          # Enable message create logging
/log events disable message.delete         # Disable message delete logging
/log events enable invite.create           # Enable invite create logging
/log events enable invite.delete           # Enable invite delete logging
/log events status                         # Show status for all events
/log events status message.create          # Show status for a single event
/log test                                  # Send a test embed to the log channel
```

**Example Output (events status):**

```
📊 Logging status:
✅ Message Create `message.create`
❌ Message Delete `message.delete`
✅ Invite Create `invite.create`
✅ Invite Delete `invite.delete`
```

**Notes:**

- Events only log if a channel is configured and the event is enabled
- Add more loggable events by extending the registry in `commands/admin/log/log.js`
- The command shows status after each change for quick confirmation

---

## Autocomplete Feature

The `/permission set` and `/permission remove` subcommands feature **intelligent autocomplete** for command selection:

### How It Works

- Start typing in the `command` field
- Discord shows a filtered dropdown list of available commands
- Select from the list instead of typing the full name
- Filters as you type (case-insensitive)
- Maximum 25 suggestions shown

### What's Excluded

The permission command itself is automatically excluded from autocomplete:

- `permission`

This prevents circular permission scenarios and keeps the list focused on manageable commands.

### Benefits

- ✅ No typos - select from a dropdown
- ✅ See all available commands at a glance
- ✅ Faster command selection
- ✅ Dynamic list updates as bot commands change

---

## Usage Examples

### Example 1: Restrict Moderation Commands

```bash
# Only @Moderator and @Admin can kick members
/permission set command:kick role:@Moderator
/permission set command:kick role:@Admin

# Remove a role if needed
/permission remove command:kick role:@Moderator

# Only @Admin can use ban commands
/permission set command:ban role:@Admin
```

### Example 2: Create VIP-Only Commands

```bash
# Only @VIP members can check weather
/permission set command:weather role:@VIP

# Change your mind? Remove the restriction
/permission remove command:weather role:@VIP

# Only @Premium members can use pokemon commands
/permission set command:pokemon role:@Premium
```

### Example 3: View and Manage Permissions

```bash
# Check current permissions
/permission list

# Remove a specific role from a command
/permission remove command:ping role:@Member

# Or start fresh and clear everything
/permission reset
```

---

## Technical Details

### Permission Check Logic

```javascript
// From index.js
if (interaction.guild && interaction.member) {
  const hasPermission = hasCommandPermission(
    interaction.guild.id,
    interaction.commandName,
    interaction.member
  )

  if (!hasPermission) {
    return interaction.reply({
      content: "⛔ You don't have permission to use this command.",
      flags: MessageFlags.Ephemeral,
    })
  }
}
```

### Storage Location

- **File:** `data/guildSettings.json`
- **Format:** JSON
- **Auto-created:** Yes (on first run)
- **Git-ignored:** Yes (won't be committed)

---

## Important Notes

### DM Commands

- Permission checks are **skipped for DMs** (only applies to guild commands)
- All commands work normally in DMs

### Command Names

- Use exact command names (lowercase, no spaces)
- Examples: `ping`, `kick`, `weather`, `pokemon`
- **Not:** `/ping`, `Kick`, `weather command`

### Multiple Roles

- Running `/permission set` multiple times for the same command adds more roles
- Example: Running it twice with different roles creates an OR condition
- Members need **ANY** of the configured roles, not all

### Removing Roles

You have two options for removing role restrictions:

1. **Targeted removal:** Use `/permission remove` to remove a specific role from a specific command
   - Only affects one role-command pair
   - Other roles and commands remain unchanged
2. **Complete reset:** Use `/permission reset` to clear ALL role restrictions
   - Removes all permissions for the entire server
   - Use when you want to start fresh

### Default Behavior

#### Regular Commands

- **No roles configured = Everyone can use the command**
- This is by design to maintain backward compatibility

#### Default-Restricted Commands (e.g., `/kick`)

- **No roles configured = Only server owner can use**
- **With roles configured = Users with those roles can use**
- **Server owner = Always has access** (owner bypass)
- Add roles using `/permission set` to allow non-owner access

**Currently default-restricted commands:**

- `kick` - Member management command
- `clean` - Message cleanup command
- `setnick` - Nickname management command

---

## Troubleshooting

### "You don't have permission" but you're an admin

- The system checks **roles**, not permissions
- Add your admin role to the command: `/permission set command:xyz role:@YourRole`

### Permissions not working after update

1. Redeploy commands: `bun run deploy-commands.js`
2. Restart the bot: `bun stop` then `bun start`
3. Check if `data/guildSettings.json` exists

### JSON file is missing

- The file is auto-created on first run
- If deleted, it will be recreated with empty settings
- All permissions will reset to default (everyone can use everything)

### Command not found in permission list

- Only commands with configured roles appear
- If a command isn't listed, it's available to everyone
- Add a role to make it appear: `/permission set command:name role:@SomeRole`

---

## Admin Command Overview

The permission system includes **4 main admin commands**, all requiring `Manage Server` permission:

| Command          | Purpose                                            | Guild-Only |
| ---------------- | -------------------------------------------------- | ---------- |
| `/permission`    | Manage command permissions (list/reset/set/remove) | ✅ Yes     |
| `/welcome`       | Configure welcome system (channel/message/test)    | ✅ Yes     |
| `/log`           | Configure logging (channel, events, test)          | ✅ Yes     |
| `/togglecommand` | Enable or disable commands per server              | ✅ Yes     |

**Note:** All admin commands are restricted to servers only and cannot be used in DMs. This is intentional since permissions are server-specific.

---

## Future Enhancements (Optional)

Potential improvements you could add:

- `/clearcommandrole` - Clear all roles from one specific command (without affecting others)
- Permission inheritance (role hierarchy)
- User-specific permissions (bypass role requirements)
- Permission export/import (backup and transfer settings)
- Permission templates (quick setup for common scenarios)
- Web dashboard for management
- Audit log for permission changes

---

## Support

If you encounter issues:

1. Check the bot logs (Pino logger output)
2. Verify `data/guildSettings.json` is properly formatted
3. Ensure commands are deployed: `bun run deploy-commands.js`
4. Confirm you have `Manage Server` permission

---

## License

This permission system is part of DestroyerBot (ISC License).
