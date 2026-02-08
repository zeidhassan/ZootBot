const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  ChannelType,
} = require('discord.js');

const MODAL_CUSTOM_ID_PREFIX = 'sayModal:';
const MODAL_INPUT_ID = 'sayMessage';
const ALLOWED_ROLE_IDS = ['1456273602264563722', '1456538179757670420'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message in a selected channel')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send the message in')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),

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

    const channel = interaction.options.getChannel('channel', true);
    if (!channel.isTextBased()) {
      return interaction.reply({
        content: 'Please select a text-based channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`${MODAL_CUSTOM_ID_PREFIX}${channel.id}`)
      .setTitle('New Message');

    const messageInput = new TextInputBuilder()
      .setCustomId(MODAL_INPUT_ID)
      .setLabel('Message')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000)
      .setPlaceholder('Type your message here...');

    const actionRow = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  },

  modalCustomIdPrefix: MODAL_CUSTOM_ID_PREFIX,

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

    const channelId = interaction.customId.slice(MODAL_CUSTOM_ID_PREFIX.length);
    if (!channelId) {
      return interaction.reply({
        content: 'I could not determine which channel to use.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const message = interaction.fields.getTextInputValue(MODAL_INPUT_ID);
    const channel = await interaction.guild.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        content: 'That channel is not available or not text-based.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await channel.send({ content: message });

    return interaction.reply({
      content: `Message sent in #${channel.name}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
