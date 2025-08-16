import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { sortImage } from "../processing/sorting";

const USERNAME = process.env.E621_USERNAME;
const API_KEY = process.env.E621_API_KEY;

interface E621Post {
  post: {
    id: number;
    created_at: string;
    updated_at: string;
    file: {
      url: string | null;
      ext: string;
      width: number;
      height: number;
      size: number;
      md5: string;
    };
    tags: {
      general: string[];
      artist: string[];
      character: string[];
      species: string[];
      copyright: string[];
      meta: string[];
      lore: string[];
    };
    rating: string; // s, q, or e (safe, questionable, explicit)
    sources: string[];
    description: string;
    fav_count: number;
    uploader_id: number;
  };
}

/**
 * Downloads media from an e621 link
 * @param initialUrl The e621 URL to download media from
 * @param outputDir Directory to save the downloaded media (default: './downloads')
 * @returns Promise resolving to the paths of downloaded files
 */
export async function downloadE621Media(initialUrl: string, outputDir: string = "./downloads"): Promise<string[]> {
  try {
    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Extract post ID from URL and construct API URL
    const postId = extractPostId(initialUrl);
    if (!postId) {
      throw new Error("Invalid e621 URL - could not extract post ID");
    }

    const apiUrl = `https://e621.net/posts/${postId}.json`;
    console.log(`Fetching e621 post data from: ${apiUrl}`);

    // Set user agent as required by e621 API
    const response = await axios.get<E621Post>(apiUrl, {
      headers: {
        Authorization: "Basic " + btoa(`${USERNAME}:${API_KEY}`),
        "User-Agent": "Discord-Utility-Bot/1.0 (by YourUsername on e621)",
      },
    });

    const post = response.data.post;

    if (!post.file.url) {
      throw new Error("No downloadable file found for this post");
    }

    // Generate filename with artist and post ID
    const artistName = post.tags.artist.length > 0 ? post.tags.artist[0] : "unknown_artist";
    const filename = `e621_${artistName}_${post.id}.${post.file.ext}`;
    const filePath = path.join(outputDir, filename);

    console.log(`Downloading e621 file: ${post.file.url}`);
    console.log(`Post info - ID: ${post.id}, Artist: ${post.tags.artist.join(", ") || "Unknown"}, Rating: ${post.rating}`);
    console.log(`Tags: ${[...post.tags.general, ...post.tags.character, ...post.tags.species].slice(0, 5).join(", ")}...`);

    // Download the file
    await downloadFile(post.file.url, filePath);

    const downloadedFiles: string[] = [filePath];

    // Check that the file actually downloaded
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not downloaded: ${filePath}`);
    } else {
      console.log(`File downloaded successfully: ${filePath}`);
    }

    // Sort downloaded images into appropriate subfolders
    const sortedFiles: string[] = [];
    for (const downloadedFilePath of downloadedFiles) {
      try {
        // Only sort image files (skip videos and other formats)
        const extension = path.extname(downloadedFilePath).toLowerCase();
        if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(extension)) {
          console.log(`Sorting image: ${downloadedFilePath}`);
          const result = await sortImage(downloadedFilePath);
          console.log(`Image description: ${result.image_description}`);
          console.log(`Image sorted into folder: ${result.folder}`);

          // Create the destination folder if it doesn't exist
          const destinationDir = path.join(outputDir, result.folder);
          if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
            console.log(`Created directory: ${destinationDir}`);
          }

          // Move the file to the appropriate subfolder
          const fileName = path.basename(downloadedFilePath);
          const destinationPath = path.join(destinationDir, fileName);

          fs.renameSync(downloadedFilePath, destinationPath);
          console.log(`Moved ${fileName} to ${result.folder}/`);
          sortedFiles.push(destinationPath);
        } else {
          // Keep non-image files in their original location
          sortedFiles.push(downloadedFilePath);
        }
      } catch (error) {
        console.error(`Error sorting file ${downloadedFilePath}:`, error);
        // If sorting fails, keep the file in its original location
        sortedFiles.push(downloadedFilePath);
      }
    }

    return sortedFiles;
  } catch (error) {
    console.error("Error downloading e621 media:", error);
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
    headers: {
      "User-Agent": "Discord-Utility-Bot/1.0 (by YourUsername on e621)",
    },
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

/**
 * Checks if a URL is an e621 link
 * @param url The URL to check
 * @returns True if the URL is an e621 link
 */
export const isE621Link = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return hostname === "e621.net" && parsedUrl.pathname.includes("/posts/");
  } catch (error) {
    // If the URL is invalid, return false
    return false;
  }
};

/**
 * Extracts the post ID from an e621 URL
 * @param url The e621 URL
 * @returns The post ID or null if not found
 */
function extractPostId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const pathMatch = parsedUrl.pathname.match(/\/posts\/(\d+)/);
    return pathMatch ? pathMatch[1] : null;
  } catch (error) {
    return null;
  }
}
