const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { logCommand } = require('../utils/logging');
const {
  startServer,
  stopServer,
  restartServer,
  getServer,
} = require('../utils/exaroton');

const ALLOWED_ROLE_IDS = ['1456273602264563722', '1456538179757670420'];

function normalizeApiMessage(response, fallback) {
  if (!response) return fallback;
  if (typeof response === 'string') return response;
  if (response.data?.error) return `Error: ${response.data.error}`;
  if (response.data?.message) return response.data.message;
  return fallback;
}

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Manage the Minecraft server')
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start the Minecraft server on exaroton')
        .addBooleanOption(option =>
          option
            .setName('use_own_credits')
            .setDescription('Use your own exaroton credits (if needed)')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('stop')
        .setDescription('Stop the Minecraft server on exaroton')
    )
    .addSubcommand(sub =>
      sub
        .setName('restart')
        .setDescription('Restart the Minecraft server on exaroton')
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Check the Minecraft server status')
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'server start',
        details: 'Command used outside a server',
      });
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (
      (subcommand === 'stop' || subcommand === 'restart') &&
      !interaction.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id))
    ) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      if (subcommand === 'start') {
        const useOwnCredits = interaction.options.getBoolean('use_own_credits') || false;
        const response = await startServer({ useOwnCredits });
        const message = normalizeApiMessage(response, 'Start request sent.');

        await logCommand(interaction, {
          status: 'SUCCESS',
          action: 'server start',
          details: `Started server${useOwnCredits ? ' (own credits)' : ''}`,
        });

        return interaction.editReply({ content: message });
      }

      if (subcommand === 'stop') {
        const response = await stopServer();
        const message = normalizeApiMessage(response, 'Stop request sent.');

        await logCommand(interaction, {
          status: 'SUCCESS',
          action: 'server stop',
          details: 'Stop request sent',
        });

        return interaction.editReply({ content: message });
      }

      if (subcommand === 'restart') {
        const response = await restartServer();
        const message = normalizeApiMessage(response, 'Restart request sent.');

        await logCommand(interaction, {
          status: 'SUCCESS',
          action: 'server restart',
          details: 'Restart request sent',
        });

        return interaction.editReply({ content: message });
      }

      if (subcommand === 'status') {
        const response = await getServer();
        if (response?.data?.error) {
          const message = normalizeApiMessage(response, 'Failed to fetch status.');
          await logCommand(interaction, {
            status: 'FAILURE',
            action: 'server status',
            details: message,
          });
          return interaction.editReply({ content: message });
        }

        const statusCode = response?.data?.data?.status;
        const label = STATUS_LABELS.get(statusCode) || `unknown (${statusCode ?? 'n/a'})`;
        const playersCount = response?.data?.data?.players?.count;
        const playersLabel =
          typeof playersCount === 'number' ? ` | players: ${playersCount}` : '';
        const address = response?.data?.data?.address;
        const addressLabel = address ? ` | address: ${address}` : '';
        const message = `Status: ${label}${playersLabel}${addressLabel}`;

        await logCommand(interaction, {
          status: 'SUCCESS',
          action: 'server status',
          details: `Status: ${label}`,
        });

        return interaction.editReply({ content: message });
      }

      return interaction.editReply({ content: 'Unknown subcommand.' });
    } catch (err) {
      console.error('Server command failed:', err);
      await logCommand(interaction, {
        status: 'FAILURE',
        action: `server ${subcommand || 'unknown'}`,
        details: err?.message || 'Unknown error',
      });
      return interaction.editReply({
        content: 'Failed to perform the server action. Check bot logs for details.',
      });
    }
  },
};
