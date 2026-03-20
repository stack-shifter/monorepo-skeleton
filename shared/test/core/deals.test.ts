import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDeal, getDealsByTenant } from "../../src/core/deals";
import type { AppContext } from "../../src/core/types";

// Build a mock db where each .insert() call gets its own fluent chain
// so we can return different values for the deal insert vs activity insert.
function makeMockDb(dealId = "deal-123", activityId = "activity-456") {
  const dealReturning = vi.fn().mockResolvedValue([{ id: dealId }]);
  const activityReturning = vi.fn().mockResolvedValue([{ id: activityId }]);
  const dealValues = vi.fn().mockReturnValue({ returning: dealReturning });
  const activityValues = vi.fn().mockReturnValue({ returning: activityReturning });

  const insert = vi.fn()
    .mockReturnValueOnce({ values: dealValues })    // first call  → deal
    .mockReturnValueOnce({ values: activityValues }); // second call → activity

  const findMany = vi.fn();

  return { insert, dealValues, activityValues, query: { deals: { findMany } } };
}

describe("createDeal", () => {
  const tenantId = "tenant-1";
  const validInput = {
    title: "123 Main St",
    contactName: "Jane Smith",
    contactEmail: "jane@example.com",
    value: "425000.00",
  };

  beforeEach(() => vi.clearAllMocks());

  it("returns dealId and activityId", async () => {
    const db = makeMockDb("deal-abc", "act-xyz") as unknown as AppContext["db"];
    const ctx: AppContext = { db, tenantId };

    const result = await createDeal(validInput, ctx);

    expect(result).toEqual({ dealId: "deal-abc", activityId: "act-xyz" });
  });

  it("inserts the deal with the correct tenantId and values", async () => {
    const db = makeMockDb() as unknown as AppContext["db"];
    const ctx: AppContext = { db, tenantId };

    await createDeal(validInput, ctx);

    const [dealInsertValues] = (db as any).dealValues.mock.calls[0];
    expect(dealInsertValues).toMatchObject({
      tenantId,
      title: validInput.title,
      contactName: validInput.contactName,
      contactEmail: validInput.contactEmail,
      value: validInput.value,
    });
  });

  it("defaults stage to 'lead' when not provided", async () => {
    const db = makeMockDb() as unknown as AppContext["db"];
    const ctx: AppContext = { db, tenantId };

    await createDeal(validInput, ctx);

    const [dealInsertValues] = (db as any).dealValues.mock.calls[0];
    expect(dealInsertValues.stage).toBe("lead");
  });

  it("uses the provided stage when specified", async () => {
    const db = makeMockDb() as unknown as AppContext["db"];
    const ctx: AppContext = { db, tenantId };

    await createDeal({ ...validInput, stage: "qualified" }, ctx);

    const [dealInsertValues] = (db as any).dealValues.mock.calls[0];
    expect(dealInsertValues.stage).toBe("qualified");
  });

  it("inserts a deal_created activity as a side effect", async () => {
    const db = makeMockDb() as unknown as AppContext["db"];
    const ctx: AppContext = { db, tenantId };

    await createDeal(validInput, ctx);

    // insert should have been called twice: once for deal, once for activity
    expect(db.insert).toHaveBeenCalledTimes(2);

    const [activityInsertValues] = (db as any).activityValues.mock.calls[0];
    expect(activityInsertValues.type).toBe("deal_created");
    expect(activityInsertValues.tenantId).toBe(tenantId);
  });
});

describe("getDealsByTenant", () => {
  it("returns the deals from the database", async () => {
    const mockDeals = [{ id: "deal-1", title: "Test Deal" }];
    const db = {
      query: { deals: { findMany: vi.fn().mockResolvedValue(mockDeals) } },
    } as unknown as AppContext["db"];
    const ctx: AppContext = { db, tenantId: "tenant-1" };

    const result = await getDealsByTenant(ctx);

    expect(result).toEqual(mockDeals);
    expect(db.query.deals.findMany).toHaveBeenCalledOnce();
  });
});
