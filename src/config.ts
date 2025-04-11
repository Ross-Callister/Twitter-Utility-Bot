import dotenv from "dotenv";

dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN as string,
  admin: process.env.ADMIN_USER_ID as string,
};
