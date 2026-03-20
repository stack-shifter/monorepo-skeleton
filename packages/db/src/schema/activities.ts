import { pgTable, uuid, varchar, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { deals } from "./deals";

export const activityTypeEnum = pgEnum("activity_type", [
  "deal_created",
  "deal_updated",
  "deal_stage_changed",
  "email_sent",
  "note_added",
  "ai_summary_generated",
]);

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
  type: activityTypeEnum("type").notNull(),
  // Flexible metadata — store whatever the action needs to record
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
