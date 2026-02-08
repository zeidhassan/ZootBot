const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  const commandFiles = fs
    .readdirSync(path.join(__dirname, '../commands'))
    .filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(`../commands/${file}`);
    client.commands.set(command.data.name, command);
  }

  client.on('interactionCreate', async interaction => {
    if (interaction.isModalSubmit()) {
      const command = [...client.commands.values()].find(cmd => {
        if (cmd.modalCustomId && cmd.modalCustomId === interaction.customId) {
          return true;
        }
        if (cmd.modalCustomIdPrefix && interaction.customId.startsWith(cmd.modalCustomIdPrefix)) {
          return true;
        }
        return false;
      });

      if (!command || !command.handleModal) return;

      try {
        await command.handleModal(interaction);
      } catch (err) {
        console.error(err);
        interaction.reply({ content: 'Something broke.', ephemeral: true });
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      interaction.reply({ content: 'Something broke.', ephemeral: true });
    }
  });
};
