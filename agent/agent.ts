/* Agent Orchestator */
import { defineAgent } from "eve";
import { openai } from "@ai-sdk/openai";

export default defineAgent({
  model: openai("gpt-5-mini"),
  compaction: {
    thresholdPercent: 0.78,
  },
});
