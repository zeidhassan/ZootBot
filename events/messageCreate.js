const LIVE_CHAT_COOLDOWN_MS = 1500;
const MAX_MESSAGE_LENGTH = 200;
const MAX_NAME_LENGTH = 32;
const recentMessages = new Map();
const DEBUG =
  typeof process.env.EXAROTON_DEBUG === 'string' &&
  process.env.EXAROTON_DEBUG.trim().toLowerCase() === 'true';

function cleanupCooldowns() {
  const now = Date.now();
  for (const [key, timestamp] of recentMessages) {
    if (now - timestamp > LIVE_CHAT_COOLDOWN_MS * 3) {
      recentMessages.delete(key);
    }
  }
}

function sanitizeText(value, maxLength) {
  if (!value || typeof value !== 'string') return '';
  const cleaned = value
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength);
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message || !message.guild) return;
    if (!message.channelId) return;
    if (message.author?.bot || message.webhookId) return;

    const consoleChannelId = message.client.exarotonConsoleChannelId;
    if (!consoleChannelId || message.channelId !== consoleChannelId) return;

    const stream = message.client.exarotonStream;
    if (!stream || typeof stream.sendConsoleCommand !== 'function') return;

    const content = sanitizeText(message.content, MAX_MESSAGE_LENGTH);
    if (!content) return;

    const userKey = message.author?.id || message.id;
    const now = Date.now();
    cleanupCooldowns();
    const lastAt = recentMessages.get(userKey);
    if (lastAt && now - lastAt < LIVE_CHAT_COOLDOWN_MS) {
      return;
    }
    recentMessages.set(userKey, now);

    const displayName = sanitizeText(
      message.member?.displayName || message.author?.username || 'Player',
      MAX_NAME_LENGTH
    );

    const command = `say [Discord] ${displayName}: ${content}`;
    const ok = stream.sendConsoleCommand(command);
    if (DEBUG) {
      console.log(
        `Live chat ${ok ? 'sent' : 'failed'} Discord->MC from ${displayName} (${message.author?.id || 'unknown'}): ${content}`
      );
    }
    if (!ok) {
      try {
        const reply = await message.reply({
          content:
            'Unable to send to the server right now. Try again in a moment.',
        });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
      } catch (err) {
        console.error('Failed to send live chat failure notice:', err);
      }
    }
  },
};
