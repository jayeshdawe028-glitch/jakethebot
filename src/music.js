import { SlashCommandBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import { LavalinkManager } from 'lavalink-client';
import { config } from './config.js';
import { db } from './database.js';

let manager = null;
const RADIO_API = 'https://de1.api.radio-browser.info/json';
const preferredStations = [
  { name: 'Radio Mirchi', terms: ['Radio Mirchi'] },
  { name: 'BIG FM', terms: ['BIG FM', 'Big FM 92.7'] },
  { name: 'MY FM', terms: ['MY FM', 'My FM 94.3'] },
  { name: 'Radio City Hindi', terms: ['Radio City'] },
  { name: 'Red FM', terms: ['Red FM'] },
  { name: 'Mirchi Love', terms: ['Mirchi Love'] },
  { name: 'Mirchi 90s', terms: ['Mirchi 90'] },
  { name: 'Vividh Bharati', terms: ['Vividh Bharati'] },
  { name: 'AIR FM Gold', terms: ['AIR FM Gold'] },
  { name: 'Hindi Retro', terms: ['Hindi Retro'] }
];

async function findStations() {
  const all = [];
  for (const preferred of preferredStations) {
    let match = null;
    for (const term of preferred.terms) {
      try {
        const url = new URL(RADIO_API + '/stations/search');
        url.search = new URLSearchParams({ name: term, countrycode: 'IN', hidebroken: 'true', limit: '20', order: 'votes', reverse: 'true' }).toString();
        const response = await fetch(url, { headers: { 'User-Agent': 'PuchkiDiscordRadio/1.0' }, signal: AbortSignal.timeout(7000) });
        if (!response.ok) continue;
        const stations = await response.json();
        match = stations.find(s => s.url_resolved && /^https?:\/\//i.test(s.url_resolved) && (s.lastcheckok === 1 || s.lastcheckok === true)) || null;
        if (match) break;
      } catch {}
    }
    if (match && !all.some(s => s.stationuuid === match.stationuuid)) all.push({ ...match, displayName: preferred.name });
  }
  if (!all.length) throw new Error('No working Hindi radio streams found.');
  return all;
}

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
    playerOptions: { defaultSearchPlatform: 'ytmsearch', onDisconnect: { autoReconnect: true, destroyPlayer: false }, onEmptyQueue: { destroyAfterMs: 2000000000 } },
    queueOptions: { maxPreviousTracks: 0 }
  });
  client.lavalink = manager;
  client.on('raw', data => manager.sendRawData(data));
  client.once('ready', async () => {
    try {
      await manager.init({ ...client.user });
      console.log('[Radio] Audio manager initialized.');
      setTimeout(() => restore247(client).catch(e => console.error('[Radio 24/7 restore]', e)), 12000);
    } catch (error) { console.error('[Radio] Audio manager init failed:', error); }
  });
  manager.on('nodeError', (node, error) => console.error('[Radio] Audio node error:', node?.id, error));
  return manager;
}

function voiceRequired(i) {
  const voice = i.member?.voice?.channel || null;
  if (!voice) {
    i.reply({ content: 'Pehle kisi voice channel mein join ho jao, phir /radio chalao. 📻', ephemeral: true }).catch(() => {});
    return null;
  }
  return voice;
}

async function getPlayer(guild, voiceChannelId, textChannelId) {
  let player = manager.getPlayer(guild.id);
  if (!player) player = await manager.createPlayer({ guildId: guild.id, voiceChannelId, textChannelId, selfDeaf: true, volume: 80 });
  return player;
}

async function playStation(guild, voice, text, station) {
  if (!manager) throw new Error('Radio audio service is not ready.');
  const player = await getPlayer(guild, voice.id, text.id);
  await player.connect();
  const streamUrl = station.url_resolved || station.url;
  const result = await player.search({ query: streamUrl }, { id: 'puchki-radio', username: 'Puchki Radio' });
  const track = result?.tracks?.[0];
  if (!track) throw new Error('Audio node rejected the radio stream URL.');
  if (typeof player.queue.clear === 'function') player.queue.clear();
  await player.queue.add(track);
  await player.play();
  return player;
}

async function restore247(client) {
  if (!manager) return;
  for (const row of db.prepare('SELECT * FROM radio_247').all()) {
    const guild = client.guilds.cache.get(row.guild_id);
    const voice = guild?.channels.cache.get(row.voice_channel_id);
    const text = guild?.channels.cache.get(row.text_channel_id);
    if (!guild || !voice?.isVoiceBased()) continue;
    try {
      await playStation(guild, voice, text || voice, { name: row.station_name, url_resolved: row.stream_url, url: row.stream_url });
      console.log('[Radio 24/7] Rejoined ' + guild.name + ' with ' + row.station_name);
    } catch (error) { console.error('[Radio 24/7 restore failed]', row.guild_id, error); }
  }
}

