import { Router } from "express";
import { z } from "zod";
import { createDeal, getDealsByTenant } from "@repo/core";
import { getDb } from "@repo/db";

const router = Router();

// Validate the incoming request body
const CreateDealSchema = z.object({
  title: z.string().min(1).max(255),
  contactName: z.string().min(1).max(255),
  contactEmail: z.string().email(),
  value: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a numeric string, e.g. '425000.00'"),
  stage: z
    .enum(["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"])
    .optional(),
});

/**
 * POST /deals
 *
 * Example request:
 * {
 *   "title": "123 Main St — Buyer Rep",
 *   "contactName": "Jane Smith",
 *   "contactEmail": "jane@example.com",
 *   "value": "425000.00",
 *   "stage": "qualified"
 * }
 */
router.post("/", async (req, res) => {
  const parsed = CreateDealSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // In production, extract tenantId from the auth token / session.
  // For this example we read it from a header.
  const tenantId = req.headers["x-tenant-id"] as string | undefined;
  if (!tenantId) {
    return res.status(400).json({ error: "Missing x-tenant-id header" });
  }

  const db = getDb();
  const ctx = { db, tenantId };

  // The route is a thin wrapper — all logic lives in @repo/core
  const result = await createDeal(parsed.data, ctx);

  return res.status(201).json(result);
});

/**
 * GET /deals
 * Returns all deals for the authenticated tenant.
 */
router.get("/", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] as string | undefined;
  if (!tenantId) {
    return res.status(400).json({ error: "Missing x-tenant-id header" });
  }

  const db = getDb();
  const ctx = { db, tenantId };

  const deals = await getDealsByTenant(ctx);
  return res.json({ deals });
});

export default router;
