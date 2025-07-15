import { TwitterDL } from "twitter-downloader";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { Config } from "twitter-downloader/lib/types/config";
import { sortImage } from "../processing/sorting";

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

    const { result, status, message } = await TwitterDL(url, options);

    if (status === "error") {
      console.log(result, message);
      throw new Error(`Failed to download`);
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
        const imgUrl = media.image as string;
        const extension = path.extname(imgUrl).split("?")[0].replace(".", ""); // Get the file extension without query parameters
        const filename = `${result.author.username}_${result.id}_${i}.${extension}`;
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
    //check that files actually have downloaded
    downloadedFiles.forEach((file) => {
      if (!fs.existsSync(file)) {
        throw new Error(`File not downloaded: ${file}`);
      } else {
        console.log(`File downloaded successfully: ${file}`);
      }
    });

    // Sort downloaded images into appropriate subfolders
    const sortedFiles: string[] = [];
    for (const filePath of downloadedFiles) {
      try {
        // Only sort image files (skip videos)
        const extension = path.extname(filePath).toLowerCase();
        if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(extension)) {
          console.log(`Sorting image: ${filePath}`);
          const result = await sortImage(filePath);
          console.log(`Image description: ${result.image_description}`);
          console.log(`Image sorted into folder: ${result.folder}`);

          // Create the destination folder if it doesn't exist
          const destinationDir = path.join(outputDir, result.folder);
          if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
            console.log(`Created directory: ${destinationDir}`);
          }

          // Move the file to the appropriate subfolder
          const fileName = path.basename(filePath);
          const destinationPath = path.join(destinationDir, fileName);

          fs.renameSync(filePath, destinationPath);
          console.log(`Moved ${fileName} to ${result.folder}/`);
          sortedFiles.push(destinationPath);
        } else {
          // Keep non-image files in their original location
          sortedFiles.push(filePath);
        }
      } catch (error) {
        console.error(`Error sorting file ${filePath}:`, error);
        // If sorting fails, keep the file in its original location
        sortedFiles.push(filePath);
      }
    }

    return sortedFiles;
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
