import { Message } from "discord.js";
import { config } from "../config";
import { addMonitoredChannel, getTwitterCookie, isChannelMonitored, removeMonitoredChannel, setTwitterCookie } from "../db/database";
import { downloadTwitterMedia, isTwitterOrXLink } from "../downloaders/twitter";
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
};
