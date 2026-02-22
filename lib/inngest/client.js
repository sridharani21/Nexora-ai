import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "nexora-ai", name: "Nexora AI",
    crendentials: {
        gemini: {
            apiKey: process.env.GEMINI_API_KEY,
        },
    },
 });