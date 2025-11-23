import { Agent } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { openai } from "@ai-sdk/openai";

/**
 * AI agent configuration for generating chat responses.
 * Uses OpenAI's gpt-4o-mini model with a helpful assistant persona.
 * This agent is used to generate responses to user messages in chats.
 */
export const myAgent = new Agent(components.agent, {
    name: "ChatAssistant",
    languageModel: openai("gpt-4o-mini"),
    instructions: `You are a helpful assistant. Provide clear, concise, and friendly responses to user questions.`,
});

