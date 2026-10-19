import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from '../src/commands.js';

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  throw new Error('Set DISCORD_TOKEN and CLIENT_ID in .env');
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const commandData = commands.map(command => command.data.toJSON());

if (process.env.GUILD_ID) {
  // Replace the selected server's command list with the current commands.
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commandData },
  );

  // Remove stale global commands from older versions of this same application.
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: [] },
  );

  console.log(`Deployed ${commandData.length} slash commands to the configured server and cleared old global commands.`);
} else {
  // Replace the global command list with only the current commands.
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commandData },
  );
  console.log(`Deployed ${commandData.length} global slash commands.`);
}
