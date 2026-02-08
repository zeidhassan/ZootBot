const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');

const ANNOUNCEMENTS_CHANNEL_NAME = 'announcements🔊';
const ANNOUNCEMENT_ROLE_NAME = 'announcement';
const ANNOUNCEMENT_FOOTER = 'Remember to check pinned announcements!';
const MODAL_CUSTOM_ID = 'announceModal';
const MODAL_INPUT_ID = 'announceMessage';
const ALLOWED_ROLE_IDS = ['1456273602264563722', '1456538179757670420'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement in the announcements channel'),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id))) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(MODAL_CUSTOM_ID)
      .setTitle('New Announcement');

    const messageInput = new TextInputBuilder()
      .setCustomId(MODAL_INPUT_ID)
      .setLabel('Announcement')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000)
      .setPlaceholder('Type your announcement here...');

    const actionRow = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  },

  modalCustomId: MODAL_CUSTOM_ID,

  async handleModal(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id))) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const message = interaction.fields.getTextInputValue(MODAL_INPUT_ID);
    const role = interaction.guild.roles.cache.find(r => r.name === ANNOUNCEMENT_ROLE_NAME);

    if (!role) {
      return interaction.reply({
        content: `Role "${ANNOUNCEMENT_ROLE_NAME}" not found.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const announcementHeader = `||<@&${role.id}>||`;
    const fullMessage = `${announcementHeader}\n\n${message}\n\n${ANNOUNCEMENT_FOOTER}`;

    await interaction.guild.channels.fetch();
    const channel = interaction.guild.channels.cache.find(
      c => c.name === ANNOUNCEMENTS_CHANNEL_NAME && c.isTextBased()
    );

    if (!channel) {
      return interaction.reply({
        content: `I couldn't find a text channel named "${ANNOUNCEMENTS_CHANNEL_NAME}".`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await channel.send({ content: fullMessage });

    return interaction.reply({
      content: `Announcement sent in #${ANNOUNCEMENTS_CHANNEL_NAME}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
