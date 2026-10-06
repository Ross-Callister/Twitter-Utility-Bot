import { Message } from "discord.js";
import { config } from "../config";
import {
  addMonitoredChannel,
  getSortFolders,
  getTwitterCookie,
  isChannelMonitored,
  removeMonitoredChannel,
  setSortFolders,
  setTwitterCookie,
} from "../db/database";
import { downloadTwitterMedia, isTwitterOrXLink } from "../downloaders/twitter";
import { downloadE621Media, isE621Link } from "../downloaders/e621";
import { downloadFromSauceNAO, isDirectImageUrl } from "../downloaders/saucenao";
import { downloadRedditMedia, isRedditLink } from "../downloaders/reddit";
import { MAX_SORT_FOLDERS, postSortPrompt, SortPrompt } from "../processing/manualSort";

const DOWNLOADS_DIR = "./downloads";

/**
 * Runs a download while showing a progress reaction. The sort prompt is posted straight
 * away so a folder can be picked during the download. On failure, removes the prompt,
 * reacts with ❌ and posts a short-lived error.
 */
const downloadAndPrompt = async (message: Message, progressEmoji: string, label: string, download: () => Promise<string[]>) => {
  const progress = await message.react(progressEmoji);
  const downloading = download();
  downloading.catch(() => {}); // Handled below; stops an early failure being reported as unhandled while the prompt posts
  let prompt: SortPrompt | undefined;
  try {
    prompt = await postSortPrompt(message);
    const files = await downloading;
    if (files.length === 0) {
      throw new Error("No files were downloaded");
    }
    await progress.users.remove(message.client.user.id);
    await prompt.finish(files);
  } catch (error) {
    console.error(`Error downloading ${label} media:`, error);
    await prompt?.fail();
    await progress.users.remove(message.client.user.id).catch(() => {});
    await message.react("❌");
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const errorMsg = await message.reply(`${label} download failed: ${errorMessage}`);
    setTimeout(() => errorMsg.delete().catch(() => {}), 10000); // Delete error message after 10 seconds
  }
};

