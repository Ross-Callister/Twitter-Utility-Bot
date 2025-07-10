import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

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

/**
 * Resizes an image and returns it as base64
 * @param imagePath Path to the input image file
 * @param maxDimension Maximum allowed dimension (default: 1120)
 * @returns Promise resolving to the base64 string (with data URL prefix)
 */
export async function resizeImageAndGetBase64(imagePath: string, maxDimension: number = 1120): Promise<string> {
  try {
    // Check if input file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Input image file not found: ${imagePath}`);
    }

    // Get image metadata to check current dimensions
    const metadata = await sharp(imagePath).metadata();
    const { width, height } = metadata;

    if (!width || !height) {
      throw new Error("Could not determine image dimensions");
    }

    let processedBuffer: Buffer;

    // Check if resizing is needed
    if (width <= maxDimension && height <= maxDimension) {
      // No resizing needed, just read the original file
      processedBuffer = fs.readFileSync(imagePath);
      console.log(`Image already within limits (${width}x${height}), using original`);
    } else {
      // Calculate new dimensions while maintaining aspect ratio
      let newWidth: number;
      let newHeight: number;

      if (width > height) {
        // Landscape: limit width
        newWidth = Math.min(width, maxDimension);
        newHeight = Math.round((height * newWidth) / width);
      } else {
        // Portrait or square: limit height
        newHeight = Math.min(height, maxDimension);
        newWidth = Math.round((width * newHeight) / height);
      }

      // Resize the image and get buffer
      processedBuffer = await sharp(imagePath)
        .resize(newWidth, newHeight, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toBuffer();

      console.log(`Image resized from ${width}x${height} to ${newWidth}x${newHeight} for base64 conversion`);
    }

    // Get MIME type
    const mimeType = getImageMimeType(imagePath);

    // Convert to base64 and create data URL
    const base64String = processedBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64String}`;

    return dataUrl;
  } catch (error) {
    console.error("Error resizing image and converting to base64:", error);
    throw error;
  }
}
