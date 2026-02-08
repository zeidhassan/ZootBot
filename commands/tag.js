const { SlashCommandBuilder } = require('discord.js');
const { logCommand } = require('../utils/logging');

const TAG_ROLES = ['Builder', 'Miner', 'Farmer', 'Redstoner', 'Explorer'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Manage your Minecraft tags')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a tag to your profile')
        .addStringOption(option =>
          option
            .setName('tag')
            .setDescription('Which tag to add') // ← THIS WAS MISSING
            .setRequired(true)
            .addChoices(
              { name: 'Builder', value: 'Builder' },
              { name: 'Miner', value: 'Miner' },
              { name: 'Farmer', value: 'Farmer' },
              { name: 'Redstoner', value: 'Redstoner' },
              { name: 'Explorer', value: 'Explorer' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a tag from your profile')
        .addStringOption(option =>
          option
            .setName('tag')
            .setDescription('Which tag to remove') // ← THIS TOO
            .setRequired(true)
            .addChoices(
              { name: 'Builder', value: 'Builder' },
              { name: 'Miner', value: 'Miner' },
              { name: 'Farmer', value: 'Farmer' },
              { name: 'Redstoner', value: 'Redstoner' },
              { name: 'Explorer', value: 'Explorer' }
            )
        )
    ),

  async execute(interaction) {
    const tag = interaction.options.getString('tag');
    const member = interaction.member;
    const role = interaction.guild.roles.cache.find(r => r.name === tag);

    if (!role) {
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'tag',
        details: `Role not found: ${tag}`,
      });
      return interaction.reply({ content: 'Tag role not found.', ephemeral: true });
    }

    if (interaction.options.getSubcommand() === 'add') {
      await member.roles.add(role);
      await logCommand(interaction, {
        status: 'SUCCESS',
        action: 'tag add',
        details: `Added tag ${tag}`,
      });
      interaction.reply({ content: `Added tag **${tag}** ⛏️`, ephemeral: true });
    } else {
      await member.roles.remove(role);
      await logCommand(interaction, {
        status: 'SUCCESS',
        action: 'tag remove',
        details: `Removed tag ${tag}`,
      });
      interaction.reply({ content: `Removed tag **${tag}**`, ephemeral: true });
    }
  },
};
