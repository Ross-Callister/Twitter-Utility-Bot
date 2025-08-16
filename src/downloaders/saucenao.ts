import axios from "axios";
import { downloadTwitterMedia, isTwitterOrXLink } from "./twitter";
import { downloadE621Media, isE621Link } from "./e621";

const SAUCENAO_API_KEY = process.env.SAUCENAO_API_KEY;

interface SauceNAOResult {
  header: {
    similarity: string;
    thumbnail: string;
    index_id: number;
    index_name: string;
    dupes: number;
    hidden: number;
  };
  data: {
    ext_urls?: string[];
    source?: string;
    pixiv_id?: number;
    member_name?: string;
    member_id?: number;
    title?: string;
    da_id?: string;
    author_name?: string;
    author_url?: string;
    [key: string]: any;
  };
}

interface SauceNAOResponse {
  header: {
    user_id: string;
    account_type: string;
    short_limit: string;
    long_limit: string;
    long_remaining: number;
    short_remaining: number;
    status: number;
    results_requested: number;
    minimum_similarity: number;
    query_image_display: string;
    query_image: string;
    results_returned: number;
  };
  results: SauceNAOResult[];
}

/**
 * Downloads media using SauceNAO to find the original source
 * @param imageUrl The URL of the image to reverse search
 * @param outputDir Directory to save the downloaded media (default: './downloads')
 * @param twitterCookie Twitter cookie for protected content
 * @returns Promise resolving to the paths of downloaded files
 */
export async function downloadFromSauceNAO(imageUrl: string, outputDir: string = "./downloads", twitterCookie?: string): Promise<string[]> {
  try {
    if (!SAUCENAO_API_KEY) {
      throw new Error("SAUCENAO_API_KEY environment variable is required");
    }

    console.log(`Searching for image source using SauceNAO: ${imageUrl}`);

    // Query SauceNAO API
    const sauceResponse = await axios.get<SauceNAOResponse>("https://saucenao.com/search.php", {
      params: {
        api_key: SAUCENAO_API_KEY,
        output_type: 2, // JSON output
        numres: 16, // Number of results
        url: imageUrl,
        db: 999, // Search all databases
      },
      headers: {
        "User-Agent": "Discord-Utility-Bot/1.0",
      },
    });

    if (sauceResponse.data.header.status !== 0) {
      throw new Error(`SauceNAO API error: ${sauceResponse.data.header.status}`);
    }

    const results = sauceResponse.data.results;
    if (!results || results.length === 0) {
      throw new Error("No results found from SauceNAO");
    }

    // Sort results by similarity (highest first)
    const sortedResults = results.sort((a, b) => parseFloat(b.header.similarity) - parseFloat(a.header.similarity));

    console.log(`Found ${results.length} results. Best match: ${sortedResults[0].header.similarity}% similarity`);
    console.log(`Best match index: ${sortedResults[0].header.index_name}`);

    // Try to find a downloadable source from the results
    for (const result of sortedResults) {
      const similarity = parseFloat(result.header.similarity);

      // Skip results with very low similarity
      if (similarity < 70) {
        console.log(`Skipping result with ${similarity}% similarity (too low)`);
        continue;
      }

      console.log(`Checking result with ${similarity}% similarity from ${result.header.index_name}`);

      // Check if result has external URLs
      if (result.data.ext_urls && result.data.ext_urls.length > 0) {
        for (const url of result.data.ext_urls) {
          console.log(`Checking external URL: ${url}`);

          // Check if it's a Twitter/X link
          if (isTwitterOrXLink(url)) {
            console.log(`Found Twitter/X source: ${url}`);
            if (!twitterCookie) {
              throw new Error("Twitter cookie is required for downloading Twitter content");
            }
            return await downloadTwitterMedia(url, outputDir, twitterCookie);
          }

          // Check if it's an e621 link
          if (isE621Link(url)) {
            console.log(`Found e621 source: ${url}`);
            return await downloadE621Media(url, outputDir);
          }
        }
      }

      // For Pixiv results, we could potentially construct URLs but that's more complex
      if (result.data.pixiv_id) {
        console.log(`Found Pixiv source (ID: ${result.data.pixiv_id}) but Pixiv downloader not implemented`);
      }

      // For other sources, log what we found
      if (result.data.source) {
        console.log(`Found source: ${result.data.source} but no compatible downloader available`);
      }
    }

    // If we get here, no compatible source was found
    const bestResult = sortedResults[0];
    let errorMessage = `No compatible downloader found for the best match (${bestResult.header.similarity}% similarity)`;

    if (bestResult.data.ext_urls && bestResult.data.ext_urls.length > 0) {
      errorMessage += `\nBest match URLs: ${bestResult.data.ext_urls.join(", ")}`;
    } else if (bestResult.data.source) {
      errorMessage += `\nBest match source: ${bestResult.data.source}`;
    }

    errorMessage += `\nSupported sources: Twitter/X, e621`;

    throw new Error(errorMessage);
  } catch (error) {
    console.error("Error in SauceNAO downloader:", error);
    throw error;
  }
}

/**
 * Checks if a URL is a direct image URL that can be reverse searched
 * @param url The URL to check
 * @returns True if the URL appears to be a direct image link
 */
export const isDirectImageUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];

    return imageExtensions.some((ext) => pathname.endsWith(ext));
  } catch (error) {
    return false;
  }
};

/**
 * Gets information about the best match from SauceNAO without downloading
 * @param imageUrl The URL of the image to reverse search
 * @returns Promise resolving to information about the best match
 */
export async function getSauceNAOInfo(imageUrl: string): Promise<{
  similarity: number;
  source: string;
  urls: string[];
  indexName: string;
}> {
  try {
    if (!SAUCENAO_API_KEY) {
      throw new Error("SAUCENAO_API_KEY environment variable is required");
    }

    const sauceResponse = await axios.get<SauceNAOResponse>("https://saucenao.com/search.php", {
      params: {
        api_key: SAUCENAO_API_KEY,
        output_type: 2,
        numres: 5,
        url: imageUrl,
        db: 999,
      },
      headers: {
        "User-Agent": "Discord-Utility-Bot/1.0",
      },
    });

    if (sauceResponse.data.header.status !== 0) {
      throw new Error(`SauceNAO API error: ${sauceResponse.data.header.status}`);
    }

    const results = sauceResponse.data.results;
    if (!results || results.length === 0) {
      throw new Error("No results found from SauceNAO");
    }

    const bestResult = results.sort((a, b) => parseFloat(b.header.similarity) - parseFloat(a.header.similarity))[0];

    return {
      similarity: parseFloat(bestResult.header.similarity),
      source: bestResult.data.source || bestResult.data.title || "Unknown",
      urls: bestResult.data.ext_urls || [],
      indexName: bestResult.header.index_name,
    };
  } catch (error) {
    console.error("Error getting SauceNAO info:", error);
    throw error;
  }
}
