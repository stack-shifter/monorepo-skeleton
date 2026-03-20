import { schema } from "@repo/db";
import type { NewActivity } from "@repo/db";
import type { AppContext } from "./types";

/**
 * Logs an activity record. All business events should flow through here
 * so the activity feed stays consistent regardless of caller (API or Lambda).
 */
export async function logActivity(
  ctx: AppContext,
  activity: Omit<NewActivity, "tenantId">
): Promise<string> {
  // Explicitly type the merged value so drizzle sees the full shape
  const value: NewActivity = { ...activity, tenantId: ctx.tenantId };

  const [inserted] = await ctx.db
    .insert(schema.activities)
    .values(value)
    .returning({ id: schema.activities.id });

  return inserted.id;
}
