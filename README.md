# ZootBot (ZootCraft)

Discord bot for managing a Minecraft server on exaroton, with live chat relay and status tracking.

## Features
- Slash commands for server control and community tools
- exaroton REST integration for start/stop/restart/status/players
- WebSocket status stream with auto-reconnect and live chat relay
- Status embed that updates in place
- Role-based access control for sensitive commands
- Player-facing `/help` command with a clear feature overview

## Requirements
- Node.js (LTS recommended)
- Discord bot token and application client ID
- exaroton API token and server ID

## Setup
Install dependencies:
```bash
npm ci
```

Create `.env`:
```bash
cat > .env << 'EOF'
DISCORD_TOKEN=your_discord_token
CLIENT_ID=your_client_id
EXAROTON_TOKEN=your_exaroton_token
EXAROTON_SERVER_ID=your_exaroton_server_id
EXAROTON_STATUS_CHANNEL_ID=your_status_channel_id
EXAROTON_CONSOLE_CHANNEL_ID=your_console_channel_id
EXAROTON_DEBUG=true
EOF
```

Register slash commands (run after changes to `commands/`):
```bash
node deploy.js
```

Start the bot:
```bash
node index.js
```

## Commands (high level)
- `/server start|stop|restart|status|players`
- `/op add|remove`
- `/help`
- `/announce`
- `/announcements subscribe|unsubscribe`
- `/say`
- `/clear`
- `/color`
- `/tag add|remove`

## Permissions
Some commands require roles listed in `ALLOWED_ROLE_IDS` within the command files. Update those IDs to match your server.

## Live Chat
- Minecraft -> Discord: console chat lines are forwarded to `EXAROTON_CONSOLE_CHANNEL_ID`.
- Discord -> Minecraft: messages in that channel are sent to the server via the console stream.

## Status Embed
The bot maintains a single status embed in `EXAROTON_STATUS_CHANNEL_ID`. It will create the embed if missing and update it as status events arrive. The embed includes server status, address, player count, and player list.

## Logging
- Console logs include command and event registration, plus useful debug output.
- Command usage logs are sent to a fixed log channel in `utils/logging.js`.

## Notes
- Keep `.env` private and rotate tokens if they are exposed.
- Update the log channel ID in `utils/logging.js` to your own server.
