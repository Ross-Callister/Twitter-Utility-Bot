import Discord, { Events } from "discord.js";
import { discord_options } from "./discord_options";
import { handleCommands } from "./commands/handleCommands";
import { config } from "./config";

//create our clients
export const client = new Discord.Client(discord_options);

client.on("ready", (e) => {
  console.log("Utility bot has started!");
});

client.on(Events.MessageCreate, handleCommands);

client.login(config.token);
