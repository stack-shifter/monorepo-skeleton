import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { createDeal, getDealsByTenant } from "@repo/shared/core";
import { getDb } from "@repo/shared/db";

const router: ExpressRouter = Router();

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

  const tenantId = req.headers["x-tenant-id"] as string | undefined;
  if (!tenantId) {
    return res.status(400).json({ error: "Missing x-tenant-id header" });
  }

  const db = getDb();
  const result = await createDeal(parsed.data, { db, tenantId });

  return res.status(201).json(result);
});

/**
 * GET /deals
 */
router.get("/", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] as string | undefined;
  if (!tenantId) {
    return res.status(400).json({ error: "Missing x-tenant-id header" });
  }

  const db = getDb();
  const deals = await getDealsByTenant({ db, tenantId });
  return res.json({ deals });
});

export default router;
