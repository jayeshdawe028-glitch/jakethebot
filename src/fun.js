import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

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

    await message.reply('🔎 **Microclear** is channel ke repeated spam messages detect kar raha hai...');
    let before;
    let scanned = 0;
    const maxScan = 5000;
    const messages = [];
    while (scanned < maxScan) {
      const batch = await message.channel.messages.fetch({ limit: Math.min(100, maxScan - scanned), ...(before ? { before } : {}) }).catch(() => null);
      if (!batch || batch.size === 0) break;
      before = batch.last().id;
      scanned += batch.size;
      messages.push(...batch.values());
      if (batch.size < 100) break;
    }

    const normalize = m => m.content.trim().toLowerCase().replace(/\s+/g, ' ');
    const groups = new Map();
    for (const m of messages) {
      if (m.id === message.id || m.author.id === message.client.user.id) continue;
      const key = normalize(m);
      if (key.length < 3) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }

    const spamMessages = [...groups.values()].filter(group => group.length >= 3).flat();
    let deleted = 0;
    for (const m of spamMessages) {
      try {
        await m.delete();
        deleted++;
      } catch (error) {
        if (error?.code !== 10008 && error?.code !== 50013) console.error('[Microclear delete]', error);
      }
    }

    await message.channel.send(`🧹 **Microclear complete!** Deleted **${deleted}** messages from repeated text groups (same text appearing 3+ times). Scanned **${scanned}** messages in this channel.\n${scanned >= maxScan ? 'Search limit reached (5,000 messages); older history may contain more spam.' : 'Only this channel was searched.'}`);
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
