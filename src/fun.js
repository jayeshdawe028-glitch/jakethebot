import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

const purple = 0x8B5CF6;
const targetFrom = (message, raw) => message.mentions.members.first()
  || message.guild.members.cache.find(m => m.user.username.toLowerCase() === raw.replace(/^<@!?\d+>$/, '').toLowerCase());

export async function handleFunMessage(message) {
  if (!message.guild || message.author.bot) return false;
  const content = message.content.trim();

  if (/^p!ban\b/i.test(content) || /^p!kick\b/i.test(content)) {
    const isBan = /^p!ban\b/i.test(content);
    const rawTarget = content.replace(/^p!(?:ban|kick)\b/i, '').trim();
    const target = targetFrom(message, rawTarget);
    if (!target) {
      await message.reply('😼 Kisi member ko mention karo! Example: `p!ban @member` ya `p!kick @member`');
      return true;
    }
    const embed = new EmbedBuilder()
      .setColor(isBan ? 0xED4245 : 0xFAA61A)
      .setAuthor({ name: 'PUCHKI • MODERATION NOTICE', iconURL: message.client.user.displayAvatarURL() })
      .setTitle(isBan ? '🔨 FAKE BAN NOTICE' : '👢 FAKE KICK NOTICE')
      .setDescription(isBan
        ? `**Member:** <@${target.id}>\n**Action:** Ban (PRANK MODE)\n**Moderator:** <@${message.author.id}>\n\nThis is a simulated moderation notice. No ban has been applied.`
        : `**Member:** <@${target.id}>\n**Action:** Kick (PRANK MODE)\n**Moderator:** <@${message.author.id}>\n\nThis is a simulated moderation notice. No one has been kicked.`)
      .addFields({ name: '⚠️ Officially unofficial reason', value: 'Sudhar ja varna अगली बार Wi-Fi ka password bhi nahi milega 😝' })
      .setFooter({ text: 'FUN COMMAND • No real moderation action was taken' })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('fun:appeal').setLabel('Appeal 😂').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('fun:innocent').setLabel('Main innocent hoon!').setStyle(ButtonStyle.Primary)
    );
    await message.channel.send({ embeds: [embed], components: [row], allowedMentions: { users: [target.id, message.author.id] } });
    return true;
  }

  if (/^!microclear\b/i.test(content)) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.reply('⛔ Is command ke liye **Manage Messages** permission chahiye.');
      return true;
    }
    const me = await message.guild.members.fetchMe();
    if (!me.permissionsIn(message.channel).has(PermissionFlagsBits.ManageMessages)) {
      await message.reply('Mujhe is channel mein **Manage Messages** permission do.');
      return true;
    }
    const phrase = content.replace(/^!microclear\b/i, '').trim();
    if (phrase.length < 3) {
      await message.reply('Usage: `!Microclear @jake vc aaa`\nKam se kam 3 characters ka exact text do jise delete karna hai.');
      return true;
    }
    await message.reply(`🔎 Is channel mein matching messages search kar raha hoon: \`${phrase.slice(0, 150)}\``);
    let before;
    let scanned = 0;
    let deleted = 0;
    const maxScan = 5000;
    const needle = phrase.toLowerCase();
    while (scanned < maxScan) {
      const batch = await message.channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
      if (!batch || batch.size === 0) break;
      before = batch.last().id;
      scanned += batch.size;
      const matches = batch.filter(m =>
        m.id !== message.id &&
        m.author.id !== message.client.user.id &&
        m.content.toLowerCase().includes(needle)
      );
      for (const m of matches.values()) {
        try {
          await m.delete();
          deleted++;
        } catch (error) {
          if (error?.code !== 10008 && error?.code !== 50013) console.error('[Microclear delete]', error);
        }
      }
      if (batch.size < 100) break;
    }
    await message.channel.send(`🧹 **Microclear complete!** Deleted **${deleted}** matching message(s), scanned **${scanned}** messages in this channel.\n${scanned >= maxScan ? 'Search limit reached (5,000 messages); run again to scan older history.' : 'Only this channel was searched.'}`);
    return true;
  }
  return false;
}

export async function handleFunButton(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('fun:')) return false;
  const text = interaction.customId === 'fun:appeal'
    ? 'Appeal received 😂 Verdict: guilty of being too funny. Punishment: send one meme and sudhar ja varna 😝'
    : 'Innocence review complete 🕵️ Result: 100% innocent… according to you! Case closed 😂';
  await interaction.reply({ content: text, ephemeral: true });
  return true;
}
