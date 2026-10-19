import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { LavalinkManager } from 'lavalink-client';
import { config } from './config.js';
import { db } from './database.js';

let manager = null;

export function setupMusic(client) {
  const nodes = config.lavahostKey
    ? [{ id: 'lavahost', host: 'gateway.lavahost.net', port: 443, authorization: config.lavahostKey, secure: true }]
    : [
        { id: 'nazha-sg1', host: 'sg-1.nazha.online', port: 443, authorization: 'https://discord.gg/XeSCnk57ZF', secure: true },
        { id: 'nazha-sg2', host: 'sg-2.nazha.online', port: 443, authorization: 'https://discord.gg/XeSCnk57ZF', secure: true },
        { id: 'nazha-sg3', host: 'sg-3.nazha.online', port: 443, authorization: 'https://discord.gg/XeSCnk57ZF', secure: true },
        { id: 'nazha-main', host: 'lavalink.nazha.online', port: 443, authorization: 'nazhafreelava', secure: true }
      ];
  manager = new LavalinkManager({
    nodes,
    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
    client: { id: config.clientId, username: 'Puchki' },
    autoSkip: true,
    playerOptions: {
      defaultSearchPlatform: 'ytmsearch',
      onDisconnect: { autoReconnect: true, destroyPlayer: false },
      onEmptyQueue: { destroyAfterMs: 2_000_000_000 }
    },
    queueOptions: { maxPreviousTracks: 10 }
  });
  client.lavalink = manager;
  client.on('raw', data => manager.sendRawData(data));
  client.once('ready', async () => {
    try {
      await manager.init({ ...client.user });
      console.log('[Music] Connected manager to hosted Lavalink.');
      setTimeout(() => restore247(client).catch(e => console.error('[Music 24/7 restore]', e)), 12000);
    } catch (error) {
      console.error('[Music] Lavalink init failed:', error);
    }
  });
  manager.on('nodeError', (node, error) => console.error('[Music] Lavalink node error:', node?.id, error));
  return manager;
}

async function restore247(client) {
  if (!manager) return;
  for (const row of db.prepare('SELECT * FROM music_247').all()) {
    const guild = client.guilds.cache.get(row.guild_id);
    const voice = guild?.channels.cache.get(row.voice_channel_id);
    const textChannel = guild?.channels.cache.get(row.text_channel_id);
    if (!guild || !voice?.isVoiceBased()) continue;
    try {
      const player = await getPlayer(guild, voice.id, textChannel?.id || voice.id);
      await player.connect();
      console.log('[Music 24/7] Rejoined ' + guild.name + ' voice channel.');
    } catch (error) {
      console.error('[Music 24/7 restore failed]', row.guild_id, error);
    }
  }
}

function notConfigured(interaction) {
  if (manager) return false;
  interaction.reply({
    content: '🎵 Music service is not connected yet. Puchki tries free public Lavalink nodes automatically; check the bot logs and try again in a minute. For a more controlled hosted endpoint, optionally add LAVAHOST_KEY to .env.',
    ephemeral: true
  }).catch(() => {});
  return true;
}

function voiceRequired(interaction) {
  const voice = interaction.member?.voice?.channel || null;
  if (!voice) {
    interaction.reply({ content: 'Pehle kisi voice channel mein join ho jao, phir music command chalao. 🎧', ephemeral: true }).catch(() => {});
    return null;
  }
  return voice;
}

async function getPlayer(guild, voiceChannelId, textChannelId) {
  let player = manager.getPlayer(guild.id);
  if (!player) {
    player = await manager.createPlayer({ guildId: guild.id, voiceChannelId, textChannelId, selfDeaf: true, volume: 80 });
  }
  return player;
}

