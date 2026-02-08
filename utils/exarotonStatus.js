const WebSocket = require('ws');

const API_HOST = 'api.exaroton.com';

function readEnv(name) {
  const value = process.env[name];
  if (!value) return null;
  return value.trim();
}

function buildWebsocketUrl(serverId) {
  return `wss://${API_HOST}/v1/servers/${serverId}/websocket`;
}

function createStatusStream({
  token,
  serverId,
  onStatus,
  onConsoleLine,
  enableConsole = false,
  onLog,
  onError,
} = {}) {
  let socket = null;
  let closed = false;
  let reconnectTimer = null;
  let ready = false;
  let reconnectAttempts = 0;
  let consoleRequested = false;
  let serverConnected = false;
  const pendingMessages = [];

  const log = message => {
    if (onLog) onLog(message);
  };

  const sendMessage = payload => {
    if (!payload) return;
    if (!ready || !socket) {
      pendingMessages.push(payload);
      return;
    }
    try {
      socket.send(JSON.stringify(payload));
    } catch (err) {
      onError?.(err);
    }
  };

  const startConsoleStream = () => {
    if (!enableConsole || consoleRequested || !serverConnected) return;
    consoleRequested = true;
    log('exaroton websocket starting console stream');
    sendMessage({
      stream: 'console',
      type: 'start',
      data: { tail: 0 },
    });
  };

  const startStatusStream = () => {
    sendMessage({
      stream: 'status',
      type: 'start',
    });
  };

  const scheduleReconnect = () => {
    if (closed) return;
    if (reconnectTimer) return;
    reconnectAttempts += 1;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempts, 5));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
    log(`exaroton websocket reconnecting in ${Math.round(delay / 1000)}s`);
  };

  const connect = () => {
    if (closed) return;
    if (!token || !serverId) {
      onError?.(new Error('Missing exaroton token or server id for websocket.'));
      return;
    }

    const url = buildWebsocketUrl(serverId);
    socket = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    socket.on('open', () => {
      ready = false;
      serverConnected = false;
      consoleRequested = false;
      log('exaroton websocket connected');
    });

    socket.on('message', data => {
      let message = null;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (message?.type === 'ready') {
        ready = true;
        reconnectAttempts = 0;
        log('exaroton websocket ready');
        while (pendingMessages.length) {
          const next = pendingMessages.shift();
          sendMessage(next);
        }
        startStatusStream();
        return;
      }

      if (message?.type === 'connected') {
        serverConnected = true;
        log('exaroton websocket server connected');
        startConsoleStream();
        return;
      }

      if (message?.type === 'disconnected') {
        serverConnected = false;
        consoleRequested = false;
        log('exaroton websocket server disconnected');
        return;
      }

      if (!ready) return;

      if (message?.stream === 'status' && message?.type === 'status') {
        if (message?.data) {
          if (message?.data?.status === 1) {
            startConsoleStream();
          }
          log('exaroton websocket status update');
          onStatus?.(message.data);
        }
        return;
      }

      if (message?.stream === 'console' && message?.type === 'line') {
        if (typeof message?.data === 'string') {
          onConsoleLine?.(message.data);
        }
      }
    });

    socket.on('close', () => {
      ready = false;
      serverConnected = false;
      consoleRequested = false;
      socket = null;
      scheduleReconnect();
    });

    socket.on('error', err => {
      onError?.(err);
    });
  };

  const stop = () => {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
  };

  const sendConsoleCommand = command => {
    if (!enableConsole) return false;
    if (!serverConnected) return false;
    if (typeof command !== 'string' || !command.trim()) return false;
    startConsoleStream();
    sendMessage({
      stream: 'console',
      type: 'command',
      data: command.trim(),
    });
    return true;
  };

  return { connect, stop, sendConsoleCommand };
}

function startStatusStream({
  onStatus,
  onConsoleLine,
  enableConsole,
  onLog,
  onError,
} = {}) {
  const token = readEnv('EXAROTON_TOKEN');
  const serverId = readEnv('EXAROTON_SERVER_ID');

  const stream = createStatusStream({
    token,
    serverId,
    onStatus,
    onConsoleLine,
    enableConsole,
    onLog,
    onError,
  });

  stream.connect();
  return stream;
}

module.exports = {
  startStatusStream,
};
