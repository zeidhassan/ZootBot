const { EmbedBuilder } = require('discord.js');

const STATUS_LABELS = new Map([
  [0, 'offline'],
  [1, 'online'],
  [2, 'starting'],
  [3, 'stopping'],
  [4, 'restarting'],
  [5, 'saving'],
  [6, 'loading'],
  [7, 'crashed'],
  [8, 'pending'],
  [9, 'transferring'],
  [10, 'preparing'],
]);

const STATUS_EMBED_TITLE = 'Server Status';

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
    console.log('Starting exaroton status stream...');
    const DEBUG =
      typeof process.env.EXAROTON_DEBUG === 'string' &&
      process.env.EXAROTON_DEBUG.trim().toLowerCase() === 'true';

    const statusState = {
      players: null,
      lastStatusAt: 0,
      lastCount: null,
      lastMax: null,
      lastStatusCode: null,
      lastAddress: null,
      lastPlayersList: [],
      statusMessageId: null,
      embedUpdateInFlight: null,
    };
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

    const getStatusLabel = () => {
      const status = statusState.lastStatusCode;
      return STATUS_LABELS.get(status) || `unknown (${status ?? 'n/a'})`;
    };

    const getStatusColor = () => {
      const status = statusState.lastStatusCode;
      if (status === 1) return 0x2ecc71; // online
      if (status === 2) return 0xf1c40f; // starting
      if (status === 3) return 0xe67e22; // stopping
      if (status === 4) return 0x9b59b6; // restarting
      if (status === 7) return 0xe74c3c; // crashed
      return 0x95a5a6; // neutral
    };

    const buildPlayersValue = () => {
      const countLabel = getCountLabel();
      const names = Array.isArray(statusState.lastPlayersList)
        ? statusState.lastPlayersList
        : [];
      if (names.length === 0) return `${countLabel}\nNone`;
      let list = names.join(', ');
      if (list.length > 1000) {
        list = `${list.slice(0, 997)}...`;
      }
      return `${countLabel}\n${list}`;
    };

    const buildStatusEmbed = () =>
      new EmbedBuilder()
        .setTitle(STATUS_EMBED_TITLE)
        .setColor(getStatusColor())
        .addFields(
          { name: 'Status', value: getStatusLabel(), inline: true },
          { name: 'Players', value: buildPlayersValue(), inline: false },
          {
            name: 'Address',
            value: statusState.lastAddress || 'unknown',
            inline: true,
          }
        )
        .setTimestamp(new Date());

    const findStatusMessage = async channel => {
      if (!channel || !channel.isTextBased()) return null;
      if (statusState.statusMessageId) {
        try {
          const message = await channel.messages.fetch(statusState.statusMessageId);
          if (message) return message;
        } catch {
          statusState.statusMessageId = null;
        }
      }
      try {
        const recent = await channel.messages.fetch({ limit: 50 });
        const existing = recent.find(
          msg =>
            msg.author?.id === client.user.id &&
            Array.isArray(msg.embeds) &&
            msg.embeds[0]?.title === STATUS_EMBED_TITLE
        );
        if (existing) {
          statusState.statusMessageId = existing.id;
          return existing;
        }
      } catch (err) {
        console.error('Failed to find status embed message:', err);
      }
      return null;
    };

    const upsertStatusEmbed = async () => {
      if (!channelId) return;
      if (statusState.embedUpdateInFlight) {
        await statusState.embedUpdateInFlight;
        return;
      }
      const channel = await getChannel(channelId);
      if (!channel) return;
      const embed = buildStatusEmbed();
      const existing = await findStatusMessage(channel);
      statusState.embedUpdateInFlight = (async () => {
        try {
          if (existing) {
            console.log('Updating status embed message.');
            await existing.edit({ embeds: [embed] });
          } else {
            console.log('Creating status embed message.');
            const sent = await channel.send({ embeds: [embed] });
            statusState.statusMessageId = sent.id;
          }
        } catch (err) {
          console.error('Failed to update status embed:', err);
        } finally {
          statusState.embedUpdateInFlight = null;
        }
      })();
      await statusState.embedUpdateInFlight;
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

    const handleStatus = async data => {
      if (!channelId) return;
      if (typeof data?.status === 'number') {
        statusState.lastStatusCode = data.status;
      }

      if (typeof data?.address === 'string') {
        statusState.lastAddress = data.address;
      }

      if (Array.isArray(data?.players?.list)) {
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
        statusState.lastPlayersList = uniqueNames;

        if (!statusState.players) {
          statusState.players = currentPlayers;
          await upsertStatusEmbed();
          return;
        }

        statusState.players = currentPlayers;

        await upsertStatusEmbed();
        return;
      }

      await upsertStatusEmbed();
    };

    const stream = startStatusStream({
      onStatus: handleStatus,
      onConsoleLine: async line => {
        if (!consoleChannelId) return;
        const joinLeave = extractJoinLeave(line);
        const chat = extractChat(line);
        if (!chat) return;
        if (joinLeave) {
          console.log(`Player ${joinLeave.type}: ${joinLeave.player}`);
        }
        if (DEBUG) {
          console.log(`Live chat MC->Discord from ${chat.player}: ${chat.message}`);
        }
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
