module.exports = {
  name: 'clientReady',
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

    const channelId = process.env.EXAROTON_STATUS_CHANNEL_ID?.trim();
    const consoleChannelId = process.env.EXAROTON_CONSOLE_CHANNEL_ID?.trim();
    if (!channelId && !consoleChannelId) {
      console.log(
        'EXAROTON_STATUS_CHANNEL_ID and EXAROTON_CONSOLE_CHANNEL_ID are not set. Skipping status stream.'
      );
      return;
    }

    const { startStatusStream } = require('../utils/exarotonStatus');

    const ANNOUNCE_DEDUPE_MS = 6000;
    const RECENT_EVENT_TTL_MS = 12000;
    const statusState = {
      players: null,
      lastStatusAt: 0,
      lastCount: null,
      lastMax: null,
      lastAnnouncementSignature: null,
      lastAnnouncementAt: 0,
    };
    const recentAnnouncements = new Map();
    const channelCache = new Map();

    const normalizePlayerName = player => {
      if (!player) return null;
      if (typeof player === 'string') return player;
      if (typeof player.name === 'string') return player.name;
      if (typeof player.username === 'string') return player.username;
      return null;
    };

    const getChannel = async id => {
      if (!id) return null;
      if (channelCache.has(id)) return channelCache.get(id);
      try {
        const channel = await client.channels.fetch(id);
        channelCache.set(id, channel);
        return channel;
      } catch (err) {
        console.error('Failed to fetch status channel:', err);
        return null;
      }
    };

    const stripAnsi = value =>
      typeof value === 'string'
        ? value.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
        : value;

    const cleanupRecent = (map, ttlMs) => {
      const now = Date.now();
      for (const [key, timestamp] of map) {
        if (now - timestamp > ttlMs) {
          map.delete(key);
        }
      }
    };

    const markAnnounced = (type, player) => {
      cleanupRecent(recentAnnouncements, RECENT_EVENT_TTL_MS);
      recentAnnouncements.set(`${type}:${player}`, Date.now());
    };

    const wasAnnouncedRecently = (type, player) => {
      cleanupRecent(recentAnnouncements, RECENT_EVENT_TTL_MS);
      const timestamp = recentAnnouncements.get(`${type}:${player}`);
      if (!timestamp) return false;
      return Date.now() - timestamp < ANNOUNCE_DEDUPE_MS;
    };

    const getCountLabel = () => {
      const count =
        statusState.players && typeof statusState.players.size === 'number'
          ? statusState.players.size
          : typeof statusState.lastCount === 'number'
            ? statusState.lastCount
            : null;
      if (typeof count === 'number') {
        const max = typeof statusState.lastMax === 'number' ? statusState.lastMax : null;
        return `${count}${typeof max === 'number' ? `/${max}` : ''}`;
      }
      return 'unknown';
    };

    const extractJoinLeave = line => {
      const cleaned = stripAnsi(line);
      if (!cleaned) return null;
      const normalized = cleaned.replace(/\r$/, '').trim();
      if (!normalized.includes('INFO')) return null;
      const joinMatch = normalized.match(/: (.+) joined the game$/);
      if (joinMatch) {
        return { type: 'join', player: joinMatch[1].trim() };
      }
      const leaveMatch = normalized.match(/: (.+) left the game$/);
      if (leaveMatch) {
        return { type: 'leave', player: leaveMatch[1].trim() };
      }
      const lostMatch = normalized.match(/: (.+) lost connection/);
      if (lostMatch) {
        return { type: 'leave', player: lostMatch[1].trim() };
      }
      return null;
    };

    const extractChat = line => {
      const cleaned = stripAnsi(line);
      if (!cleaned) return null;
      const normalized = cleaned.replace(/\r$/, '').trim();
      if (!normalized.includes('INFO')) return null;

      const lastOpen = normalized.lastIndexOf('<');
      if (lastOpen === -1) return null;
      const close = normalized.indexOf('>', lastOpen);
      if (close === -1) return null;

      const player = normalized.slice(lastOpen + 1, close).trim();
      const message = normalized.slice(close + 1).trim();
      if (!player || !message) return null;

      if (normalized.includes('[Not Secure]')) {
        return { player, message, insecure: true };
      }
      return { player, message };
    };

    const announceRosterChange = async ({ joined = [], left = [] } = {}) => {
      const filteredJoined = joined.filter(Boolean);
      const filteredLeft = left.filter(Boolean);
      if (filteredJoined.length === 0 && filteredLeft.length === 0) return;

      const channel = await getChannel(channelId);
      if (!channel) return;

      const countLabel = getCountLabel();
      const announcementSignature = `${filteredJoined
        .slice()
        .sort()
        .join(',')}|${filteredLeft.slice().sort().join(',')}|${countLabel}`;
      const now = Date.now();
      if (
        statusState.lastAnnouncementSignature === announcementSignature &&
        now - statusState.lastAnnouncementAt < ANNOUNCE_DEDUPE_MS
      ) {
        return;
      }

      const lines = [];
      filteredJoined.forEach(name => lines.push(`• ${name} joined`));
      filteredLeft.forEach(name => lines.push(`• ${name} left`));
      lines.push(`Players: ${countLabel}`);

      try {
        await channel.send({ content: lines.join('\n') });
        filteredJoined.forEach(name => markAnnounced('join', name));
        filteredLeft.forEach(name => markAnnounced('leave', name));
        statusState.lastAnnouncementSignature = announcementSignature;
        statusState.lastAnnouncementAt = now;
      } catch (err) {
        console.error('Failed to send status update:', err);
      }
    };

    const handleStatus = async data => {
      if (!channelId) return;
      if (!Array.isArray(data?.players?.list)) return;

      const players = data.players.list;
      const names = players.map(normalizePlayerName).filter(Boolean);
      const uniqueNames = Array.from(new Set(names));
      const currentPlayers = new Set(uniqueNames);

      if (typeof data?.players?.count === 'number') {
        statusState.lastCount = data.players.count;
      }
      if (typeof data?.players?.max === 'number') {
        statusState.lastMax = data.players.max;
      }
      statusState.lastStatusAt = Date.now();

      if (!statusState.players) {
        statusState.players = currentPlayers;
        return;
      }

      let joined = uniqueNames.filter(name => !statusState.players.has(name));
      let left = Array.from(statusState.players).filter(
        name => !currentPlayers.has(name)
      );

      joined = joined.filter(name => !wasAnnouncedRecently('join', name));
      left = left.filter(name => !wasAnnouncedRecently('leave', name));

      statusState.players = currentPlayers;

      if (joined.length === 0 && left.length === 0) {
        return;
      }

      await announceRosterChange({ joined, left });
    };

    const stream = startStatusStream({
      onStatus: handleStatus,
      onConsoleLine: async line => {
        if (!consoleChannelId) return;
        const joinLeave = extractJoinLeave(line);
        const chat = extractChat(line);
        if (!chat) return;
        const channel = await getChannel(consoleChannelId);
        if (!channel) return;
        try {
          await channel.send({ content: `<${chat.player}> ${chat.message}` });
        } catch (err) {
          console.error('Failed to send console chat update:', err);
        }
      },
      enableConsole: Boolean(consoleChannelId),
      onLog: message => console.log(message),
      onError: err => console.error('exaroton websocket error:', err),
    });
    client.exarotonStream = stream;
    client.exarotonConsoleChannelId = consoleChannelId;
  },
};
