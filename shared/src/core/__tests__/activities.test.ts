import { describe, it, expect, vi, beforeEach } from "vitest";
import { logActivity } from "../activities";
import type { AppContext } from "../types";

function makeMockDb(activityId = "activity-123") {
  const returning = vi.fn().mockResolvedValue([{ id: activityId }]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values, returning, query: {} };
}

describe("logActivity", () => {
  const tenantId = "tenant-1";

  beforeEach(() => vi.clearAllMocks());

  it("inserts an activity and returns its id", async () => {
    const db = makeMockDb("activity-abc") as unknown as AppContext["db"];
    const ctx: AppContext = { db, tenantId };

    const id = await logActivity(ctx, { type: "deal_created", dealId: "deal-1" });

    expect(id).toBe("activity-abc");
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("merges tenantId from ctx into the inserted record", async () => {
    const db = makeMockDb() as unknown as AppContext["db"];
    const ctx: AppContext = { db, tenantId: "tenant-xyz" };

    await logActivity(ctx, { type: "email_sent", dealId: "deal-1" });

    // values() receives the full merged record including tenantId
    const [insertedValue] = (db as any).values.mock.calls[0];
    expect(insertedValue.tenantId).toBe("tenant-xyz");
    expect(insertedValue.type).toBe("email_sent");
  });

  it("passes metadata through when provided", async () => {
    const db = makeMockDb() as unknown as AppContext["db"];
    const ctx: AppContext = { db, tenantId };
    const metadata = { to: "jane@example.com", template: "deal_created" };

    await logActivity(ctx, { type: "email_sent", dealId: "deal-1", metadata });

    const [insertedValue] = (db as any).values.mock.calls[0];
    expect(insertedValue.metadata).toEqual(metadata);
  });
});
