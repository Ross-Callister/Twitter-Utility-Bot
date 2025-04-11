import Discord, { Events } from "discord.js";
import { discord_options } from "./discord_options";
import { handleCommands } from "./commands/handleCommands";
import { config } from "./config";
import { getAllMonitoredChannels } from "./db/database";

//create our clients
export const client = new Discord.Client(discord_options);

client.on("ready", (e) => {
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

client.login(config.token);
