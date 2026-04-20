import { Inngest } from "inngest";

// The 'id' must match your project name in the Inngest dashboard
export const inngest = new Inngest({
  id: "nexora-ai", 
  name: "Nexora AI",
  eventKey: process.env.INNGEST_EVENT_KEY,
});