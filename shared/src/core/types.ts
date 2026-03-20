import type { Db } from "../db/index";

export interface AppContext {
  db: Db;
  tenantId: string;
}

export interface CreateDealInput {
  title: string;
  contactName: string;
  contactEmail: string;
  value: string;
  stage?: "lead" | "qualified" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
}

export interface CreateDealResult {
  dealId: string;
  activityId: string;
}
