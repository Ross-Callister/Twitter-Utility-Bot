import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message, MessageFlags } from "discord.js";
import fs from "fs";
import path from "path";
import { addPendingSort, getPendingSort, getSortFolders, removePendingSort } from "../db/database";

const FOLDER_PREFIX = "sort:folder:";
const DISCARD_ID = "sort:discard";

// Discord allows 5 rows of 5 buttons; one slot is reserved for the discard button
export const MAX_SORT_FOLDERS = 24;

export const isSortButton = (customId: string): boolean => customId.startsWith(FOLDER_PREFIX) || customId === DISCARD_ID;

/**
 * Replies to the message that triggered a download with one button per sort folder.
 * The prompt is stored in the database so it keeps working however long it waits,
 * including across bot restarts.
 * @param sourceMessage The message containing the link that was downloaded
 * @param files Paths of the downloaded files, all of which get moved together
 */
export async function postSortPrompt(sourceMessage: Message, files: string[]): Promise<void> {
  const buttons = getSortFolders()
    .slice(0, MAX_SORT_FOLDERS)
    .map((folder) => new ButtonBuilder().setCustomId(FOLDER_PREFIX + folder).setLabel(folder).setStyle(ButtonStyle.Primary));
  buttons.push(new ButtonBuilder().setCustomId(DISCARD_ID).setLabel("Delete").setEmoji("🗑️").setStyle(ButtonStyle.Danger));

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }

  const names = files.map((file) => `\`${path.basename(file)}\``);
  const shown = names.length > 10 ? [...names.slice(0, 10), `…and ${names.length - 10} more`] : names;

  const prompt = await sourceMessage.reply({
    content: `Downloaded ${files.length} file${files.length === 1 ? "" : "s"}. Choose a folder:\n${shown.join("\n")}`,
    components: rows,
    allowedMentions: { repliedUser: false },
  });

  addPendingSort({
    prompt_message_id: prompt.id,
    channel_id: prompt.channelId,
    source_message_id: sourceMessage.id,
    files: files.map((file) => path.resolve(file)),
  });
}

/**
 * Handles a click on one of the sort prompt buttons: moves (or deletes) the files,
 * then removes both the prompt and the original link message.
 */
export async function handleSortButton(interaction: ButtonInteraction): Promise<void> {
  const pending = getPendingSort(interaction.message.id);
  if (!pending) {
    await interaction.reply({ content: "This sort request is no longer tracked.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Everything up to removePendingSort is synchronous, so a double click can't move the files twice
  const missing: string[] = [];
  const isDiscard = interaction.customId === DISCARD_ID;
  const folder = interaction.customId.slice(FOLDER_PREFIX.length);

  for (const file of pending.files) {
    if (!fs.existsSync(file)) {
      missing.push(path.basename(file));
      continue;
    }
    if (isDiscard) {
      fs.rmSync(file);
      console.log(`Deleted ${file}`);
    } else {
      const destinationDir = path.join(path.dirname(file), folder);
      fs.mkdirSync(destinationDir, { recursive: true });
      fs.renameSync(file, path.join(destinationDir, path.basename(file)));
      console.log(`Moved ${path.basename(file)} to ${folder}/`);
    }
  }
  removePendingSort(pending.prompt_message_id);

  if (missing.length > 0) {
    await interaction.reply({
      content: `These files were no longer in the downloads folder: ${missing.join(", ")}`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.deferUpdate();
  }

  await interaction.message.delete().catch((error) => console.error("Could not delete sort prompt:", error));
  const channel = interaction.channel ?? (await interaction.client.channels.fetch(pending.channel_id));
  if (channel?.isTextBased()) {
    await channel.messages
      .delete(pending.source_message_id)
      .catch((error) => console.error("Could not delete source message:", error));
  }
}