const musicCommands = [
  {
    data: new SlashCommandBuilder().setName('play').setDescription('Search and play music from YouTube or a Spotify link.')
      .addStringOption(o => o.setName('song').setDescription('Song name, YouTube URL, or Spotify URL').setRequired(true).setMaxLength(300)),
    async execute(i) {
      if (notConfigured(i)) return;
      const voice = voiceRequired(i); if (!voice) return;
      await i.deferReply();
      try {
        const query = i.options.getString('song', true).trim();
        const player = await getPlayer(i.guild, voice.id, i.channelId);
        await player.connect();
        const result = await player.search({ query }, i.user);
        const tracks = result?.tracks || [];
        if (!tracks.length) return i.editReply('😿 Koi track nahi mila. Song name ya YouTube/Spotify link check karo.');
        const chosen = tracks.slice(0, result.loadType === 'playlist' ? 50 : 1);
        for (const track of chosen) await player.queue.add(track);
        if (!player.playing) await player.play();
        const first = chosen[0];
        const link = first.info?.uri ? '\n[Open source](' + first.info.uri + ')' : '';
        return i.editReply('🎶 **' + (first.info?.title || 'Track') + '** ' + (chosen.length > 1 ? 'and ' + (chosen.length - 1) + ' more track(s) added' : 'added to the queue') + '.' + link);
      } catch (error) {
        console.error('[Music /play]', error);
        return i.editReply('Music service connect nahi ho payi. Hosted service/key status check karo; /play dobara try karna.');
      }
    }
  },
  {
    data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current song.'),
    async execute(i) {
      if (notConfigured(i)) return;
      const player = manager.getPlayer(i.guildId);
      if (!player) return i.reply({ content: 'Abhi koi music player active nahi hai.', ephemeral: true });
      await player.skip();
      return i.reply('⏭️ Skipped the current track.');
    }
  },
  {
    data: new SlashCommandBuilder().setName('pause').setDescription('Pause the current song.'),
    async execute(i) {
      if (notConfigured(i)) return;
      const player = manager.getPlayer(i.guildId);
      if (!player) return i.reply({ content: 'Abhi kuch play nahi ho raha.', ephemeral: true });
      await player.pause();
      return i.reply('⏸️ Music paused.');
    }
  },
  {
    data: new SlashCommandBuilder().setName('resume').setDescription('Resume music playback.'),
    async execute(i) {
      if (notConfigured(i)) return;
      const player = manager.getPlayer(i.guildId);
      if (!player) return i.reply({ content: 'Abhi koi paused player nahi hai.', ephemeral: true });
      await player.resume();
      return i.reply('▶️ Music resumed.');
    }
  },
  {
    data: new SlashCommandBuilder().setName('stop').setDescription('Stop music and clear the queue.'),
    async execute(i) {
      if (!manager) { notConfigured(i); return; }
      const player = manager.getPlayer(i.guildId);
      if (player) await player.destroy();
      return i.reply('⏹️ Music stopped and queue cleared.');
    }
  },
  {
    data: new SlashCommandBuilder().setName('queue').setDescription('Show the current song and upcoming queue.'),
    async execute(i) {
      if (notConfigured(i)) return;
      const player = manager.getPlayer(i.guildId);
      if (!player) return i.reply({ content: 'Queue empty hai. /play se song add karo.', ephemeral: true });
      const current = player.queue.current;
      const upcoming = player.queue.tracks || [];
      const lines = [];
      if (current) lines.push('**Now playing:** ' + (current.info?.title || 'Unknown track'));
      lines.push(...upcoming.slice(0, 10).map((t, n) => (n + 1) + '. ' + (t.info?.title || 'Unknown track')));
      return i.reply({ embeds: [new EmbedBuilder().setColor(0x8B5CF6).setTitle('🎶 Puchki Music Queue').setDescription(lines.join('\n') || 'Queue empty hai.').setFooter({ text: upcoming.length + ' upcoming track(s)' })] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('247').setDescription('Keep Puchki in your voice channel 24/7.')
      .addSubcommand(s => s.setName('enable').setDescription('Stay in your current voice channel 24/7.'))
      .addSubcommand(s => s.setName('disable').setDescription('Disable 24/7 voice staying and leave.')),
    async execute(i) {
      if (notConfigured(i)) return;
      const sub = i.options.getSubcommand();
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && i.user.id !== config.ownerId) {
        return i.reply({ content: 'Is setting ke liye Manage Server permission chahiye.', ephemeral: true });
      }
      if (sub === 'enable') {
        const voice = voiceRequired(i); if (!voice) return;
        await i.deferReply({ ephemeral: true });
        try {
          const player = await getPlayer(i.guild, voice.id, i.channelId);
          await player.connect();
          db.prepare('INSERT INTO music_247(guild_id,voice_channel_id,text_channel_id,enabled_by,enabled_at) VALUES(?,?,?,?,?) ON CONFLICT(guild_id) DO UPDATE SET voice_channel_id=excluded.voice_channel_id,text_channel_id=excluded.text_channel_id,enabled_by=excluded.enabled_by,enabled_at=excluded.enabled_at')
            .run(i.guildId, voice.id, i.channelId, i.user.id, Date.now());
          return i.editReply('🔒 24/7 enabled! Puchki will stay in this voice channel and try to rejoin after a bot restart while the hosted music service is available. Use /247 disable to turn it off.');
        } catch (error) {
          console.error('[Music /247 enable]', error);
          return i.editReply('24/7 connection failed. Check the hosted music key/service and voice permissions.');
        }
      }
      db.prepare('DELETE FROM music_247 WHERE guild_id=?').run(i.guildId);
      const player = manager.getPlayer(i.guildId);
      if (player) await player.destroy();
      return i.reply('👋 24/7 disabled. Puchki has left the voice channel.');
    }
  }
];

export { musicCommands };
