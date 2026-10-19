import 'dotenv/config';

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'OWNER_ID'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key}. Copy .env.example to .env and configure it.`);
  }
}

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  ownerId: process.env.OWNER_ID,
  databasePath: process.env.DATABASE_PATH || './data/puchki.sqlite',
  supportUrl: process.env.SUPPORT_SERVER_URL || 'https://discord.gg/AcD7tdJKz7',
  youtubeUrl: process.env.DEVELOPER_YOUTUBE_URL || 'https://youtube.com/@alwaysjake28?si=TGA18tg170FK_jxf',
  lavahostKey: process.env.LAVAHOST_KEY || null
};
