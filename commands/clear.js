const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { logCommand } = require('../utils/logging');

const ALLOWED_ROLE_IDS = ['1456273602264563722', '1456538179757670420'];
const DEFAULT_DELETE_COUNT = 1000;
const MAX_DELETE_PER_BATCH = 100;
const MAX_DELETE_TOTAL = 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete messages from the current text channel')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Number of recent messages to delete (1-1000)')
        .setMinValue(1)
        .setMaxValue(MAX_DELETE_TOTAL)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'clear',
        details: 'Command used outside a server',
      });
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id))) {
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'clear',
        details: 'User lacks permission',
      });
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || typeof channel.bulkDelete !== 'function') {
      await logCommand(interaction, {
        status: 'FAILURE',
        action: 'clear',
        details: 'Command used outside a text channel',
      });
      return interaction.reply({
        content: 'Please run this command in a text channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const requestedAmount = interaction.options.getInteger('amount');
    const totalToDelete = requestedAmount ?? DEFAULT_DELETE_COUNT;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let deletedTotal = 0;
    let remaining = totalToDelete;
    let blockedByAge = false;
    let skippedPinned = 0;
    let skippedUndeletable = 0;

    while (remaining > 0) {
      const batchSize = Math.min(MAX_DELETE_PER_BATCH, remaining);
      let deletedInBatch = 0;

      try {
        const deleted = await channel.bulkDelete(batchSize, true);
        deletedInBatch = deleted.size;
      } catch (err) {
        if (err?.code === 10008) {
          // Message was already deleted; fall back to single deletes.
          blockedByAge = true;
          break;
        }
        console.error('Failed to bulk delete messages:', err);
        await logCommand(interaction, {
          status: 'FAILURE',
          action: 'clear',
          details: 'Bulk delete failed',
        });
        return interaction.editReply('Something broke while clearing messages.');
      }

      deletedTotal += deletedInBatch;
      remaining -= batchSize;

      if (deletedInBatch === 0) {
        blockedByAge = true;
        break;
      }
    }

    if (remaining > 0) {
      blockedByAge = true;
      let lastId = null;

      while (remaining > 0) {
        const fetched = await channel.messages.fetch({
          limit: Math.min(100, remaining),
          before: lastId ?? undefined,
        });

        if (fetched.size === 0) {
          break;
        }

        const messages = Array.from(fetched.values());
        lastId = messages[messages.length - 1]?.id ?? null;

        for (const message of messages) {
          if (remaining === 0) break;
          if (message.pinned) {
            skippedPinned += 1;
            continue;
          }
          if (!message.deletable) {
            skippedUndeletable += 1;
            continue;
          }
          try {
            await message.delete();
            deletedTotal += 1;
            remaining -= 1;
          } catch (err) {
            if (err?.code === 10008) {
              continue;
            }
            console.error('Failed to delete message:', err);
            skippedUndeletable += 1;
          }
        }
      }
    }

    const ageNote = blockedByAge
      ? ' Messages older than 14 days were deleted individually.'
      : '';
    const skippedNotes = [];
    if (skippedPinned > 0) skippedNotes.push(`${skippedPinned} pinned`);
    if (skippedUndeletable > 0) skippedNotes.push(`${skippedUndeletable} protected`);
    const skippedNote =
      skippedNotes.length > 0
        ? ` Skipped ${skippedNotes.join(' and ')} message${
            skippedNotes.length === 1 && skippedNotes[0].startsWith('1 ') ? '' : 's'
          }.`
        : '';

    await logCommand(interaction, {
      status: 'SUCCESS',
      action: 'clear',
      details: `Cleared ${deletedTotal} message${deletedTotal === 1 ? '' : 's'} in #${channel.name}`,
    });
    return interaction.editReply(
      `Cleared ${deletedTotal} message${deletedTotal === 1 ? '' : 's'} in #${channel.name}.${ageNote}${skippedNote}`
    );
  },
};
