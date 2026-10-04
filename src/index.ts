import Discord, { Events } from "discord.js";
import { discord_options } from "./discord_options";
import { handleCommands } from "./commands/handleCommands";
import { config } from "./config";
import { getAllMonitoredChannels } from "./db/database";
import { handleSortButton, isSortButton } from "./processing/manualSort";

//create our clients
export const client = new Discord.Client(discord_options);

client.on("clientReady", (e) => {
  console.log("Utility bot has started!");

  // Log monitored channels on startup
  const monitoredChannels = getAllMonitoredChannels();
  console.log(
    `Monitoring ${monitoredChannels.length} channels for Twitter media:`
  );
  monitoredChannels.forEach((channel) => {
    console.log(
      `- Channel ID: ${channel.channel_id} (Guild: ${channel.guild_id})`
    );
  });
});

client.on(Events.MessageCreate, handleCommands);

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() || !isSortButton(interaction.customId)) {
    return;
  }
  try {
    await handleSortButton(interaction);
  } catch (error) {
    console.error("Error handling sort button:", error);
  }
});

client.login(config.token);
