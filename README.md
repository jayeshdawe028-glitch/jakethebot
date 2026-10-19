# 🐾 Puchki — Discord Bot

**A modular, Trident-inspired Discord bot** by [AlwaysJake](https://youtube.com/@alwaysjake28?si=TGA18tg170FK_jxf).

- Support server: https://discord.gg/AcD7tdJKz7
- Developer YouTube: https://youtube.com/@alwaysjake28?si=TGA18tg170FK_jxf
- Owner Discord ID: `993147236668149801`

> This is the first working starter milestone, not yet the full feature parity build. Security, ticketing, moderation, voice controls, leveling and other modules are roadmap work. Premium records are implemented, but premium-only feature gates still need to be wired into later modules.

## Features included
- `/ping` and interactive `/help` category panel with a Music category
- Hosted music playback via Lavahost/Lavalink (optional `LAVAHOST_KEY`): `/play`, `/skip`, `/pause`, `/resume`, `/stop`, `/queue`, `/247 enable`, `/247 disable`
- Moderation: `/ban`, `/kick`, `/timeout`, `/untimeout`, `/warn`, `/warnings view`, `/warnings clear`, `/purge`
- `/modsetup log-channel` and `/modsetup view` for per-server moderation logs
- Moderation warnings stored persistently in SQLite; role hierarchy and permission checks are applied
- Support server and developer promo links in help embed
- Owner-managed Premium Staff with per-staff active grant limit
- 30-day server Premium, removal, renewal, and expiry sweep
- Owner direct 30-day user Premium entitlement record
- SQLite database and Premium audit log
- Docker Compose for Oracle Ubuntu
- Slash commands plus a few prefix fun commands; no web dashboard

## Requirements
- Ubuntu 22.04/24.04 recommended, Node.js 22 (or Docker)
- Discord application created in Discord Developer Portal
- Invite scopes: `bot` and `applications.commands`
- Enable the **Message Content Intent** in Discord Developer Portal (Bot → Privileged Gateway Intents) for `p!ban`, `p!kick`, and `!Microclear` to work. The bot also uses Guild Messages and Guild Voice States intents.

## Configure
```bash
cp .env.example .env
nano .env
```
Fill in `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` (test server ID) and `OWNER_ID`. Never commit the real `.env` file.

## Run on Oracle Ubuntu with Docker
```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-v2
sudo systemctl enable --now docker
git clone https://github.com/jayeshdawe028-glitch/jakethebot.git
cd jakethebot
cp .env.example .env
nano .env
sudo docker compose build
sudo docker compose run --rm puchki node scripts/deploy-commands.js
sudo docker compose up -d
sudo docker compose logs -f puchki
```
For an existing clone, pull later changes with:
```bash
cd ~/jakethebot
git pull
sudo docker compose build
sudo docker compose run --rm puchki node scripts/deploy-commands.js
sudo docker compose up -d
```
Docker persists SQLite in `./data`.

## Local run (without Docker)
```bash
npm install
npm run deploy
npm start
```
With `GUILD_ID` set, command registration is fast for the specified test server. Remove it only when you want global slash command registration.

## Moderation commands
- `/ban user [delete-days] [reason]` — ban a member
- `/kick user [reason]` — kick a member
- `/timeout user minutes [reason]` — timeout from 1 minute up to 28 days
- `/untimeout user [reason]` — remove timeout
- `/warn user reason` — add a persistent warning
- `/warnings view user` — view active warnings; `/warnings clear user` — clear them
- `/purge amount [user]` — bulk-delete up to 100 recent messages (Discord excludes messages older than 14 days)
- `/modsetup log-channel channel` — configure a moderation log channel; `/modsetup view` — inspect setting

Fun prefix commands: `p!ban @member` and `p!kick @member` post clearly labelled prank notices only; they do not ban or kick anyone. Buttons reply with joke appeals. `!Microclear` automatically scans the current channel's latest 5,000 messages, detects text repeated 3 or more times (ignoring case and extra whitespace), and deletes all messages in those repeated-text groups, including bot-posted spam. The command message itself is preserved. It requires Manage Messages for both the invoking user and bot. This is destructive; review the channel before running it.\n\n### Music setup\n\nMusic uses a hosted Lavalink service to keep audio processing off the small VPS. Create a key at https://lavahost.net/ and add `LAVAHOST_KEY=your_lavahost_key_here` to the existing VPS `.env` (never commit the real key). Then rebuild and restart, and deploy slash commands. `/play song:<query-or-URL>` accepts song searches and YouTube/Spotify URLs when supported by the provider. `/247 enable` saves the current voice channel and attempts to rejoin after a bot restart; `/247 disable` turns it off. The free hosted plan currently advertises one simultaneous player and 100 track plays/day; check the provider dashboard for current limits. A 24/7 voice connection still depends on Discord, the hosted provider, and the bot process staying online.\n\nThe bot needs appropriate Discord permissions and a role above the members it moderates. Auto-moderation of message content is not enabled in this initial moderation update; that requires the Message Content intent and separate configuration.

## Premium commands
- `/premium staff-add user limit` — Owner grants staff rights and defines their maximum active server grants
- `/premium staff-limit user limit` — Owner changes staff limit
- `/premium staff-remove user` — Owner revokes staff access
- `/premium staff-list` — Owner lists staff and slot usage
- `/premium activate server-id` — Owner or staff activate 30-day server Premium
- `/premium remove server-id` — Owner or authorized staff remove Premium
- `/premium renew server-id` — extend active Premium by another 30 days
- `/premium info` — check the current server
- `/premium grant-user user` and `/premium revoke-user user` — owner manages a direct user entitlement
- `/premium guildlist` — Owner lists active grants

Staff can only consume their own configured slots and cannot grant staff access. Removing a server grant frees a slot. Owner is unlimited.

## Suggested roadmap
1. Core logging and permission guard utilities
2. Moderation commands and AutoMod
3. Antinuke, antiraid, lockdown
4. Interactive ticket panels
5. Join-to-Create and voice controls
6. Welcome/Leave/Autorole/Boost
7. Leveling, message/voice/invite counts
8. AutoReact, AutoRespond, Sticky, Utils, Giveaway and Premium feature gates

## Production notes
- Use a private test server first; do not start with broad administrator permissions.
- This starter does not collect or validate payments; staff should activate Premium only after payment is confirmed.
- Before public launch, add tests, interaction rate limiting, error reporting, backup/restore, and validate that target guild IDs correspond to eligible Discord servers.
