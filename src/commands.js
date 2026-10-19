import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from './config.js';
import { moderationCommands } from './moderation.js';
import { db, DAY, isOwner, getStaff, activeGuildPremium, audit } from './database.js';

const green = 0x8B5CF6;
const commandList = [
  {name:'Home',id:'help:home'},
  {name:'Security',id:'help:security'},
  {name:'Management',id:'help:management'},
  {name:'Extra',id:'help:extra'}
];
const helpPages = {
  home: {title:'🐾 Puchki • Command Center', description:'Here are the commands that are implemented in this version. Choose a category below.', fields:[
    {name:'✅ Working now',value:'`/ping` — check bot latency\n`/help` — open this command guide\n`/premium info` — check this server’s Premium status',inline:false},
    {name:'👑 Premium management',value:'Authorized owner/staff commands: activate, renew and remove server Premium. Owner-only tools manage Premium staff and user grants.',inline:false},
    {name:'🚧 Planned — not available yet',value:'Antinuke • AutoMod • AntiRaid • Tickets • Welcome/Leave • Autorole • Logging • Giveaways • Leveling',inline:false}
  ]},
  security:{title:'🛡️ Security',description:'No security protection commands are active in this version yet.',fields:[
    {name:'🚧 Planned features',value:'Antinuke • AutoMod • AntiRaid • Lockdown • Quarantine • Verification'},
    {name:'✅ Available now',value:'No security commands yet. These will appear here when implemented.'}
  ]},
  management:{title:'⚙️ Management',description:'Server management modules are planned, but not active yet.',fields:[
    {name:'🚧 Planned features',value:'Tickets • Welcome/Leave • Autorole • Logging • Join-to-Create voice'},
    {name:'✅ Available now',value:'No server management commands yet.'}
  ]},
  extra:{title:'✨ Commands you can use now',description:'Only commands currently implemented are listed here.',fields:[
    {name:'📡 General',value:'`/ping` — check whether Puchki is online and view latency\n`/help` — show this interactive command guide'},
    {name:'💎 Premium — everyone',value:'`/premium info` — check Premium status for the current server'},
    {name:'👑 Premium — authorized staff',value:'`/premium activate server-id:<ID>` — grant 30 days\n`/premium renew server-id:<ID>` — add 30 days\n`/premium remove server-id:<ID>` — remove active Premium'},
    {name:'🔒 Premium — owner only',value:'`/premium staff-add`, `staff-limit`, `staff-remove`, `staff-list`, `grant-user`, `revoke-user`, `guildlist`\nUse Discord’s slash-command options to see required arguments.'}
  ]}
};
const helpRow = active => new ActionRowBuilder().addComponents(commandList.map(c =>
  new ButtonBuilder().setCustomId(c.id).setLabel(c.name).setStyle(c.id===`help:${active}`?ButtonStyle.Primary:ButtonStyle.Secondary)
));

