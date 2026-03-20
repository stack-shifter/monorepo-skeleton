import { describe, it, expect, vi, afterEach } from "vitest";
import { StubAIService } from "../ai";

describe("StubAIService.summarizeDeal", () => {
  const input = {
    title: "123 Main St",
    contactName: "Jane Smith",
    contactEmail: "jane@example.com",
    value: "425000",
    stage: "qualified",
  };

  afterEach(() => vi.restoreAllMocks());

  it("returns a string summary", async () => {
    const service = new StubAIService();
    const result = await service.summarizeDeal(input);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes the deal title in the summary", async () => {
    const service = new StubAIService();
    const result = await service.summarizeDeal(input);
    expect(result).toContain(input.title);
  });

  it("includes the contact name in the summary", async () => {
    const service = new StubAIService();
    const result = await service.summarizeDeal(input);
    expect(result).toContain(input.contactName);
  });

  it("includes the formatted value in the summary", async () => {
    const service = new StubAIService();
    const result = await service.summarizeDeal(input);
    // 425000 formatted with toLocaleString
    expect(result).toContain("425,000");
  });

  it("logs to console", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const service = new StubAIService();
    await service.summarizeDeal(input);
    expect(consoleSpy).toHaveBeenCalledOnce();
  });
});
