const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { logCommand } = require('../utils/logging');

const HELP_FIELDS = [
  {
    name: 'Live Chat',
    value:
      'Messages in #live-chat💬 get sent to the Minecraft server, and in-game chat appears in that channel.',
  },
  {
    name: 'Server Status',
    value:
      'The status panel in #server-status💻 shows whether the server is online, plus the player count and list.',
  },
  {
    name: '/server status',
    value:
      'Check the current server state, player count, and address in a quick reply.',
  },
  {
    name: '/server players',
    value:
      'Get a list of who is online right now, or a message that nobody is online.',
  },
  {
    name: '/tag',
    value:
      'Add or remove your Minecraft tag role (Builder, Miner, Farmer, Redstoner, Explorer).',
  },
  {
    name: '/color',
    value:
      'Pick a username color role and the bot will swap your color for you.',
  },
  {
    name: '/announcements',
    value:
      'Subscribe or unsubscribe to the announcement role so you can get pings when updates are posted.',
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Learn what this bot can do'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('ZootBot Help')
      .setDescription('Here is what you can use:')
      .addFields(HELP_FIELDS);

    await logCommand(interaction, {
      status: 'SUCCESS',
      action: 'help',
      details: 'Displayed player help',
    });
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