export const commands = [
  {
    data:new SlashCommandBuilder().setName('ping').setDescription('Check if Puchki is online.'),
    async execute(i) {
      const e=new EmbedBuilder().setColor(green).setTitle('Puchki is online! 🐾').setDescription(`Latency: **${i.client.ws.ping} ms**`)
        .setFooter({text:'Puchki • Made by AlwaysJake'});
      await i.reply({embeds:[e],ephemeral:true});
    }
  },
  {
    data:new SlashCommandBuilder().setName('help').setDescription('Open Puchki command categories.'),
    async execute(i) {
      const p=helpPages.home;
      const e=new EmbedBuilder().setColor(green).setTitle(p.title).setDescription(p.description).addFields(p.fields)
        .addFields({name:'🆘 Support Server',value:`[Join Support](${config.supportUrl})`,inline:true},{name:'▶️ Developer',value:`[AlwaysJake on YouTube](${config.youtubeUrl})`,inline:true})
        .setFooter({text:'Puchki • Built by AlwaysJake'});
      await i.reply({embeds:[e],components:[helpRow('home')],ephemeral:true});
    }
  },
  {
    data:new SlashCommandBuilder().setName('premium').setDescription('Owner and authorized staff Premium management.')
      .addSubcommand(s=>s.setName('info').setDescription('Check this server Premium status.'))
      .addSubcommand(s=>s.setName('staff-add').setDescription('Owner: allow a staff member to sell/manage Premium.')
        .addUserOption(o=>o.setName('user').setDescription('Staff user').setRequired(true))
        .addIntegerOption(o=>o.setName('limit').setDescription('Maximum active server grants').setRequired(true).setMinValue(0)))
      .addSubcommand(s=>s.setName('staff-limit').setDescription('Owner: change staff grant limit.')
        .addUserOption(o=>o.setName('user').setDescription('Staff user').setRequired(true))
        .addIntegerOption(o=>o.setName('limit').setDescription('New limit').setRequired(true).setMinValue(0)))
      .addSubcommand(s=>s.setName('staff-remove').setDescription('Owner: revoke staff access.')
        .addUserOption(o=>o.setName('user').setDescription('Staff user').setRequired(true)))
      .addSubcommand(s=>s.setName('staff-list').setDescription('Owner: list Premium staff.'))
      .addSubcommand(s=>s.setName('activate').setDescription('Give a server 30-day Premium.')
        .addStringOption(o=>o.setName('server-id').setDescription('Target server ID').setRequired(true)))
      .addSubcommand(s=>s.setName('remove').setDescription('Remove server Premium.')
        .addStringOption(o=>o.setName('server-id').setDescription('Target server ID').setRequired(true)))
      .addSubcommand(s=>s.setName('renew').setDescription('Add 30 days to active Premium.')
        .addStringOption(o=>o.setName('server-id').setDescription('Target server ID').setRequired(true)))
      .addSubcommand(s=>s.setName('grant-user').setDescription('Owner: give a user 30-day direct Premium record.')
        .addUserOption(o=>o.setName('user').setDescription('Target user').setRequired(true)))
      .addSubcommand(s=>s.setName('revoke-user').setDescription('Owner: revoke direct user Premium.')
        .addUserOption(o=>o.setName('user').setDescription('Target user').setRequired(true)))
      .addSubcommand(s=>s.setName('guildlist').setDescription('Owner: list active server Premium grants.')),
    async execute(i) {
      const sub=i.options.getSubcommand(), actor=i.user.id, owner=isOwner(actor), staff=getStaff(actor);
      const ownerOnly=['staff-add','staff-limit','staff-remove','staff-list','grant-user','revoke-user','guildlist'];
      if(ownerOnly.includes(sub)&&!owner) return i.reply({content:'Only the configured bot owner can use this command.',ephemeral:true});
      if(sub==='info') {
        const p=i.guildId?activeGuildPremium(i.guildId):null;
        const e=new EmbedBuilder().setColor(p?0x57F287:0xED4245).setTitle('Puchki Premium')
          .setDescription(p?`Premium active until <t:${Math.floor(p.expires_at/1000)}:F>.`:'No active Premium found for this server.');
        return i.reply({embeds:[e],ephemeral:true});
      }
      if(sub==='staff-add'||sub==='staff-limit') {
        const user=i.options.getUser('user',true), limit=i.options.getInteger('limit',true);
        db.prepare('INSERT INTO premium_staff(user_id,slot_limit,added_by,added_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET slot_limit=excluded.slot_limit,added_by=excluded.added_by,added_at=excluded.added_at')
          .run(user.id,limit,actor,Date.now());
        audit(actor,sub,'user',user.id,{limit});
        return i.reply({content:`Premium staff updated: <@${user.id}> • limit: **${limit}** active server grants.`,ephemeral:true});
      }
      if(sub==='staff-remove') {
        const u=i.options.getUser('user',true);
        db.prepare('DELETE FROM premium_staff WHERE user_id=?').run(u.id); audit(actor,sub,'user',u.id);
        return i.reply({content:`Premium staff access removed from <@${u.id}>. Existing grants remain active until removed/expired.`,ephemeral:true});
      }
      if(sub==='staff-list') {
        const rows=db.prepare('SELECT * FROM premium_staff ORDER BY added_at').all();
        return i.reply({content:rows.length?rows.map(r=>`<@${r.user_id}> — limit ${r.slot_limit}, active grants ${staffUsage(r.user_id)}`).join('\n'):'No Premium staff configured.',ephemeral:true});
      }
      if(sub==='guildlist') {
        const rows=db.prepare("SELECT * FROM premium_entitlements WHERE subject_type='guild' AND active=1 AND expires_at>? ORDER BY expires_at").all(Date.now());
        return i.reply({content:rows.length?rows.map(r=>`\`${r.subject_id}\` • expires <t:${Math.floor(r.expires_at/1000)}:R> • granted by <@${r.granted_by}>`).join('\n'):'No active server Premium.',ephemeral:true});
      }
      if(sub==='grant-user'||sub==='revoke-user') {
        const u=i.options.getUser('user',true), now=Date.now();
        if(sub==='grant-user') {
          db.prepare("UPDATE premium_entitlements SET active=0,removed_by=?,removed_at=? WHERE subject_type='user' AND subject_id=? AND active=1").run(actor,now,u.id);
          db.prepare("INSERT INTO premium_entitlements(subject_type,subject_id,granted_by,granted_at,expires_at,source,active) VALUES('user',?,?,?,?, 'owner',1)").run(u.id,actor,now,now+30*DAY);
        } else {
          db.prepare("UPDATE premium_entitlements SET active=0,removed_by=?,removed_at=? WHERE subject_type='user' AND subject_id=? AND active=1").run(actor,now,u.id);
        }
        audit(actor,sub,'user',u.id,{days:sub==='grant-user'?30:0});
        return i.reply({content:sub==='grant-user'?`Granted 30-day direct Premium to <@${u.id}>.`:`Direct Premium revoked for <@${u.id}>.`,ephemeral:true});
      }
      if(!owner&&!staff) return i.reply({content:'You are not authorized to manage Premium.',ephemeral:true});
      const guildId=i.options.getString('server-id',true).trim();
      if(!/^\d{17,20}$/.test(guildId)) return i.reply({content:'Enter a valid Discord server ID.',ephemeral:true});
      let p=activeGuildPremium(guildId), now=Date.now();
      if(sub==='remove') {
        if(!p) return i.reply({content:'No active Premium found for that server.',ephemeral:true});
        db.prepare('UPDATE premium_entitlements SET active=0,removed_by=?,removed_at=? WHERE id=?').run(actor,now,p.id);
        audit(actor,'premium_remove','guild',guildId,{id:p.id});
        return i.reply({content:`Premium removed from server \`${guildId}\`.`,ephemeral:true});
      }
      if(sub==='activate'&&p) return i.reply({content:`This server already has Premium until <t:${Math.floor(p.expires_at/1000)}:F>. Use /premium renew.`,ephemeral:true});
      if(sub==='renew'&&!p) return i.reply({content:'No active Premium for that server. Activate it first.',ephemeral:true});
      if(sub==='activate'&&!owner&&staffUsage(actor)>=staff.slot_limit) return i.reply({content:`Your limit is full (${staffUsage(actor)}/${staff.slot_limit}). Ask the owner to raise it or free a slot.`,ephemeral:true});
      const expires=sub==='renew'?Math.max(p.expires_at,now)+30*DAY:now+30*DAY;
      if(sub==='renew') db.prepare('UPDATE premium_entitlements SET expires_at=? WHERE id=?').run(expires,p.id);
      else db.prepare("INSERT INTO premium_entitlements(subject_type,subject_id,granted_by,granted_at,expires_at,source,active) VALUES('guild',?,?,?,?,?,1)").run(guildId,actor,now,expires,owner?'owner':'staff');
      audit(actor,sub==='renew'?'premium_renew':'premium_activate','guild',guildId,{expiresAt:expires});
      return i.reply({content:`Premium ${sub==='renew'?'renewed':'activated'} until <t:${Math.floor(expires/1000)}:F>.`,ephemeral:true});
    }
  },
  ...moderationCommands
];

export async function handleHelpButton(i) {
  const key=i.customId.split(':')[1], p=helpPages[key];
  if(!p) return;
  const e=new EmbedBuilder().setColor(green).setTitle(p.title).setDescription(p.description).addFields(p.fields)
    .addFields({name:'🆘 Support Server',value:`[Join Support](${config.supportUrl})`,inline:true},{name:'▶️ Developer',value:`[AlwaysJake on YouTube](${config.youtubeUrl})`,inline:true})
    .setFooter({text:'Puchki • Built by AlwaysJake'});
  await i.update({embeds:[e],components:[helpRow(key)]});
}
function staffUsage(userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM premium_entitlements WHERE subject_type=\'guild\' AND granted_by=? AND active=1 AND expires_at>?').get(userId,Date.now()).n;
}
