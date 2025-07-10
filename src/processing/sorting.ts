import { ChatBedrockConverse } from "@langchain/aws";
import { ChatMessage } from "@langchain/core/messages";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { loadImageAsBase64 } from "./imageUtils";

const model = new ChatBedrockConverse({
  model: "us.meta.llama3-2-11b-instruct-v1:0",
  region: "us-west-2",
});

export async function sortImage(imagePath: string): Promise<{ response: string }> {
  if (!imagePath || typeof imagePath !== "string") {
    throw new Error("Invalid input text");
  }

  const base64Image = await loadImageAsBase64(imagePath);

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