export const handleCommands = async (message: Message) => {
  if (message.author.bot) {
    return;
  }

  const content = message.content.trim();

  // Handle commands
  if (content.startsWith("!")) {
    // Only the command name is lowercased; arguments such as URLs are case-sensitive
    const [rawCommand, ...args] = content.slice(1).split(/\s+/);
    const command = rawCommand.toLowerCase();

    switch (command) {
      case "config":
        if (args[0]?.toLowerCase() === "download") {
          const isMonitored = isChannelMonitored(message.channel.id);
          if (isMonitored) {
            removeMonitoredChannel(message.channel.id);
            await message.reply("Channel will no longer be monitored for Twitter media downloads.");
          } else {
            addMonitoredChannel(message.channel.id, message.guild?.id || "DM");
            await message.reply("Channel will now be monitored for Twitter media downloads.");
          }
        }
        break;

      case "cookie":
        if (message.author.id !== config.admin) {
          await message.reply("Only administrators can set the Twitter cookie.");
          return;
        }
        const cookie = args.join(" ");
        if (cookie) {
          setTwitterCookie(cookie);
          await message.reply("Twitter cookie has been updated.");
          // Delete the command message for security
          await message.delete();
        }
        break;

      case "folders":
        await handleFoldersCommand(message, args);
        break;

      case "sauce":
        if (!isChannelMonitored(message.channel.id)) {
          await message.reply("This channel is not monitored for downloads. Use `!config download` to enable it.");
          return;
        }

        const imageUrl = args[0];
        if (!imageUrl) {
          await message.reply("Please provide an image URL. Usage: `!sauce <image_url>`");
          return;
        }

        if (!isDirectImageUrl(imageUrl)) {
          await message.reply("Please provide a direct image URL (must end with .jpg, .png, .gif, etc.)");
          return;
        }

        await downloadAndPrompt(message, "🔍", "SauceNAO", () => downloadFromSauceNAO(imageUrl, DOWNLOADS_DIR, getTwitterCookie() || undefined));
        break;

      case "reddit":
        if (!isChannelMonitored(message.channel.id)) {
          await message.reply("This channel is not monitored for downloads. Use `!config download` to enable it.");
          return;
        }

        const redditUrl = args[0];
        if (!redditUrl) {
          await message.reply("Please provide a Reddit URL. Usage: `!reddit <reddit_url>`");
          return;
        }

        if (!isRedditLink(redditUrl)) {
          await message.reply("Please provide a valid Reddit URL (e.g., reddit.com/r/subreddit/comments/...)");
          return;
        }

        await downloadAndPrompt(message, "📱", "Reddit", () => downloadRedditMedia(redditUrl, DOWNLOADS_DIR, getTwitterCookie() || undefined));
        break;
    }
    return;
  }

  if (!isChannelMonitored(message.channel.id)) {
    return;
  }

  // Handle Twitter links
  if (isTwitterOrXLink(content)) {
    const cookie = getTwitterCookie();
    if (!cookie) {
      await message.reply("Twitter cookie not set. Please ask an administrator to set it using !cookie command.");
      return;
    }

    await downloadAndPrompt(message, "⏳", "Twitter", () => downloadTwitterMedia(content, DOWNLOADS_DIR, cookie));
  }

  // Handle e621 links
  if (isE621Link(content)) {
    await downloadAndPrompt(message, "⏳", "e621", () => downloadE621Media(content, DOWNLOADS_DIR));
  }

  // Handle direct image URLs with SauceNAO
  if (isDirectImageUrl(content)) {
    await downloadAndPrompt(message, "🔍", "SauceNAO", () => downloadFromSauceNAO(content, DOWNLOADS_DIR, getTwitterCookie() || undefined));
  }

  // Handle Reddit links
  if (isRedditLink(content)) {
    await downloadAndPrompt(message, "📱", "Reddit", () => downloadRedditMedia(content, DOWNLOADS_DIR, getTwitterCookie() || undefined));
  }
};

/**
 * !folders                 - list the sort folders
 * !folders add <name>      - add a sort folder
 * !folders remove <name>   - remove a sort folder (files already in it are untouched)
 */
const handleFoldersCommand = async (message: Message, args: string[]) => {
  const [action, ...rest] = args;
  const name = rest.join(" ").trim().toLowerCase();
  const folders = getSortFolders();

  if (!action) {
    await message.reply(`Sort folders: ${folders.map((f) => `\`${f}\``).join(", ")}\nUse \`!folders add <name>\` or \`!folders remove <name>\`.`);
    return;
  }

  if (message.author.id !== config.admin) {
    await message.reply("Only administrators can change the sort folders.");
    return;
  }

  switch (action.toLowerCase()) {
    case "add":
      // Folder names become directory names and button IDs, so keep them simple
      if (!/^[a-z0-9 _-]{1,50}$/.test(name)) {
        await message.reply("Folder names may only contain letters, numbers, spaces, `-` and `_` (max 50 characters).");
        return;
      }
      if (folders.includes(name)) {
        await message.reply(`\`${name}\` is already a sort folder.`);
        return;
      }
      if (folders.length >= MAX_SORT_FOLDERS) {
        await message.reply(`You can have at most ${MAX_SORT_FOLDERS} sort folders.`);
        return;
      }
      setSortFolders([...folders, name]);
      await message.reply(`Added \`${name}\`. Sort folders: ${[...folders, name].map((f) => `\`${f}\``).join(", ")}`);
      break;

    case "remove":
      if (!folders.includes(name)) {
        await message.reply(`\`${name}\` is not a sort folder.`);
        return;
      }
      setSortFolders(folders.filter((f) => f !== name));
      await message.reply(`Removed \`${name}\`. Existing files in that folder were not touched.`);
      break;

    default:
      await message.reply("Usage: `!folders`, `!folders add <name>` or `!folders remove <name>`.");
  }
};
