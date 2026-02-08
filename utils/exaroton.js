const https = require('https');

const API_HOST = 'api.exaroton.com';
const API_PREFIX = '/v1';

function readEnv(name) {
  const value = process.env[name];
  if (!value) return null;
  return value.trim();
}

function request(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(new Error('Missing exaroton API token.'));
      return;
    }

    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: API_HOST,
      path: `${API_PREFIX}${path}`,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    if (payload) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: json });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function startServer({ useOwnCredits = false } = {}) {
  const token = readEnv('EXAROTON_TOKEN');
  const serverId = readEnv('EXAROTON_SERVER_ID');

  if (!token) {
    throw new Error('Missing EXAROTON_TOKEN environment variable.');
  }
  if (!serverId) {
    throw new Error('Missing EXAROTON_SERVER_ID environment variable.');
  }

  const path = `/servers/${serverId}/start/`;

  if (useOwnCredits) {
    return request('POST', path, {
      token,
      body: { useOwnCredits: true },
    });
  }

  return request('GET', path, { token });
}

async function stopServer() {
  const token = readEnv('EXAROTON_TOKEN');
  const serverId = readEnv('EXAROTON_SERVER_ID');

  if (!token) {
    throw new Error('Missing EXAROTON_TOKEN environment variable.');
  }
  if (!serverId) {
    throw new Error('Missing EXAROTON_SERVER_ID environment variable.');
  }

  const path = `/servers/${serverId}/stop/`;
  return request('GET', path, { token });
}

async function restartServer() {
  const token = readEnv('EXAROTON_TOKEN');
  const serverId = readEnv('EXAROTON_SERVER_ID');

  if (!token) {
    throw new Error('Missing EXAROTON_TOKEN environment variable.');
  }
  if (!serverId) {
    throw new Error('Missing EXAROTON_SERVER_ID environment variable.');
  }

  const path = `/servers/${serverId}/restart/`;
  return request('GET', path, { token });
}

async function getServer() {
  const token = readEnv('EXAROTON_TOKEN');
  const serverId = readEnv('EXAROTON_SERVER_ID');

  if (!token) {
    throw new Error('Missing EXAROTON_TOKEN environment variable.');
  }
  if (!serverId) {
    throw new Error('Missing EXAROTON_SERVER_ID environment variable.');
  }

  const path = `/servers/${serverId}`;
  return request('GET', path, { token });
}

module.exports = {
  startServer,
  stopServer,
  restartServer,
  getServer,
};
