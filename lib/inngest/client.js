import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "nexora-ai",
  eventKey: process.env.INNGEST_EVENT_KEY,
});