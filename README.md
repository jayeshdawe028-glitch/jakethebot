# 🐾 Puchki — Discord Bot

**A modular, Trident-inspired Discord bot** by [AlwaysJake](https://youtube.com/@alwaysjake28?si=TGA18tg170FK_jxf).

- Support server: https://discord.gg/AcD7tdJKz7
- Developer YouTube: https://youtube.com/@alwaysjake28?si=TGA18tg170FK_jxf
- Owner Discord ID: `993147236668149801`

> This is the first working starter milestone, not yet the full feature parity build. Security, ticketing, moderation, voice controls, leveling and other modules are roadmap work. Premium records are implemented, but premium-only feature gates still need to be wired into later modules.

## Features included
- `/ping` and interactive `/help` category panel
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
- Enable the **Message Content Intent** in Discord Developer Portal (Bot → Privileged Gateway Intents) for `p!ban`, `p!kick`, and `!Microclear` to work. The bot also uses Guild Messages intent.

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

Fun prefix commands: `p!ban @member` and `p!kick @member` post clearly labelled prank notices only; they do not ban or kick anyone. Buttons reply with joke appeals. `!Microclear <text>` searches the current channel's latest 5,000 messages and deletes every message containing the supplied text, including bot-posted spam; the command message itself is preserved. It requires Manage Messages for both the invoking user and bot. This is destructive, so check the search phrase before running it.\n\nThe bot needs appropriate Discord permissions and a role above the members it moderates. Auto-moderation of message content is not enabled in this initial moderation update; that requires the Message Content intent and separate configuration.

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
