import { SlashCommandBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,
  VoiceConnectionStatus, StreamType, entersState, NoSubscriberBehavior
} from '@discordjs/voice';
import { spawn } from 'node:child_process';
import { config } from './config.js';
import { db } from './database.js';

const RADIO_API = 'https://de1.api.radio-browser.info/json';
const stations = [
  { name: 'Radio Mirchi', terms: ['Radio Mirchi'] },
  { name: 'BIG FM', terms: ['BIG FM', 'Big FM 92.7'] },
  { name: 'MY FM', terms: ['MY FM', 'My FM 94.3'] },
  { name: 'Radio City Hindi', terms: ['Radio City Hindi', 'Radio City'] },
  { name: 'Red FM', terms: ['Red FM'] },
  { name: 'Mirchi Love', terms: ['Mirchi Love'] },
  { name: 'Mirchi 90s', terms: ['Mirchi 90'] },
  { name: 'Vividh Bharati', terms: ['Vividh Bharati'] },
  { name: 'AIR FM Gold', terms: ['AIR FM Gold'] },
  { name: 'Hindi Retro', terms: ['Hindi Retro'] }
];
const sessions = new Map();

export function setupMusic(client) {
  client.radioSessions = sessions;
  client.once('ready', () => {
    console.log('[Radio] Direct stream player ready (no Lavalink).');
    setTimeout(() => restore247(client).catch(e => console.error('[Radio 24/7 restore]', e)), 5000);
  });
}

