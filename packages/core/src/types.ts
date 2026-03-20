import type { Db } from "@repo/db";

/**
 * Dependency injection context passed into every core function.
 * This keeps core logic testable and decoupled from global singletons.
 */
export interface AppContext {
  db: Db;
  tenantId: string;
}

export interface CreateDealInput {
  title: string;
  contactName: string;
  contactEmail: string;
  /** Dollar value of the deal */
  value: string;
  stage?: "lead" | "qualified" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
}

export interface CreateDealResult {
  dealId: string;
  activityId: string;
}
