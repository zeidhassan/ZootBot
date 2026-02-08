const LOG_CHANNEL_ID = '1456714300897886288';

function safeGetSubcommand(interaction) {
  if (!interaction?.options?.getSubcommand) return null;
  try {
    return interaction.options.getSubcommand(false);
  } catch (err) {
    return null;
  }
}

async function resolveLogChannel(client) {
  if (!client) return null;
  let channel = client.channels?.cache?.get(LOG_CHANNEL_ID);
  if (channel) return channel;

  try {
    channel = await client.channels.fetch(LOG_CHANNEL_ID);
  } catch (err) {
    console.error('Log channel fetch failed:', err);
    return null;
  }

  return channel;
}

async function logCommand(interaction, { status, action, details }) {
  const channel = await resolveLogChannel(interaction?.client);
  if (!channel) return;

  const guildLabel = interaction?.guild?.name || 'DM';
  const channelLabel = interaction?.channel?.name
    ? `#${interaction.channel.name}`
    : (interaction?.channel?.id || 'unknown');
  const userLabel = interaction?.user
    ? `${interaction.user.tag} (${interaction.user.id})`
    : 'unknown user';

  const subcommand = safeGetSubcommand(interaction);
  const commandLabel = subcommand
    ? `/${interaction.commandName} ${subcommand}`
    : `/${interaction.commandName}`;

  const safeAction = action ? ` | Action: ${action}` : '';
  const safeDetails = details ? ` | Details: ${details}` : '';
  const content = `[${status}] ${commandLabel}${safeAction} | User: ${userLabel} | Guild: ${guildLabel} | Channel: ${channelLabel}${safeDetails}`;

  try {
    await channel.send({ content });
  } catch (err) {
    console.error('Log channel send failed:', err);
  }
}

module.exports = { logCommand };
