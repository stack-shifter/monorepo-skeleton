import { schema } from "../db/index";
import { logActivity } from "./activities";
import type { AppContext, CreateDealInput, CreateDealResult } from "./types";

export async function createDeal(
  input: CreateDealInput,
  ctx: AppContext
): Promise<CreateDealResult> {
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

export async function getDealsByTenant(ctx: AppContext) {
  return ctx.db.query.deals.findMany({
    where: (deals, { eq }) => eq(deals.tenantId, ctx.tenantId),
    orderBy: (deals, { desc }) => [desc(deals.createdAt)],
  });
}
