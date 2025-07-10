import * as fs from "fs";
import * as path from "path";

/**
 * Loads an image file and converts it to base64 format
 * @param imagePath Path to the image file
 * @returns Promise resolving to the base64 string (with data URL prefix)
 */
export async function loadImageAsBase64(imagePath: string): Promise<string> {
  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Read the file as a buffer
    const imageBuffer = fs.readFileSync(imagePath);

    // Get the file extension to determine MIME type
    const extension = path.extname(imagePath).toLowerCase();
    let mimeType: string;

    switch (extension) {
      case ".jpg":
      case ".jpeg":
        mimeType = "image/jpeg";
        break;
      case ".png":
        mimeType = "image/png";
        break;
      case ".gif":
        mimeType = "image/gif";
        break;
      case ".webp":
        mimeType = "image/webp";
        break;
      case ".bmp":
        mimeType = "image/bmp";
        break;
      case ".svg":
        mimeType = "image/svg+xml";
        break;
      default:
        mimeType = "image/jpeg"; // Default fallback
    }

    // Convert buffer to base64 and create data URL
    const base64String = imageBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64String}`;

    return dataUrl;
  } catch (error) {
    console.error("Error loading image as base64:", error);
    throw error;
  }
}

/**
 * Loads an image file and returns just the base64 string without data URL prefix
 * @param imagePath Path to the image file
 * @returns Promise resolving to the base64 string only
 */
export async function loadImageAsBase64Raw(imagePath: string): Promise<string> {
  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Read the file as a buffer
    const imageBuffer = fs.readFileSync(imagePath);

    // Convert buffer to base64
    const base64String = imageBuffer.toString("base64");

    return base64String;
  } catch (error) {
    console.error("Error loading image as base64:", error);
    throw error;
  }
}

/**
 * Gets the MIME type of an image based on its file extension
 * @param imagePath Path to the image file
 * @returns The MIME type string
 */
export function getImageMimeType(imagePath: string): string {
  const extension = path.extname(imagePath).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "image/jpeg"; // Default fallback
  }
}
