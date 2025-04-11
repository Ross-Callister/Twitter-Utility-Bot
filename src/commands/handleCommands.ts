import { Message } from "discord.js";
import { downloadTwitterMedia } from "../downloaders/twitter";

const TARGET_CHANNEL = "386395766505340939";
const COOKIE = `guest_id="173287089555056494; kdt=RJi9AeJt9PWNyFz4gpqvFGSz7UNPLvRrEQ5bgUwF; twid=u%3D1731571904; ct0=87fafda52e611e7c84433ba741ea59ed86562c924ff94a8081123e3be4d503d30b8a80e772af163c68e9f10ed0cd7e7fc91021f8a5e72fbc35aa9a4df764667ea1690b0fa5b2f1d42eec18abc02fcd44; auth_token=7e6af65aaf84f19c60844f951424fd57b9973b97; guest_id_marketing=v1%3A173287089555056494; guest_id_ads=v1%3A173287089555056494; personalization_id="v1_VoIFmotb5RseYU+neHFEsg=="; lang=en; __cf_bm=TOps3YZPa0LACMWABnSADxf.SF0b_b_UTMXCFcyGJ2Y-1744201732-1.0.1.1-9lA62zdZy0evL537o78g4YICx0uetreLXWGVKYtoPJhb31GbZWZbqQ.Zgt7Uujp0BuSrI88wTQl.EtqHYWBDruzw_CaeFU8B0TZiKg1XsGM"`;

export const handleCommands = async (message: Message) => {
  const channelId = message.channel.id;

  if (channelId !== TARGET_CHANNEL) {
    return;
  }

  if (isTwitterOrXLink(message.content)) {
    message.react("👍");
    await downloadTwitterMedia(message.content, "./downloads", COOKIE);
  }
};

const isTwitterOrXLink = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return hostname === "x.com" || hostname === "twitter.com";
  } catch (error) {
    // If the URL is invalid, return false
    return false;
  }
};
