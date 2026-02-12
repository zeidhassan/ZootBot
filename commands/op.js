const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { logCommand } = require('../utils/logging');

const ALLOWED_ROLE_IDS = ['1456273602264563722', '1456538179757670420'];
const VALID_PLAYER_NAME = /^[A-Za-z0-9_]{1,16}$/;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('op')
    .setDescription('Manage operator status for a player')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Grant operator status')
        .addStringOption(option =>
          option
            .setName('player')
            .setDescription('Minecraft username')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove operator status')
        .addStringOption(option =>
          option
            .setName('player')
            .setDescription('Minecraft username')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      console.log('OP command blocked: used outside a guild.');
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'op',
        details: 'Command used outside a server',
      });
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id))) {
      console.log(`OP command blocked: insufficient permissions for ${interaction.user?.id || 'unknown user'}.`);
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'op',
        details: 'User lacks permission',
      });
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const player = interaction.options.getString('player', true).trim();
    if (!VALID_PLAYER_NAME.test(player)) {
      console.log(`OP command blocked: invalid player name "${player}".`);
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'op',
        details: `Invalid player name: ${player}`,
      });
      return interaction.reply({
        content: 'Please provide a valid Minecraft username.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const stream = interaction.client.exarotonStream;
    if (!stream || typeof stream.sendConsoleCommand !== 'function') {
      console.log('OP command failed: exaroton console stream not available.');
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'op',
        details: 'Exaroton stream not available',
      });
      return interaction.reply({
        content: 'Console stream is not ready. Try again in a moment.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const command = subcommand === 'remove' ? `deop ${player}` : `op ${player}`;

    const ok = stream.sendConsoleCommand(command);
    if (!ok) {
      console.log(`OP command failed to send: ${command}`);
      await logCommand(interaction, {
        status: 'FAILURE',
        action: `op ${subcommand}`,
        details: 'Console command failed to send',
      });
      return interaction.reply({
        content: 'Unable to send to the server right now. Try again in a moment.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await logCommand(interaction, {
      status: 'SUCCESS',
      action: `op ${subcommand}`,
      details: `${subcommand === 'remove' ? 'De-opped' : 'Opped'} ${player}`,
    });

    console.log(`OP command sent: ${command}`);
    return interaction.reply({
      content:
        subcommand === 'remove'
          ? `Removed operator status from **${player}**.`
          : `Granted operator status to **${player}**.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
