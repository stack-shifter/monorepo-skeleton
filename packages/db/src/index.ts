export { getDb, closeDb } from "./client";
export type { Db } from "./client";
export * as schema from "./schema/index";
// Re-export all schema types so consumers don't need to reach into schema/*
export type { Tenant, NewTenant } from "./schema/tenants";
export type { Deal, NewDeal } from "./schema/deals";
export type { Activity, NewActivity } from "./schema/activities";
