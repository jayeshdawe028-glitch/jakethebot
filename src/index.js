import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config.js';
import { db, expireEntitlements } from './database.js';
import { commands, handleHelpButton } from './commands.js';

const client=new Client({intents:[GatewayIntentBits.Guilds]});
client.commands=new Collection(commands.map(c=>[c.data.name,c]));
client.once(Events.ClientReady, c=>{
  console.log(`[Puchki] Online as ${c.user.tag}`);
  console.log('[Puchki] Support:',config.supportUrl);
  expireEntitlements();
  setInterval(()=>{try{const n=expireEntitlements();if(n)console.log(`[Premium] expired ${n} entitlements`);}catch(e){console.error('[Premium expiry]',e);}},60*60*1000);
});
client.on(Events.InteractionCreate,async i=>{
  try {
    if(i.isChatInputCommand()) {
      const cmd=client.commands.get(i.commandName);
      if(cmd) await cmd.execute(i);
    } else if(i.isButton()&&i.customId.startsWith('help:')) {
      await handleHelpButton(i);
    }
  } catch(e) {
    console.error('[Interaction]',e);
    const payload={content:'Puchki had a small issue handling that command. Please try again.',ephemeral:true};
    if(i.deferred||i.replied) await i.followUp(payload).catch(()=>{});
    else await i.reply(payload).catch(()=>{});
  }
});
process.on('SIGINT',()=>{db.close();client.destroy();process.exit(0);});
process.on('SIGTERM',()=>{db.close();client.destroy();process.exit(0);});
await client.login(config.token);
