import { schema } from "@repo/db";
import { logActivity } from "./activities";
import type { AppContext, CreateDealInput, CreateDealResult } from "./types";

/**
 * createDeal — the single authoritative implementation of deal creation.
 *
 * Used by:
 *   - apps/api  → POST /deals route
 *   - apps/workers → emailProcessor, aiWorker (if they need to create deals)
 *
 * Never duplicate this logic in routes or Lambda handlers.
 */
export async function createDeal(
  input: CreateDealInput,
  ctx: AppContext
): Promise<CreateDealResult> {
  // 1. Insert the deal
  const [deal] = await ctx.db
    .insert(schema.deals)
    .values({
      tenantId: ctx.tenantId,
      title: input.title,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      value: input.value,
      stage: input.stage ?? "lead",
    })
    .returning({ id: schema.deals.id });

  // 2. Log the creation activity — always, atomically in the same request
  const activityId = await logActivity(ctx, {
    dealId: deal.id,
    type: "deal_created",
    metadata: {
      title: input.title,
      contactEmail: input.contactEmail,
      value: input.value,
    },
  });

  return { dealId: deal.id, activityId };
}

/**
 * getDealsByTenant — fetch all deals for a tenant, newest first.
 */
export async function getDealsByTenant(ctx: AppContext) {
  return ctx.db.query.deals.findMany({
    where: (deals, { eq }) => eq(deals.tenantId, ctx.tenantId),
    orderBy: (deals, { desc }) => [desc(deals.createdAt)],
  });
}
