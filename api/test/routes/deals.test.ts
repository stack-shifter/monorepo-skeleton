import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock lib modules before importing the app so route handlers
// never touch a real database or call real business logic.
vi.mock("@repo/lib/core", () => ({
  createDeal: vi.fn(),
  getDealsByTenant: vi.fn(),
}));

vi.mock("@repo/lib/db", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

import { app } from "../../src/app";
import { createDeal, getDealsByTenant } from "@repo/lib/core";

const TENANT_ID = "tenant-123";

const validBody = {
  title: "123 Main St — Buyer Rep",
  contactName: "Jane Smith",
  contactEmail: "jane@example.com",
  value: "425000.00",
  stage: "qualified",
};

beforeEach(() => vi.clearAllMocks());

describe("POST /api/deals", () => {
  it("returns 201 with dealId and activityId on valid input", async () => {
    vi.mocked(createDeal).mockResolvedValue({ dealId: "deal-1", activityId: "act-1" });

    const res = await request(app)
      .post("/api/deals")
      .set("x-tenant-id", TENANT_ID)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ dealId: "deal-1", activityId: "act-1" });
  });

  it("calls createDeal with the parsed body and correct tenantId", async () => {
    vi.mocked(createDeal).mockResolvedValue({ dealId: "deal-1", activityId: "act-1" });

    await request(app)
      .post("/api/deals")
      .set("x-tenant-id", TENANT_ID)
      .send(validBody);

    expect(createDeal).toHaveBeenCalledWith(
      expect.objectContaining({ title: validBody.title, stage: "qualified" }),
      expect.objectContaining({ tenantId: TENANT_ID })
    );
  });

  it("returns 400 when x-tenant-id header is missing", async () => {
    const res = await request(app).post("/api/deals").send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing x-tenant-id header");
  });

  it("returns 400 when title is empty", async () => {
    const res = await request(app)
      .post("/api/deals")
      .set("x-tenant-id", TENANT_ID)
      .send({ ...validBody, title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 400 when contactEmail is not a valid email", async () => {
    const res = await request(app)
      .post("/api/deals")
      .set("x-tenant-id", TENANT_ID)
      .send({ ...validBody, contactEmail: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when value is not a numeric string", async () => {
    const res = await request(app)
      .post("/api/deals")
      .set("x-tenant-id", TENANT_ID)
      .send({ ...validBody, value: "$425,000" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when stage is not a valid enum value", async () => {
    const res = await request(app)
      .post("/api/deals")
      .set("x-tenant-id", TENANT_ID)
      .send({ ...validBody, stage: "unknown" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/deals", () => {
  it("returns 200 with a deals array", async () => {
    const mockDeals = [{ id: "deal-1", title: "Test Deal" }];
    vi.mocked(getDealsByTenant).mockResolvedValue(mockDeals as any);

    const res = await request(app)
      .get("/api/deals")
      .set("x-tenant-id", TENANT_ID);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deals: mockDeals });
  });

  it("calls getDealsByTenant with the correct tenantId", async () => {
    vi.mocked(getDealsByTenant).mockResolvedValue([]);

    await request(app).get("/api/deals").set("x-tenant-id", TENANT_ID);

    expect(getDealsByTenant).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID })
    );
  });

  it("returns 400 when x-tenant-id header is missing", async () => {
    const res = await request(app).get("/api/deals");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing x-tenant-id header");
  });
});

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
