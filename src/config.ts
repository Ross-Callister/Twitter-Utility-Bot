import dotenv from "dotenv";

dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN,
};