const radioCommands = [
  {
    data: new SlashCommandBuilder().setName('radio').setDescription('Choose a live Hindi FM radio station.'),
    async execute(i) {
      if (!manager) return i.reply({ content: '📻 Radio audio service is starting or unavailable. Check bot logs and try again.', ephemeral: true });
      const voice = voiceRequired(i); if (!voice) return;
      await i.deferReply({ ephemeral: true });
      try {
        const stations = await findStations();
        const select = new StringSelectMenuBuilder().setCustomId('radio:select').setPlaceholder('Choose a Hindi FM station').setMinValues(1).setMaxValues(1)
          .addOptions(stations.map((s, n) => ({ label: s.displayName.slice(0, 100), description: (s.country || 'India') + (s.bitrate ? ' • ' + s.bitrate + ' kbps' : ''), value: String(n) })));
        i.client.radioStationCache ||= new Map();
        i.client.radioStationCache.set(i.user.id + ':' + i.guildId, stations);
        return i.editReply({ content: '📻 Puchki Hindi FM — station select karo. Ye live radio hai, song search/queue nahi.', components: [new ActionRowBuilder().addComponents(select)] });
      } catch (error) {
        console.error('[Radio station list]', error);
        return i.editReply('Radio directory abhi respond nahi kar rahi. Thodi der baad /radio dobara try karo.');
      }
    }
  },
  {
    data: new SlashCommandBuilder().setName('247').setDescription('Keep the selected FM radio in your voice channel 24/7.')
      .addSubcommand(s => s.setName('enable').setDescription('Save the current radio station and stay in voice 24/7.'))
      .addSubcommand(s => s.setName('disable').setDescription('Disable 24/7 radio and leave.')),
    async execute(i) {
      if (!manager) return i.reply({ content: '📻 Radio audio service is unavailable right now.', ephemeral: true });
      const sub = i.options.getSubcommand();
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && i.user.id !== config.ownerId) return i.reply({ content: 'Is setting ke liye Manage Server permission chahiye.', ephemeral: true });
      if (sub === 'enable') {
        const voice = voiceRequired(i); if (!voice) return;
        const player = manager.getPlayer(i.guildId);
        const track = player?.queue?.current;
        const url = track?.info?.uri || track?.info?.identifier;
        if (!player || !track || !url) return i.reply({ content: 'Pehle /radio se station select karke radio chalao, phir /247 enable karo.', ephemeral: true });
        const name = track.info?.title || 'Hindi FM Radio';
        db.prepare('INSERT INTO radio_247(guild_id,voice_channel_id,text_channel_id,station_name,stream_url,enabled_by,enabled_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(guild_id) DO UPDATE SET voice_channel_id=excluded.voice_channel_id,text_channel_id=excluded.text_channel_id,station_name=excluded.station_name,stream_url=excluded.stream_url,enabled_by=excluded.enabled_by,enabled_at=excluded.enabled_at')
          .run(i.guildId, voice.id, i.channelId, name, url, i.user.id, Date.now());
        return i.reply({ content: '🔒 24/7 Radio enabled! Puchki will try to rejoin and resume this station after a bot restart. Public node and stream availability still matter.', ephemeral: true });
      }
      db.prepare('DELETE FROM radio_247 WHERE guild_id=?').run(i.guildId);
      const player = manager.getPlayer(i.guildId);
      if (player) await player.destroy();
      return i.reply('👋 24/7 radio disabled. Puchki has left the voice channel.');
    }
  }
];

export async function handleRadioSelect(i) {
  if (!i.isStringSelectMenu() || i.customId !== 'radio:select') return false;
  if (!manager) { await i.reply({ content: 'Radio audio service is not ready.', ephemeral: true }); return true; }
  const voice = voiceRequired(i); if (!voice) return true;
  const stations = i.client.radioStationCache?.get(i.user.id + ':' + i.guildId);
  const station = stations?.[Number(i.values[0])];
  if (!station) { await i.reply({ content: 'Station list expire ho gayi. /radio dobara chalao.', ephemeral: true }); return true; }
  await i.deferUpdate();
  try {
    await playStation(i.guild, voice, i.channel, station);
    const title = station.displayName || station.name;
    const streamUrl = station.url_resolved || station.url;
    await i.editReply({ content: '🔴 Now live: ' + title + '\n📻 Puchki is streaming in <#' + voice.id + '>. Use /radio to change station or /247 enable for 24/7.', components: [] });
    db.prepare('UPDATE radio_247 SET station_name=?,stream_url=? WHERE guild_id=?').run(title, streamUrl, i.guildId);
  } catch (error) {
    console.error('[Radio playback]', error);
    await i.editReply({ content: 'Ye station play nahi hua. /radio se doosra station try karo. Public streams/nodes kabhi-kabhi offline hote hain.', components: [] });
  }
  return true;
}

export { radioCommands };
