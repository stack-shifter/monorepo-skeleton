import { schema } from "../db/index";
import type { NewActivity } from "../db/index";
import type { AppContext } from "./types";

export async function logActivity(
  ctx: AppContext,
  activity: Omit<NewActivity, "tenantId">
): Promise<string> {
  const value: NewActivity = { ...activity, tenantId: ctx.tenantId };

  const [inserted] = await ctx.db
    .insert(schema.activities)
    .values(value)
    .returning({ id: schema.activities.id });

  return inserted.id;
}
