import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type ChatReply = {
  message: ChatMessage;
  /** False until a model is wired — lets the UI show a "preview" state. */
  live: boolean;
};
