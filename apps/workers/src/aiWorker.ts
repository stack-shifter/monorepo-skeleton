/**
 * AIWorker Lambda
 *
 * Triggered by SQS when a deal_created event is published.
 * Generates an AI summary for the deal and persists it as an activity.
 *
 * Event shape:
 * {
 *   dealId: string;
 *   tenantId: string;
 *   title: string;
 *   contactName: string;
 *   contactEmail: string;
 *   value: string;
 *   stage: string;
 * }
 */
import type { SQSHandler, SQSRecord } from "aws-lambda";
import { logActivity } from "@repo/core";
import { getDb } from "@repo/db";
import { aiService } from "@repo/services";

interface DealEnrichedEvent {
  dealId: string;
  tenantId: string;
  title: string;
  contactName: string;
  contactEmail: string;
  value: string;
  stage: string;
}

async function processRecord(record: SQSRecord): Promise<void> {
  const event: DealEnrichedEvent = JSON.parse(record.body);
  const { dealId, tenantId, title, contactName, contactEmail, value, stage } = event;

  const db = getDb();
  const ctx = { db, tenantId };

  // Generate AI summary — thin wrapper, logic lives in @repo/services
  const summary = await aiService.summarizeDeal({
    title,
    contactName,
    contactEmail,
    value,
    stage,
  });

  // Persist the summary as an activity — reuses the same logActivity from @repo/core
  await logActivity(ctx, {
    dealId,
    type: "ai_summary_generated",
    metadata: { summary },
  });

  console.log(`[aiWorker] Summary generated for deal ${dealId}`);
}

export const handler: SQSHandler = async (event) => {
  const results = await Promise.allSettled(
    event.Records.map((record) => processRecord(record))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error("[aiWorker] Some records failed:", failures);
    throw new Error(`${failures.length} record(s) failed`);
  }
};
