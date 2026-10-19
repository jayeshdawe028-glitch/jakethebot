import {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { db } from './database.js';

db.exec(`
CREATE TABLE IF NOT EXISTS moderation_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS moderation_config (
  guild_id TEXT PRIMARY KEY,
  log_channel_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_mod_warnings ON moderation_warnings(guild_id,user_id,active);
`);

const deny = (i, message) => i.reply({ content: message, ephemeral: true });
function canModerate(i, permission) {
  return i.memberPermissions?.has(permission) && i.guild;
}
async function targetCheck(i, member) {
  if (!member) return 'That member is not in this server.';
  if (member.id === i.user.id) return 'You cannot target yourself.';
  if (member.id === i.guild.ownerId) return 'You cannot moderate the server owner.';
  const moderator = await i.guild.members.fetch(i.user.id);
  if (member.roles.highest.position >= moderator.roles.highest.position && i.guild.ownerId !== i.user.id)
    return 'Your highest role must be above the target member’s highest role.';
  const bot = await i.guild.members.fetchMe();
  if (member.roles.highest.position >= bot.roles.highest.position)
    return 'Puchki’s highest role must be above the target member’s highest role.';
  return null;
}
async function logAction(guild, title, description, color=0x8B5CF6) {
  const row = db.prepare('SELECT log_channel_id FROM moderation_config WHERE guild_id=?').get(guild.id);
  if (!row?.log_channel_id) return;
  const channel = await guild.channels.fetch(row.log_channel_id).catch(()=>null);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
  await channel.send({embeds:[embed]}).catch(()=>{});
}
function reasonOption(s) {
  return s.addStringOption(o=>o.setName('reason').setDescription('Reason (optional)').setMaxLength(500));
}

export const moderationCommands = [
  {
    data: new SlashCommandBuilder().setName('ban').setDescription('Ban a member from this server.')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption(o=>o.setName('user').setDescription('Member to ban').setRequired(true))
      .addIntegerOption(o=>o.setName('delete-days').setDescription('Delete their messages from the last 0–7 days').setMinValue(0).setMaxValue(7))
      .addStringOption(o=>o.setName('reason').setDescription('Reason').setMaxLength(500)),
    async execute(i) {
      if (!canModerate(i, PermissionFlagsBits.BanMembers)) return deny(i,'You need the Ban Members permission.');
      const user=i.options.getUser('user',true), reason=i.options.getString('reason')||'No reason provided';
      if (user.id===i.user.id || user.id===i.guild.ownerId) return deny(i,'You cannot ban yourself or the server owner.');
      const member=await i.guild.members.fetch(user.id).catch(()=>null);
      if (member) { const error=await targetCheck(i,member); if(error) return deny(i,error); }
      const me=await i.guild.members.fetchMe();
      if (!me.permissions.has(PermissionFlagsBits.BanMembers)) return deny(i,'Puchki needs the Ban Members permission.');
      await i.guild.members.ban(user,{reason:`${reason} | Moderator: ${i.user.tag}`,deleteMessageSeconds:(i.options.getInteger('delete-days')||0)*86400});
      await logAction(i.guild,'Member banned',`**User:** <@${user.id}> (${user.id})\n**Moderator:** <@${i.user.id}>\n**Reason:** ${reason}`,0xED4245);
      return i.reply({content:`Banned **${user.tag}**. Reason: ${reason}`,ephemeral:true});
    }
  },
  {
    data: new SlashCommandBuilder().setName('kick').setDescription('Kick a member from this server.')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption(o=>o.setName('user').setDescription('Member to kick').setRequired(true))
      .addStringOption(o=>o.setName('reason').setDescription('Reason').setMaxLength(500)),
    async execute(i) {
      if (!canModerate(i,PermissionFlagsBits.KickMembers)) return deny(i,'You need the Kick Members permission.');
      const user=i.options.getUser('user',true), member=await i.guild.members.fetch(user.id).catch(()=>null);
      if (!member) return deny(i,'That member is not in this server.');
      const error=await targetCheck(i,member); if(error) return deny(i,error);
      if (!(await i.guild.members.fetchMe()).permissions.has(PermissionFlagsBits.KickMembers)) return deny(i,'Puchki needs the Kick Members permission.');
      const reason=i.options.getString('reason')||'No reason provided';
      await member.kick(`${reason} | Moderator: ${i.user.tag}`);
      await logAction(i.guild,'Member kicked',`**User:** <@${user.id}>\n**Moderator:** <@${i.user.id}>\n**Reason:** ${reason}`,0xED4245);
      return i.reply({content:`Kicked **${user.tag}**. Reason: ${reason}`,ephemeral:true});
    }
  },
  {
    data: new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member for a duration.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o=>o.setName('user').setDescription('Member to timeout').setRequired(true))
      .addIntegerOption(o=>o.setName('minutes').setDescription('Duration in minutes (1–40320)').setRequired(true).setMinValue(1).setMaxValue(40320))
      .addStringOption(o=>o.setName('reason').setDescription('Reason').setMaxLength(500)),
    async execute(i) {
      if (!canModerate(i,PermissionFlagsBits.ModerateMembers)) return deny(i,'You need the Moderate Members permission.');
      const user=i.options.getUser('user',true), member=await i.guild.members.fetch(user.id).catch(()=>null);
      const error=await targetCheck(i,member); if(error) return deny(i,error);
      if (!(await i.guild.members.fetchMe()).permissions.has(PermissionFlagsBits.ModerateMembers)) return deny(i,'Puchki needs the Moderate Members permission.');
      const minutes=i.options.getInteger('minutes',true), reason=i.options.getString('reason')||'No reason provided';
      await member.timeout(minutes*60000,`${reason} | Moderator: ${i.user.tag}`);
      await logAction(i.guild,'Member timed out',`**User:** <@${user.id}>\n**Duration:** ${minutes} minute(s)\n**Moderator:** <@${i.user.id}>\n**Reason:** ${reason}`,0xFAA61A);
      return i.reply({content:`Timed out **${user.tag}** for ${minutes} minute(s).`,ephemeral:true});
    }
  },
  {
    data: new SlashCommandBuilder().setName('untimeout').setDescription('Remove a member timeout.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o=>o.setName('user').setDescription('Member to untimeout').setRequired(true))
      .addStringOption(o=>o.setName('reason').setDescription('Reason').setMaxLength(500)),
    async execute(i) {
      if (!canModerate(i,PermissionFlagsBits.ModerateMembers)) return deny(i,'You need the Moderate Members permission.');
      const user=i.options.getUser('user',true), member=await i.guild.members.fetch(user.id).catch(()=>null);
      const error=await targetCheck(i,member); if(error) return deny(i,error);
      if (!(await i.guild.members.fetchMe()).permissions.has(PermissionFlagsBits.ModerateMembers)) return deny(i,'Puchki needs the Moderate Members permission.');
      const reason=i.options.getString('reason')||'No reason provided';
      await member.timeout(null,`${reason} | Moderator: ${i.user.tag}`);
      await logAction(i.guild,'Timeout removed',`**User:** <@${user.id}>\n**Moderator:** <@${i.user.id}>\n**Reason:** ${reason}`);
      return i.reply({content:`Removed timeout for **${user.tag}**.`,ephemeral:true});
    }
  },
  {
    data: new SlashCommandBuilder().setName('warn').setDescription('Issue a persistent warning to a member.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o=>o.setName('user').setDescription('Member to warn').setRequired(true))
      .addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)),
    async execute(i) {
      if (!canModerate(i,PermissionFlagsBits.ModerateMembers)) return deny(i,'You need the Moderate Members permission.');
      const user=i.options.getUser('user',true), member=await i.guild.members.fetch(user.id).catch(()=>null);
      const error=await targetCheck(i,member); if(error) return deny(i,error);
      const reason=i.options.getString('reason',true);
      const info=db.prepare('INSERT INTO moderation_warnings(guild_id,user_id,moderator_id,reason,created_at) VALUES(?,?,?,?,?)')
        .run(i.guild.id,user.id,i.user.id,reason,Date.now());
      await logAction(i.guild,'Member warned',`**User:** <@${user.id}>\n**Warning ID:** ${info.lastInsertRowid}\n**Moderator:** <@${i.user.id}>\n**Reason:** ${reason}`,0xFAA61A);
      return i.reply({content:`Warned <@${user.id}>. Warning ID: ${info.lastInsertRowid}. Reason: ${reason}`,ephemeral:true});
    }
  },
  {
    data: new SlashCommandBuilder().setName('warnings').setDescription('View or clear a member’s warning history.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addSubcommand(s=>s.setName('view').setDescription('View active warnings').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)))
      .addSubcommand(s=>s.setName('clear').setDescription('Clear active warnings for a member').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))),
    async execute(i) {
      if (!canModerate(i,PermissionFlagsBits.ModerateMembers)) return deny(i,'You need the Moderate Members permission.');
      const user=i.options.getUser('user',true), sub=i.options.getSubcommand();
      if(sub==='clear') {
        const result=db.prepare('UPDATE moderation_warnings SET active=0 WHERE guild_id=? AND user_id=? AND active=1').run(i.guild.id,user.id);
        await logAction(i.guild,'Warnings cleared',`**User:** <@${user.id}>\n**Moderator:** <@${i.user.id}>\n**Cleared:** ${result.changes}`);
        return i.reply({content:`Cleared ${result.changes} active warning(s) for <@${user.id}>.`,ephemeral:true});
      }
      const rows=db.prepare('SELECT id,moderator_id,reason,created_at FROM moderation_warnings WHERE guild_id=? AND user_id=? AND active=1 ORDER BY created_at DESC LIMIT 10').all(i.guild.id,user.id);
      const embed=new EmbedBuilder().setColor(0x8B5CF6).setTitle(`Warnings for ${user.tag}`).setDescription(rows.length?rows.map(w=>`**#${w.id}** • <t:${Math.floor(w.created_at/1000)}:R>\nReason: ${w.reason}\nModerator: <@${w.moderator_id}>`).join('\n\n'):'No active warnings.').setFooter({text:'Showing up to 10 active warnings'});
      return i.reply({embeds:[embed],ephemeral:true});
    }
  },
  {
    data: new SlashCommandBuilder().setName('purge').setDescription('Bulk-delete up to 100 recent messages.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption(o=>o.setName('amount').setDescription('Number of messages (1–100)').setRequired(true).setMinValue(1).setMaxValue(100))
      .addUserOption(o=>o.setName('user').setDescription('Only delete messages by this user')),
    async execute(i) {
      if (!canModerate(i,PermissionFlagsBits.ManageMessages)) return deny(i,'You need the Manage Messages permission.');
      if (!i.channel?.isTextBased() || !('bulkDelete' in i.channel)) return deny(i,'Use this command in a text channel that supports bulk deletion.');
      if (!(await i.guild.members.fetchMe()).permissions.has(PermissionFlagsBits.ManageMessages)) return deny(i,'Puchki needs the Manage Messages permission.');
      const amount=i.options.getInteger('amount',true), user=i.options.getUser('user');
      const messages=await i.channel.messages.fetch({limit:Math.min(100,amount+20)});
      const selected=messages.filter(m=>!m.pinned&&Date.now()-m.createdTimestamp<14*86400000&&(!user||m.author.id===user.id)).first(amount);
      if(!selected.length) return deny(i,'No eligible recent messages found. Pinned and older-than-14-day messages are skipped.');
      const deleted=await i.channel.bulkDelete(selected,true);
      await logAction(i.guild,'Messages purged',`**Channel:** <#${i.channelId}>\n**Moderator:** <@${i.user.id}>\n**Deleted:** ${deleted.size}`);
      return i.reply({content:`Deleted ${deleted.size} message(s). Discord does not bulk-delete messages older than 14 days.`,ephemeral:true});
    }
  },
  {
    data: new SlashCommandBuilder().setName('modsetup').setDescription('Configure Puchki moderation logging.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(s=>s.setName('log-channel').setDescription('Set the moderation log channel').addChannelOption(o=>o.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
      .addSubcommand(s=>s.setName('view').setDescription('View moderation settings')),
    async execute(i) {
      if (!canModerate(i,PermissionFlagsBits.Administrator)) return deny(i,'You need Administrator permission.');
      if(i.options.getSubcommand()==='log-channel') {
        const channel=i.options.getChannel('channel',true);
        db.prepare('INSERT INTO moderation_config(guild_id,log_channel_id) VALUES(?,?) ON CONFLICT(guild_id) DO UPDATE SET log_channel_id=excluded.log_channel_id').run(i.guild.id,channel.id);
        return i.reply({content:`Moderation logs will be sent to <#${channel.id}>.`,ephemeral:true});
      }
      const row=db.prepare('SELECT log_channel_id FROM moderation_config WHERE guild_id=?').get(i.guild.id);
      return i.reply({content:row?.log_channel_id?`Current log channel: <#${row.log_channel_id}>`:'No log channel configured. Use /modsetup log-channel.',ephemeral:true});
    }
  }
];
