import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Client, Message, MessageFlags } from "discord.js";
import fs from "fs";
import path from "path";
import { addPendingSort, getPendingSort, getSortFolders, removePendingSort } from "../db/database";

const FOLDER_PREFIX = "sort:folder:";
const DISCARD_ID = "sort:discard";

// Discord allows 5 rows of 5 buttons; one slot is reserved for the discard button
export const MAX_SORT_FOLDERS = 24;

export const isSortButton = (customId: string): boolean => customId.startsWith(FOLDER_PREFIX) || customId === DISCARD_ID;

/**
 * Prompts whose download is still running, keyed by prompt message ID, with the button
 * pressed so far (if any). Once the download finishes the prompt moves to the database.
 * This is in-memory only: a download interrupted by a restart can't complete anyway.
 */
const inFlight = new Map<string, { choice?: string }>();

export interface SortPrompt {
  /** Applies the choice made during the download, or waits for one in the database. */
  finish(files: string[]): Promise<void>;
  /** Removes the prompt after a failed download. */
  fail(): Promise<void>;
}

/** Builds the button rows, highlighting the button chosen while the download was running. */
const buildRows = (selected?: string): ActionRowBuilder<ButtonBuilder>[] => {
  const buttons = getSortFolders()
    .slice(0, MAX_SORT_FOLDERS)
    .map((folder) =>
      new ButtonBuilder()
        .setCustomId(FOLDER_PREFIX + folder)
        .setLabel(folder)
        .setStyle(selected === FOLDER_PREFIX + folder ? ButtonStyle.Success : ButtonStyle.Primary)
    );
  buttons.push(new ButtonBuilder().setCustomId(DISCARD_ID).setLabel("Delete").setEmoji("🗑️").setStyle(ButtonStyle.Danger));

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
};

/**
 * Moves (or deletes, for the discard button) the files. Fully synchronous, so a second
 * click can't act on the same files twice. Returns the names of files that were missing.
 */
const applySort = (files: string[], customId: string): string[] => {
  const missing: string[] = [];
  const isDiscard = customId === DISCARD_ID;
  const folder = customId.slice(FOLDER_PREFIX.length);

  for (const file of files) {
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
  return missing;
};

/** Deletes the sort prompt and the original link message once the files have been sorted. */
const deleteMessages = async (client: Client, channelId: string, promptMessageId: string, sourceMessageId: string) => {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    return;
  }
  await channel.messages.delete(promptMessageId).catch((error) => console.error("Could not delete sort prompt:", error));
  await channel.messages.delete(sourceMessageId).catch((error) => console.error("Could not delete source message:", error));
};

/**
 * Replies to the message that triggered a download with one button per sort folder.
 * This is posted as soon as the download starts; a button pressed before it finishes is
 * remembered and applied when it does. After that the prompt is stored in the database
 * so it keeps working however long it waits, including across bot restarts.
 * @param sourceMessage The message containing the link being downloaded
 */
export async function postSortPrompt(sourceMessage: Message): Promise<SortPrompt> {
  const prompt = await sourceMessage.reply({
    content: "Downloading… you can choose a folder now.",
    components: buildRows(),
    allowedMentions: { repliedUser: false },
  });
  inFlight.set(prompt.id, {});

  return {
    async finish(files) {
      const resolved = files.map((file) => path.resolve(file));
      const choice = inFlight.get(prompt.id)?.choice;
      inFlight.delete(prompt.id);

      if (choice) {
        const missing = applySort(resolved, choice);
        if (missing.length > 0) {
          console.warn(`Files missing after download: ${missing.join(", ")}`);
        }
        await deleteMessages(prompt.client, prompt.channelId, prompt.id, sourceMessage.id);
        return;
      }

      // Store before editing, so a click that arrives during the edit is already handled
      addPendingSort({
        prompt_message_id: prompt.id,
        channel_id: prompt.channelId,
        source_message_id: sourceMessage.id,
        files: resolved,
      });

      const names = files.map((file) => `\`${path.basename(file)}\``);
      const shown = names.length > 10 ? [...names.slice(0, 10), `…and ${names.length - 10} more`] : names;
      // Fails harmlessly if a click already sorted the files and deleted the prompt
      await prompt
        .edit({ content: `Downloaded ${files.length} file${files.length === 1 ? "" : "s"}. Choose a folder:\n${shown.join("\n")}` })
        .catch(() => {});
    },

    async fail() {
      inFlight.delete(prompt.id);
      await prompt.delete().catch(() => {});
    },
  };
}

/**
 * Handles a click on one of the sort prompt buttons. While the download is running the
 * choice is just recorded (and can still be changed); otherwise the files are moved (or
 * deleted) and both the prompt and the original link message are removed.
 */
export async function handleSortButton(interaction: ButtonInteraction): Promise<void> {
  const download = inFlight.get(interaction.message.id);
  if (download) {
    download.choice = interaction.customId;
    const action =
      interaction.customId === DISCARD_ID ? "deleted" : `moved to \`${interaction.customId.slice(FOLDER_PREFIX.length)}\``;
    await interaction.update({
      content: `Downloading… files will be ${action} when it finishes. Press another button to change this.`,
      components: buildRows(interaction.customId),
    });
    return;
  }

  const pending = getPendingSort(interaction.message.id);
  if (!pending) {
    await interaction.reply({ content: "This sort request is no longer tracked.", flags: MessageFlags.Ephemeral });
    return;
  }

  // applySort and removePendingSort are synchronous, so a double click can't move the files twice
  const missing = applySort(pending.files, interaction.customId);
  removePendingSort(pending.prompt_message_id);

  if (missing.length > 0) {
    await interaction.reply({
      content: `These files were no longer in the downloads folder: ${missing.join(", ")}`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.deferUpdate();
  }

  await deleteMessages(interaction.client, pending.channel_id, pending.prompt_message_id, pending.source_message_id);
}