async function findStations() {
  const found = [];
  for (const preferred of stations) {
    for (const term of preferred.terms) {
      try {
        const url = new URL(RADIO_API + '/stations/search');
        url.search = new URLSearchParams({ name: term, countrycode: 'IN', hidebroken: 'true', limit: '30', order: 'votes', reverse: 'true' }).toString();
        const res = await fetch(url, { headers: { 'User-Agent': 'PuchkiDiscordRadio/1.0' }, signal: AbortSignal.timeout(7000) });
        if (!res.ok) continue;
        const list = await res.json();
        const match = list.find(s => s.url_resolved && /^https?:\/\//i.test(s.url_resolved) && (s.lastcheckok === 1 || s.lastcheckok === true));
        if (match) { found.push({ name: preferred.name, url: match.url_resolved }); break; }
      } catch {}
    }
  }
  if (!found.length) throw new Error('No working radio streams found in Radio Browser.');
  return found;
}

function stopSession(guildId) {
  const old = sessions.get(guildId);
  if (!old) return;
  old.process?.kill('SIGKILL');
  old.player?.stop(true);
  old.connection?.destroy();
  sessions.delete(guildId);
}

async function playStation(guild, voice, station) {
  if (!station?.url || !/^https?:\/\//i.test(station.url)) throw new Error('Invalid radio stream URL.');
  stopSession(guild.id);
  const connection = joinVoiceChannel({
    channelId: voice.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    const ffmpeg = spawn('ffmpeg', [
      '-nostdin', '-hide_banner', '-loglevel', 'error', '-reconnect', '1',
      '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-i', station.url,
      '-vn', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let ffmpegError = '';
    ffmpeg.stderr.on('data', d => { ffmpegError = (ffmpegError + d.toString()).slice(-1200); });
    ffmpeg.on('error', e => console.error('[Radio FFmpeg]', e.message));
    ffmpeg.on('close', code => {
      if (sessions.get(guild.id)?.process === ffmpeg && code !== 0)
        console.error('[Radio] Stream process ended:', station.name, code, ffmpegError);
    });
    const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw, inlineVolume: true });
    resource.volume?.setVolume(0.8);
    player.on('error', e => console.error('[Radio player]', e.message));
    player.play(resource);
    connection.subscribe(player);
    sessions.set(guild.id, { connection, player, process: ffmpeg, station, voiceChannelId: voice.id });
    return station;
  } catch (e) {
    connection.destroy();
    throw e;
  }
}

async function restore247(client) {
  for (const row of db.prepare('SELECT * FROM radio_247').all()) {
    const guild = client.guilds.cache.get(row.guild_id);
    const voice = guild?.channels.cache.get(row.voice_channel_id);
    if (!guild || !voice?.isVoiceBased()) continue;
    try {
      await playStation(guild, voice, { name: row.station_name, url: row.stream_url });
      console.log('[Radio 24/7] Restored', row.station_name, 'in', guild.name);
    } catch (e) { console.error('[Radio 24/7 restore failed]', row.guild_id, e.message); }
  }
}

function voiceRequired(i) {
  const voice = i.member?.voice?.channel;
  if (!voice) {
    i.reply({ content: 'Pehle kisi voice channel mein join ho jao, phir /radio chalao. 📻', ephemeral: true }).catch(() => {});
    return null;
  }
  return voice;
}

const radioCommands = [
  {
    data: new SlashCommandBuilder().setName('radio').setDescription('Choose a live Hindi FM radio station.'),
    async execute(i) {
      const voice = voiceRequired(i); if (!voice) return;
      await i.deferReply({ ephemeral: true });
      try {
        const list = await findStations();
        const select = new StringSelectMenuBuilder().setCustomId('radio:select').setPlaceholder('Choose a Hindi FM station').setMinValues(1).setMaxValues(1)
          .addOptions(list.slice(0, 25).map((s, n) => ({ label: s.name.slice(0, 100), description: 'Live radio stream', value: String(n) })));
        i.client.radioStationCache ||= new Map();
        i.client.radioStationCache.set(i.user.id + ':' + i.guildId, list);
        return i.editReply({ content: '📻 Puchki Hindi FM — station select karo. Direct stream player, Lavalink ki zaroorat nahi.', components: [new ActionRowBuilder().addComponents(select)] });
      } catch (e) {
        console.error('[Radio station list]', e.message);
        return i.editReply('Radio station list abhi available nahi hai. Thodi der baad try karo.');
      }
    }
  },
  {
    data: new SlashCommandBuilder().setName('247').setDescription('Keep the selected FM radio running 24/7.')
      .addSubcommand(s => s.setName('enable').setDescription('Save current radio and restore after restart.'))
      .addSubcommand(s => s.setName('disable').setDescription('Disable 24/7 radio and leave voice.')),
    async execute(i) {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && i.user.id !== config.ownerId)
        return i.reply({ content: 'Is setting ke liye Manage Server permission chahiye.', ephemeral: true });
      if (i.options.getSubcommand() === 'enable') {
        const voice = voiceRequired(i); if (!voice) return;
        const session = sessions.get(i.guildId);
        if (!session?.station) return i.reply({ content: 'Pehle /radio se station select karke play karo, phir /247 enable.', ephemeral: true });
        db.prepare('INSERT INTO radio_247(guild_id,voice_channel_id,text_channel_id,station_name,stream_url,enabled_by,enabled_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(guild_id) DO UPDATE SET voice_channel_id=excluded.voice_channel_id,text_channel_id=excluded.text_channel_id,station_name=excluded.station_name,stream_url=excluded.stream_url,enabled_by=excluded.enabled_by,enabled_at=excluded.enabled_at')
          .run(i.guildId, voice.id, i.channelId, session.station.name, session.station.url, i.user.id, Date.now());
        return i.reply({ content: '🔒 24/7 radio enabled! Restart ke baad Puchki station restore karne ki koshish karegi.', ephemeral: true });
      }
      db.prepare('DELETE FROM radio_247 WHERE guild_id=?').run(i.guildId);
      stopSession(i.guildId);
      return i.reply('👋 24/7 radio disabled. Puchki voice se leave kar gayi.');
    }
  }
];

export async function handleRadioSelect(i) {
  if (!i.isStringSelectMenu() || i.customId !== 'radio:select') return false;
  const voice = voiceRequired(i); if (!voice) return true;
  const list = i.client.radioStationCache?.get(i.user.id + ':' + i.guildId);
  const station = list?.[Number(i.values[0])];
  if (!station) { await i.reply({ content: 'Station list expire ho gayi. /radio dobara chalao.', ephemeral: true }); return true; }
  await i.deferUpdate();
  try {
    await playStation(i.guild, voice, station);
    i.client.radioCurrent ||= new Map();
    i.client.radioCurrent.set(i.guildId, station);
    db.prepare('UPDATE radio_247 SET station_name=?,stream_url=? WHERE guild_id=?').run(station.name, station.url, i.guildId);
    await i.editReply({ content: '🔴 Now live: ' + station.name + '\n📻 Puchki is streaming in <#' + voice.id + '>. Use /radio to change station or /247 enable for 24/7.', components: [] });
  } catch (e) {
    console.error('[Radio playback]', e);
    await i.editReply({ content: 'Ye stream play nahi hui. /radio se doosra station try karo. Agar FFmpeg missing hai to container rebuild zaroori hai.', components: [] });
  }
  return true;
}

export { radioCommands };
