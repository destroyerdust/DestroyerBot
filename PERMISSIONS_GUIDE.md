# Command Role Permission System - Implementation Guide

## Overview

Your DestroyerBot now has a complete role-based permission system that allows server administrators to control which roles can use specific commands. The system is lightweight, local (no external database), and fully compatible with Discord.js v14.

---

## Features

✅ **Per-Guild Configuration** - Each server can have its own permission settings  
✅ **Role-Based Access Control** - Restrict commands to specific roles  
✅ **Default Open Access** - Commands with no roles configured are available to everyone  
✅ **Admin Commands** - Manage permissions via slash commands  
✅ **Persistent Storage** - Settings saved locally in JSON format  
✅ **Automatic Initialization** - Data directory and file created automatically

---

## Files Added/Modified

### New Files

1. **`utils/guildSettings.js`** - Core permission system utilities
2. **`commands/admin/setcommandrole.js`** - Set role permissions
3. **`commands/admin/listpermissions.js`** - View current permissions
4. **`commands/admin/resetpermissions.js`** - Clear all permissions
5. **`data/guildSettings.json`** - Stores guild configurations (auto-generated)

### Modified Files

1. **`index.js`** - Added permission checking in interaction handler
2. **`.gitignore`** - Added `data` directory to prevent committing settings

---

## How It Works

### Permission Flow

1. User executes a slash command
2. Bot checks if command has role restrictions for that guild
3. If **no roles** are configured → ✅ Allow everyone
4. If **roles are configured** → Check if user has any of those roles
5. If user doesn't have required role → ❌ Block with ephemeral message

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

### `/setcommandrole`

**Required Permission:** `Manage Server`  
**Description:** Assign a role to a command

**Usage:**

```
/setcommandrole command:kick role:@Moderator
/setcommandrole command:ban role:@Admin
/setcommandrole command:weather role:@Member
```

**Example Output:**

```
✅ Role @Moderator can now use the `/kick` command.
```

**Notes:**

- You can add multiple roles to the same command by running the command multiple times
- Command names should match exactly (e.g., `ping`, `kick`, `weather`)
- The role must exist in the server

---

### `/listpermissions`

**Required Permission:** `Manage Server`  
**Description:** View all command permissions for the current server

**Usage:**

```
/listpermissions
```

**Example Output:**

```
📋 Command Permissions

/kick
🔒 Restricted to: @Moderator, @Admin

/ban
🔒 Restricted to: @Admin

/ping
✅ Everyone can use this command
```

---

### `/resetpermissions`

**Required Permission:** `Manage Server`  
**Description:** Clear all command permissions for the server

**Usage:**

```
/resetpermissions
```

**Example Output:**

```
✅ All command permissions have been reset. Everyone can now use all commands.
```

**Warning:** This removes ALL role restrictions for the server. Use with caution.

---

## Usage Examples

### Example 1: Restrict Moderation Commands

```bash
# Only @Moderator and @Admin can kick members
/setcommandrole command:kick role:@Moderator
/setcommandrole command:kick role:@Admin

# Only @Admin can use ban commands
/setcommandrole command:ban role:@Admin
```

### Example 2: Create VIP-Only Commands

```bash
# Only @VIP members can check weather
/setcommandrole command:weather role:@VIP

# Only @Premium members can use pokemon commands
/setcommandrole command:pokemon role:@Premium
```

### Example 3: View and Reset

```bash
# Check current permissions
/listpermissions

# If you want to start fresh
/resetpermissions
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

- Running `/setcommandrole` multiple times for the same command adds more roles
- Example: Running it twice with different roles creates an OR condition
- Members need **ANY** of the configured roles, not all

### Removing Roles

- Currently, roles can only be removed by using `/resetpermissions` (clears all)
- To modify: Reset, then re-add the roles you want

### Default Behavior

- **No roles configured = Everyone can use the command**
- This is by design to maintain backward compatibility

---

## Troubleshooting

### "You don't have permission" but you're an admin

- The system checks **roles**, not permissions
- Add your admin role to the command: `/setcommandrole command:xyz role:@YourRole`

### Permissions not working after update

1. Redeploy commands: `node deploy-commands.js`
2. Restart the bot: `npm stop` then `npm start`
3. Check if `data/guildSettings.json` exists

### JSON file is missing

- The file is auto-created on first run
- If deleted, it will be recreated with empty settings
- All permissions will reset to default (everyone can use everything)

### Command not found in listpermissions

- Only commands with configured roles appear
- If a command isn't listed, it's available to everyone
- Add a role to make it appear: `/setcommandrole command:name role:@SomeRole`

---

## Future Enhancements (Optional)

Potential improvements you could add:

- `/removecommandrole` - Remove specific role from a command
- `/clearcommandrole` - Clear all roles from one command
- Permission inheritance (role hierarchy)
- User-specific permissions
- Permission export/import
- Web dashboard for management

---

## Support

If you encounter issues:

1. Check the bot logs (Pino logger output)
2. Verify `data/guildSettings.json` is properly formatted
3. Ensure commands are deployed: `node deploy-commands.js`
4. Confirm you have `Manage Server` permission

---

## License

This permission system is part of DestroyerBot (ISC License).
