import { TwitterDL } from "twitter-downloader";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";

/**
 * Downloads media from a Twitter link
 * @param a The Twitter URL to download media from
 * @param outputDir Directory to save the downloaded media (default: './downloads')
 * @returns Promise resolving to the paths of downloaded files
 */
export async function downloadTwitterMedia(initialUrl: string, outputDir: string = "./downloads", cookie: string): Promise<string[]> {
  const url = convertToTwitterUrl(initialUrl); // Convert to x.com link

  try {
    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Use the twitter-downloader library to get media information
    const options: any = {
      cookie: cookie, // to display sensitive / nsfw content (no default cookies)
    };

    if (process.env.TWITTER_AUTHORIZATION) {
      options.authorization = process.env.TWITTER_AUTHORIZATION; // Twitter API Bearer Token
    }

    const { result, status, message } = await TwitterDL(url, options);

    if (status === "error") {
      console.log(result, status, message);
      throw new Error(`Failed to download: ${message}`);
    }

    const downloadedFiles: string[] = [];

    if (result === undefined) {
      return [];
    }

    for (let i = 0; i < result.media.length; i++) {
      const media = result.media[i];
      if (media.type === "photo") {
        if (!media.image) {
          console.log("No image URL found for media:", media);
          continue; // Skip if no image URL is found
        }
        const extension = path.extname(new URL(media.image).pathname).replace(".", "") || "jpg";
        const filename = `${result.author.username}_${result.id}_${i}.${extension}`;
        const filePath = path.join(outputDir, filename);

        // media.image is the default (resized) rendition; ask for the original upload
        await downloadFile(toOriginalImageUrl(media.image), filePath);
        downloadedFiles.push(filePath);
      } else if (media.type === "video" || media.type === "animated_gif") {
        // expandedUrl is the tweet's web page, not the video. The actual mp4 files
        // are in media.videos, one per quality level; take the highest bitrate.
        const best = (media.videos ?? []).filter((v) => v.url).sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
        if (!best) {
          console.log("No video URL found for media:", media);
          continue;
        }
        const filename = `${result.author.username}_${result.id}_${i}.mp4`;
        const filePath = path.join(outputDir, filename);

        await downloadFile(best.url, filePath);
        downloadedFiles.push(filePath);
      } else {
        console.log("Unsupported media type:", media.type);
      }
    }

    if (downloadedFiles.length === 0) {
      throw new Error("No downloadable media found in tweet");
    }

    downloadedFiles.forEach((file) => console.log(`File downloaded successfully: ${file}`));
    return downloadedFiles;
  } catch (error) {
    console.error("Error downloading Twitter media:", error);
    throw error;
  }
}

/**
 * Converts a pbs.twimg.com image URL to the original-resolution variant
 * e.g. https://pbs.twimg.com/media/abc.jpg -> https://pbs.twimg.com/media/abc?format=jpg&name=orig
 */
function toOriginalImageUrl(imageUrl: string): string {
  const parsed = new URL(imageUrl);
  const extension = path.extname(parsed.pathname);
  if (!extension) {
    return imageUrl;
  }
  parsed.pathname = parsed.pathname.slice(0, -extension.length);
  parsed.search = `?format=${extension.slice(1)}&name=orig`;
  return parsed.toString();
}

/**
 * Helper function to download a file from a URL
 * @param url URL of the file to download
 * @param outputPath Path where the file should be saved
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  console.log("Downloading file from:", url);

  const response = await axios({
    method: "GET",
    url: url,
    responseType: "stream",
  });

  const contentType = String(response.headers["content-type"] ?? "");
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    response.data.destroy();
    throw new Error(`Expected image/video from ${url}, got "${contentType}"`);
  }

  await pipeline(response.data, fs.createWriteStream(outputPath));
}

export const isTwitterOrXLink = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return hostname === "x.com" || hostname === "twitter.com" || hostname === "fixupx.com" || hostname === "fxtwitter.com";
  } catch (error) {
    // If the URL is invalid, return false
    return false;
  }
};

//This function converts the twitter URL to an x.com link
function convertToTwitterUrl(url: string): string {
  const parsedUrl = new URL(url);
  parsedUrl.hostname = "twitter.com";
  return parsedUrl.toString();
}
