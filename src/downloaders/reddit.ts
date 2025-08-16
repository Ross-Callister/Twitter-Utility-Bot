import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { downloadFromSauceNAO, isDirectImageUrl } from "./saucenao";
import { wait } from "../utilities/wait";

interface RedditMediaItem {
  status: string;
  e: string;
  m: string;
  o?: Array<{
    y: number;
    x: number;
    u: string;
  }>;
  p?: Array<{
    y: number;
    x: number;
    u: string;
  }>;
  s?: {
    y: number;
    x: number;
    u: string;
  };
  id: string;
}

interface RedditPost {
  kind: string;
  data: {
    id: string;
    title: string;
    author: string;
    subreddit: string;
    url: string;
    is_gallery?: boolean;
    media_metadata?: { [key: string]: RedditMediaItem };
    gallery_data?: {
      items: Array<{
        media_id: string;
        id: number;
      }>;
    };
    over_18: boolean;
    permalink: string;
    created_utc: number;
  };
}

interface RedditResponse {
  kind: string;
  data: {
    children: RedditPost[];
  };
}

/**
 * Downloads media from a Reddit link
 * @param initialUrl The Reddit URL to download media from
 * @param outputDir Directory to save the downloaded media (default: './downloads')
 * @param twitterCookie Twitter cookie for SauceNAO downloads that route to Twitter
 * @returns Promise resolving to the paths of downloaded files
 */
export async function downloadRedditMedia(
  initialUrl: string,
  outputDir: string = "./downloads",
  twitterCookie?: string
): Promise<string[]> {
  try {
    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Convert Reddit URL to API URL
    const apiUrl = convertToApiUrl(initialUrl);
    if (!apiUrl) {
      throw new Error("Invalid Reddit URL - could not convert to API URL");
    }

    console.log(`Fetching Reddit data from: ${apiUrl}`);

    // Fetch Reddit data
    const response = await axios.get<RedditResponse[]>(apiUrl, {
      headers: {
        "User-Agent": "Discord-Utility-Bot/1.0 (by YourUsername)",
      },
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No data returned from Reddit API");
    }

    const postData = response.data[0]?.data?.children?.[0];
    if (!postData) {
      throw new Error("No post data found in Reddit response");
    }

    const post = postData.data;
    console.log(`Processing Reddit post: "${post.title}" by u/${post.author} in r/${post.subreddit}`);

    const downloadedFiles: string[] = [];

    // Handle gallery posts
    if (post.is_gallery && post.media_metadata && post.gallery_data) {
      console.log(`Found gallery with ${post.gallery_data.items.length} items`);

      for (let i = 0; i < post.gallery_data.items.length; i++) {
        const item = post.gallery_data.items[i];
        const mediaData = post.media_metadata[item.media_id];

        if (!mediaData || mediaData.status !== "valid" || mediaData.e !== "Image") {
          console.log(`Skipping invalid media item: ${item.media_id}`);
          continue;
        }

        // Get the highest quality image URL
        const imageUrl = getHighestQualityImageUrl(mediaData);
        if (!imageUrl) {
          console.log(`No valid image URL found for media item: ${item.media_id}`);
          continue;
        }

        console.log(`Processing gallery item ${i + 1}/${post.gallery_data.items.length}: ${imageUrl}`);

        try {
          // Use SauceNAO downloader for each image
          const files = await downloadFromSauceNAO(imageUrl, outputDir, twitterCookie);
          downloadedFiles.push(...files);
          console.log(`Successfully downloaded gallery item ${i + 1}`);
        } catch (error) {
          console.error(`Error downloading gallery item ${i + 1}:`, error);
          // Continue with next item even if one fails
        }

        // Wait 40 seconds between downloads to respect rate limits
        if (i < post.gallery_data.items.length - 1) {
          console.log("Waiting 40 seconds before next download to respect rate limits...");
          await wait(40_000);
        }
      }
    }
    // Handle single image posts
    else if (post.url && isDirectImageUrl(post.url)) {
      console.log(`Found single image: ${post.url}`);

      try {
        const files = await downloadFromSauceNAO(post.url, outputDir, twitterCookie);
        downloadedFiles.push(...files);
        console.log("Successfully downloaded single image");
      } catch (error) {
        console.error("Error downloading single image:", error);
        throw error;
      }
    }
    // Handle other Reddit URLs that might contain images
    else if (post.url) {
      console.log(`Post URL is not a direct image: ${post.url}`);
      throw new Error("Reddit post does not contain downloadable images or galleries");
    } else {
      throw new Error("No downloadable content found in Reddit post");
    }

    if (downloadedFiles.length === 0) {
      throw new Error("No files were successfully downloaded");
    }

    console.log(`Reddit download completed. Downloaded ${downloadedFiles.length} files.`);
    return downloadedFiles;
  } catch (error) {
    console.error("Error downloading Reddit media:", error);
    throw error;
  }
}

/**
 * Gets the highest quality image URL from Reddit media metadata
 * @param mediaData Reddit media metadata object
 * @returns The highest quality image URL or null if not found
 */
function getHighestQualityImageUrl(mediaData: RedditMediaItem): string | null {
  // Try original quality first (from 'o' array)
  // if (mediaData.o && mediaData.o.length > 0) {
  //   return mediaData.o[0].u.replace(/&amp;/g, "&");
  // }

  // Try source quality (from 's' object)
  if (mediaData.s && mediaData.s.u) {
    return mediaData.s.u.replace(/&amp;/g, "&");
  }

  // Fall back to highest preview quality (from 'p' array)
  if (mediaData.p && mediaData.p.length > 0) {
    // Get the largest preview (last item in array is usually highest quality)
    const highestPreview = mediaData.p[mediaData.p.length - 1];
    return highestPreview.u.replace(/&amp;/g, "&");
  }

  return null;
}

/**
 * Converts a Reddit URL to its API equivalent
 * @param url The Reddit URL to convert
 * @returns The API URL or null if conversion fails
 */
function convertToApiUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);

    // Remove www. if present and ensure it's reddit.com
    const hostname = parsedUrl.hostname.replace(/^www\./, "");
    if (hostname !== "reddit.com") {
      return null;
    }

    // Convert to api.reddit.com and add .json extension if not present
    let apiPath = parsedUrl.pathname;
    if (!apiPath.endsWith(".json")) {
      apiPath = apiPath.replace(/\/$/, "") + ".json";
    }

    return `https://api.reddit.com${apiPath}${parsedUrl.search}?raw_json=1`;
  } catch (error) {
    return null;
  }
}

