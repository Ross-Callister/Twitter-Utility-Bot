import { ChatBedrockConverse } from "@langchain/aws";
import { ChatMessage } from "@langchain/core/messages";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { resizeImageAndGetBase64 } from "./imageUtils";
import sortDirectives from "../sort_directives.json";

const model = new ChatBedrockConverse({
  model: "us.meta.llama3-2-11b-instruct-v1:0",
  region: "us-west-2",
});

export async function describeImage(imagePath: string): Promise<{ response: string }> {
  if (!imagePath || typeof imagePath !== "string") {
    throw new Error("Invalid input text");
  }

  const base64Image = await resizeImageAndGetBase64(imagePath);

  const response = await model.invoke(
    new ChatPromptValue({
      messages: [
        new ChatMessage({
          role: "system",
          content: "Please describe the contents of the following image in detail.",
        }),
        new ChatMessage({
          role: "system",
          content: [
            {
              type: "image_url",
              image_url: {
                url: base64Image,
              },
            },
          ],
        }),
      ],
    })
  );

  console.log("Response from model:", response.content);

  return { response: response.content as string };
}

type ImageSortDirective = { folder: string; description: string };
export type ImageSortResponse = { image_description: string; folder: string };

export async function sortImage(imagePath: string): Promise<ImageSortResponse> {
  if (!imagePath || typeof imagePath !== "string") {
    throw new Error("Invalid input text");
  }

  const base64Image = await resizeImageAndGetBase64(imagePath);
  const typedSortDirectives: ImageSortDirective[] = sortDirectives as ImageSortDirective[];

  const systemPrompt = `
You are an image sorting assistant. Based on the provided directives, classify the image into one of the specified categories. If the image does not fit any category, return "other".

Directives:
${typedSortDirectives.map((directive) => `- Folder: ${directive.folder}, Description: ${directive.description}`)}

Respond with the folder that best matches the image content. If no match is found, respond with "other".

The format of your response should be the following format:
\`\`\`
{
  "image_description": "A detailed description of the image content",
  "folder": "the folder name where the image should be sorted",
}
\`\`\`

It is important to only return the JSON object without any additional text or explanation. The assistant will refrain from adding any extra comments or context outside of the JSON response.

Example response:
{
  "image_description": "A beautiful sunset over the mountains",
  "folder": "nature/sunsets"
}`;

  const response = await model.invoke(
    new ChatPromptValue({
      messages: [
        new ChatMessage({
          role: "system",
          content: systemPrompt,
        }),
        new ChatMessage({
          role: "system",
          content: [
            {
              type: "image_url",
              image_url: {
                url: base64Image,
              },
            },
          ],
        }),
      ],
    })
  );

  const sortResponse = JSON.parse(response.content as string) as ImageSortResponse; // Ensure the response is valid JSON

  return sortResponse;
}
