/**
 * AIService — stub for AI summarization.
 *
 * In production, swap the implementation to call Bedrock, OpenAI, etc.
 * The interface stays the same so callers don't need to change.
 */
export interface DealSummaryInput {
  title: string;
  contactName: string;
  contactEmail: string;
  value: string;
  stage: string;
}

export interface AIService {
  summarizeDeal(input: DealSummaryInput): Promise<string>;
}

export class StubAIService implements AIService {
  async summarizeDeal(input: DealSummaryInput): Promise<string> {
    // Stub: return a templated summary without calling any external API.
    // Replace this with a real LLM call when ready.
    const summary = [
      `Deal: "${input.title}"`,
      `Contact: ${input.contactName} <${input.contactEmail}>`,
      `Value: $${Number(input.value).toLocaleString()}`,
      `Stage: ${input.stage}`,
      `Summary: Promising ${input.stage} stage deal with ${input.contactName}. ` +
        `Property valued at $${Number(input.value).toLocaleString()}.`,
    ].join("\n");

    console.log("[AIService] summarizeDeal (stub)", { title: input.title });
    return summary;
  }
}

export const aiService: AIService = new StubAIService();
