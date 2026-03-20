import { describe, it, expect, vi, afterEach } from "vitest";
import { StubEmailService } from "../email";

describe("StubEmailService.sendDealCreatedConfirmation", () => {
  const payload = {
    to: "jane@example.com",
    contactName: "Jane Smith",
    dealTitle: "123 Main St",
    dealId: "deal-123",
  };

  afterEach(() => vi.restoreAllMocks());

  it("resolves without throwing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const service = new StubEmailService();
    await expect(service.sendDealCreatedConfirmation(payload)).resolves.toBeUndefined();
  });

  it("logs to console with the recipient address", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const service = new StubEmailService();
    await service.sendDealCreatedConfirmation(payload);

    expect(consoleSpy).toHaveBeenCalledOnce();
    const [, loggedPayload] = consoleSpy.mock.calls[0];
    expect(loggedPayload).toMatchObject({ to: payload.to });
  });

  it("includes the deal title in the logged subject", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const service = new StubEmailService();
    await service.sendDealCreatedConfirmation(payload);

    const [, loggedPayload] = consoleSpy.mock.calls[0];
    expect(loggedPayload.subject).toContain(payload.dealTitle);
  });
});
