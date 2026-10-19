import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from '../src/commands.js';
if(!process.env.DISCORD_TOKEN||!process.env.CLIENT_ID) throw new Error('Set DISCORD_TOKEN and CLIENT_ID in .env');
const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
const route=process.env.GUILD_ID
  ?Routes.applicationGuildCommands(process.env.CLIENT_ID,process.env.GUILD_ID)
  :Routes.applicationCommands(process.env.CLIENT_ID);
await rest.put(route,{body:commands.map(c=>c.data.toJSON())});
console.log(`Deployed ${commands.length} slash commands ${process.env.GUILD_ID?'to the test server':'globally'}.`);
