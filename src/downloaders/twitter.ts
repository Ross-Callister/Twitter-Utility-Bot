import { TwitterDL } from "twitter-downloader";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { Config } from "twitter-downloader/lib/types/config";

/**
 * Downloads media from a Twitter link
 * @param url The Twitter URL to download media from
 * @param outputDir Directory to save the downloaded media (default: './downloads')
 * @returns Promise resolving to the paths of downloaded files
 */
export async function downloadTwitterMedia(
  url: string,
  outputDir: string = "./downloads",
  cookie: string
): Promise<string[]> {
  try {
    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Use the twitter-downloader library to get media information
    const options: Config = {
      authorization: "", // undefined == use default authorization
      cookie: cookie, // to display sensitive / nsfw content (no default cookies)
    };

    const { result, status } = await TwitterDL(url, options);

    if (status === "error") {
      throw new Error(`Failed to download`);
    }

    const downloadedFiles: string[] = [];

    console.log(result, status);

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
        const imgUrl = media.image as string;
        const filename = `twitter_img_${Date.now()}_${i}.jpg`;
        const filePath = path.join(outputDir, filename);

        // Use the downloadFile helper to save the image
        await downloadFile(imgUrl, filePath);
        downloadedFiles.push(filePath);
      } else if (media.type === "video") {
        const videoUrl = media.expandedUrl;
        const filename = `twitter_video_${Date.now()}_${i}.mp4`;
        const filePath = path.join(outputDir, filename);

        // Use the downloadFile helper to save the video
        await downloadFile(videoUrl, filePath);
        downloadedFiles.push(filePath);
      } else {
        console.log("Unsupported media type:", media.type);
      }
    }

    return downloadedFiles;
  } catch (error) {
    console.error("Error downloading Twitter media:", error);
    throw error;
  }
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

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}
