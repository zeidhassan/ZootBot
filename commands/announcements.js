const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { logCommand } = require('../utils/logging');

const ANNOUNCEMENT_ROLE_NAME = 'announcement';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announcements')
    .setDescription('Manage announcement role subscriptions')
    .addSubcommand(sub =>
      sub
        .setName('subscribe')
        .setDescription('Get the announcement role')
    )
    .addSubcommand(sub =>
      sub
        .setName('unsubscribe')
        .setDescription('Remove the announcement role')
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'announcements',
        details: 'Command used outside a server',
      });
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const role = interaction.guild.roles.cache.find(r => r.name === ANNOUNCEMENT_ROLE_NAME);
    if (!role) {
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'announcements',
        details: `Role not found: ${ANNOUNCEMENT_ROLE_NAME}`,
      });
      return interaction.reply({
        content: `Role "${ANNOUNCEMENT_ROLE_NAME}" not found.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const member = interaction.member;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'subscribe') {
      if (member.roles.cache.has(role.id)) {
        await logCommand(interaction, {
          status: 'FAILURE',
          action: 'announcements subscribe',
          details: 'User already subscribed',
        });
        return interaction.reply({
          content: 'You already have the announcement role.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await member.roles.add(role);
      await logCommand(interaction, {
        status: 'SUCCESS',
        action: 'announcements subscribe',
        details: `Added role ${ANNOUNCEMENT_ROLE_NAME}`,
      });
      return interaction.reply({
        content: 'You are now subscribed to announcements.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!member.roles.cache.has(role.id)) {
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'announcements unsubscribe',
        details: 'User not subscribed',
      });
      return interaction.reply({
        content: 'You do not have the announcement role.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await member.roles.remove(role);
    await logCommand(interaction, {
      status: 'SUCCESS',
      action: 'announcements unsubscribe',
      details: `Removed role ${ANNOUNCEMENT_ROLE_NAME}`,
    });
    return interaction.reply({
      content: 'You are now unsubscribed from announcements.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
