const { SlashCommandBuilder } = require('discord.js');
const { logCommand } = require('../utils/logging');

const COLOR_ROLES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Orange'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('color')
        .setDescription('Change your username color')
        .addStringOption(option =>
            option
                .setName('color')
                .setDescription('Choose a color')
                .setRequired(true)
                .addChoices(
                    { name: 'Red', value: 'Red' },
                    { name: 'Blue', value: 'Blue' },
                    { name: 'Green', value: 'Green' },
                    { name: 'Yellow', value: 'Yellow' },
                    { name: 'Purple', value: 'Purple' },
                    { name: 'Pink', value: 'Pink' },
                    { name: 'Orange', value: 'Orange' }
                )
        ),

    async execute(interaction) {
        const color = interaction.options.getString('color');
        const member = interaction.member;

        // Remove old color roles
        for (const roleName of COLOR_ROLES) {
            const role = interaction.guild.roles.cache.find(r => r.name === roleName);
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
            }
        }

        // Add new color role
        const newRole = interaction.guild.roles.cache.find(r => r.name === color);
        if (!newRole) {
            await logCommand(interaction, {
                status: 'FAILURE',
                action: 'color',
                details: `Role not found: ${color}`,
            });
            return interaction.reply({ content: 'Color role not found.', ephemeral: true });
        }

        await member.roles.add(newRole);
        await logCommand(interaction, {
            status: 'SUCCESS',
            action: 'color',
            details: `Set color to ${color}`,
        });
        interaction.reply({ content: `Your color is now **${color}**`, ephemeral: true });
    },
};
