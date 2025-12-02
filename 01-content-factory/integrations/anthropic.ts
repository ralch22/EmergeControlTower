import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateWithClaude(
  systemPrompt: string,
  userPrompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.7 } = options;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text || "";
}

export async function generateWithClaudeStreaming(
  systemPrompt: string,
  userPrompt: string,
  onChunk: (chunk: string) => void,
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.7 } = options;

  let fullResponse = "";

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const text = event.delta.text;
      fullResponse += text;
      onChunk(text);
    }
  }

  return fullResponse;
}

export interface VisionContent {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    data: string;
  };
}

export interface TextContent {
  type: "text";
  text: string;
}

export type MessageContent = VisionContent | TextContent;

export async function generateWithClaudeVision(
  systemPrompt: string,
  userPrompt: string,
  images: Array<{ base64: string; mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }>,
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.3 } = options;

  const content: MessageContent[] = [];

  for (const image of images) {
    const mediaType = image.mediaType || (image.base64.startsWith("/9j/") ? "image/jpeg" : "image/png");
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: image.base64,
      },
    });
  }

  content.push({
    type: "text",
    text: userPrompt,
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text || "";
}

export { anthropic };
