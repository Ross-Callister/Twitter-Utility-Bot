import { Message } from "discord.js";
import { downloadTwitterMedia, isTwitterOrXLink } from "../downloaders/twitter";
import {
  isChannelMonitored,
  addMonitoredChannel,
  removeMonitoredChannel,
  setTwitterCookie,
  getTwitterCookie,
} from "../db/database";
import { config } from "../config";
import { wait } from "../utilities/wait";

export const handleCommands = async (message: Message) => {
  const content = message.content.toLowerCase();

  // Handle commands
  if (content.startsWith("!")) {
    const [command, ...args] = content.slice(1).split(" ");

    switch (command) {
      case "config":
        if (args[0] === "download") {
          const isMonitored = isChannelMonitored(message.channel.id);
          if (isMonitored) {
            removeMonitoredChannel(message.channel.id);
            await message.reply(
              "Channel will no longer be monitored for Twitter media downloads."
            );
          } else {
            addMonitoredChannel(message.channel.id, message.guild?.id || "DM");
            await message.reply(
              "Channel will now be monitored for Twitter media downloads."
            );
          }
        }
        break;

      case "cookie":
        if (message.author.id !== config.admin) {
          await message.reply(
            "Only administrators can set the Twitter cookie."
          );
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
    }
    return;
  }

  // Handle Twitter links
  if (
    isChannelMonitored(message.channel.id) &&
    isTwitterOrXLink(message.content)
  ) {
    const cookie = getTwitterCookie();
    if (!cookie) {
      await message.reply(
        "Twitter cookie not set. Please ask an administrator to set it using !cookie command."
      );
      return;
    }

    try {
      await downloadTwitterMedia(message.content, "./downloads", cookie);
      message.react("👍");
      await wait(5000); // Wait for 5 seconds before deleting the message
      await message.delete();
    } catch (error) {
      console.error("Error downloading media:", error);
      await message.react("❌");
    }
  }
};