/**
 * Checks if a URL is a Reddit link
 * @param url The URL to check
 * @returns True if the URL is a Reddit link
 */
export const isRedditLink = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    return (
      hostname === "reddit.com" &&
      (parsedUrl.pathname.includes("/comments/") || parsedUrl.pathname.includes("/gallery/") || parsedUrl.pathname.includes("/r/"))
    );
  } catch (error) {
    return false;
  }
};

/**
 * Gets basic information about a Reddit post without downloading
 * @param url The Reddit URL to analyze
 * @returns Promise resolving to basic post information
 */
export async function getRedditPostInfo(url: string): Promise<{
  title: string;
  author: string;
  subreddit: string;
  isGallery: boolean;
  imageCount: number;
  isNSFW: boolean;
}> {
  const apiUrl = convertToApiUrl(url);
  if (!apiUrl) {
    throw new Error("Invalid Reddit URL");
  }

  const response = await axios.get<RedditResponse[]>(apiUrl, {
    headers: {
      "User-Agent": "Discord-Utility-Bot/1.0 (by YourUsername)",
    },
  });

  const post = response.data[0]?.data?.children?.[0]?.data;
  if (!post) {
    throw new Error("No post data found");
  }

  let imageCount = 0;
  if (post.is_gallery && post.gallery_data) {
    imageCount = post.gallery_data.items.length;
  } else if (post.url && isDirectImageUrl(post.url)) {
    imageCount = 1;
  }

  return {
    title: post.title,
    author: post.author,
    subreddit: post.subreddit,
    isGallery: post.is_gallery || false,
    imageCount,
    isNSFW: post.over_18,
  };
}
