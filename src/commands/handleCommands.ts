import { Message } from "discord.js";
import { config } from "../config";
import { addMonitoredChannel, getTwitterCookie, isChannelMonitored, removeMonitoredChannel, setTwitterCookie } from "../db/database";
import { downloadTwitterMedia, isTwitterOrXLink } from "../downloaders/twitter";
import { downloadE621Media, isE621Link } from "../downloaders/e621";
import { downloadFromSauceNAO, isDirectImageUrl } from "../downloaders/saucenao";
import { downloadRedditMedia, isRedditLink } from "../downloaders/reddit";
import { describeImage, sortImage } from "../processing/sorting";
import { wait } from "../utilities/wait";
import fs from "fs";
import path from "path";

export const handleCommands = async (message: Message) => {
  const content = message.content.toLowerCase();

  const imagesDir = path.join(__dirname, "../../test_images");
  const images = fs.readdirSync(imagesDir).filter((file: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file)) as string[];

  // Handle commands
  if (content.startsWith("!")) {
    const [command, ...args] = content.slice(1).split(" ");

    switch (command) {
      case "imagetest":
        //get all images in the test_images folder and process them

        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          const imagePath = `./test_images/${image}`;
          console.log(`Processing image: ${imagePath}`);
          try {
            const result = await sortImage(imagePath);
            console.log(`Image description: ${result.image_description}`);
            console.log(`Image sorted into folder: ${result.folder}`);

            // Create the destination folder if it doesn't exist
            const destinationDir = path.join(__dirname, "../../test_images", result.folder);
            if (!fs.existsSync(destinationDir)) {
              fs.mkdirSync(destinationDir, { recursive: true });
              console.log(`Created directory: ${destinationDir}`);
            }

            // Move the file to the appropriate subfolder
            const sourcePath = path.join(imagesDir, image);
            const destinationPath = path.join(destinationDir, image);

            fs.renameSync(sourcePath, destinationPath);
            console.log(`Moved ${image} to ${result.folder}/`);
          } catch (error) {
            console.error(`Error processing image ${image}:`, error);
          }
          await wait(5000);
        }

        break;
      case "identify":
        for (let i = 0; i < images.length; i++) {
          describeImage(`./test_images/${images[i]}`);
        }
        break;
      case "config":
        if (args[0] === "download") {
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

        const twitterCookie = getTwitterCookie();

        try {
          await message.react("🔍");
          await downloadFromSauceNAO(imageUrl, "./downloads", twitterCookie || undefined);
          await message.reactions.removeAll();
          await message.react("👍");
          await wait(5000); // Wait for 5 seconds before deleting the message
          await message.delete();
        } catch (error) {
          console.error("Error with sauce command:", error);
          await message.reactions.removeAll();
          await message.react("❌");
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          await message.reply(`SauceNAO search failed: ${errorMessage}`);
        }
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

        const redditTwitterCookie = getTwitterCookie();

        try {
          await message.react("📱");
          await downloadRedditMedia(redditUrl, "./downloads", redditTwitterCookie || undefined);
          await message.reactions.removeAll();
          await message.react("👍");
          await message.reply("Successfully downloaded Reddit media!");
        } catch (error) {
          console.error("Error with reddit command:", error);
          await message.reactions.removeAll();
          await message.react("❌");
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          await message.reply(`Reddit download failed: ${errorMessage}`);
        }
        break;
    }
    return;
  }

  // Handle Twitter links
  if (isChannelMonitored(message.channel.id) && isTwitterOrXLink(message.content)) {
    const cookie = getTwitterCookie();
    if (!cookie) {
      await message.reply("Twitter cookie not set. Please ask an administrator to set it using !cookie command.");
      return;
    }

    try {
      await downloadTwitterMedia(message.content, "./downloads", cookie);
      await message.react("👍");
      await wait(5000); // Wait for 5 seconds before deleting the message
      await message.delete();
    } catch (error) {
      console.error("Error downloading media:", error);
      await message.react("❌");
    }
  }

  // Handle e621 links
  if (isChannelMonitored(message.channel.id) && isE621Link(message.content)) {
    try {
      await downloadE621Media(message.content, "./downloads");
      await message.react("👍");
      await wait(5000); // Wait for 5 seconds before deleting the message
      await message.delete();
    } catch (error) {
      console.error("Error downloading e621 media:", error);
      await message.react("❌");
    }
  }

  // Handle direct image URLs with SauceNAO
  if (isChannelMonitored(message.channel.id) && isDirectImageUrl(message.content)) {
    const cookie = getTwitterCookie();

    try {
      await message.react("🔍"); // React with magnifying glass to show we're searching
      await downloadFromSauceNAO(message.content, "./downloads", cookie || undefined);
      await message.reactions.removeAll(); // Remove the search reaction
      await message.react("👍");
      await wait(5000); // Wait for 5 seconds before deleting the message
      await message.delete();
    } catch (error) {
      console.error("Error downloading via SauceNAO:", error);
      await message.reactions.removeAll();
      await message.react("❌");
      // Optionally send a brief error message
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      const errorMsg = await message.reply(`SauceNAO search failed: ${errorMessage}`);
      setTimeout(() => errorMsg.delete().catch(() => {}), 10000); // Delete error message after 10 seconds
    }
  }

  // Handle Reddit links
  if (isChannelMonitored(message.channel.id) && isRedditLink(message.content)) {
    const cookie = getTwitterCookie();

    try {
      await message.react("📱"); // React with mobile phone to show we're processing Reddit
      await downloadRedditMedia(message.content, "./downloads", cookie || undefined);
      await message.reactions.removeAll(); // Remove the processing reaction
      await message.react("👍");
      await wait(5000); // Wait for 5 seconds before deleting the message
      await message.delete();
    } catch (error) {
      console.error("Error downloading Reddit media:", error);
      await message.reactions.removeAll();
      await message.react("❌");
      // Send error message that auto-deletes
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      const errorMsg = await message.reply(`Reddit download failed: ${errorMessage}`);
      setTimeout(() => errorMsg.delete().catch(() => {}), 10000); // Delete error message after 10 seconds
    }
  }
};
