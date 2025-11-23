import { Agent } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { openai } from "@ai-sdk/openai";

// Simple agent configuration
export const myAgent = new Agent(components.agent, {
    name: "ChatAssistant",
    languageModel: openai("gpt-4o-mini"),
    instructions: `You are a helpful assistant. Provide clear, concise, and friendly responses to user questions.`,
});

