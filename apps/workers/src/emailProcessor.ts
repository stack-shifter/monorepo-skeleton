/**
 * EmailProcessor Lambda
 *
 * Triggered by SQS when a deal_created event is published.
 * Sends a confirmation email to the contact.
 *
 * Event shape (from SQS → EventBridge → SQS):
 * {
 *   dealId: string;
 *   tenantId: string;
 *   contactEmail: string;
 *   contactName: string;
 *   dealTitle: string;
 * }
 */
import type { SQSHandler, SQSRecord } from "aws-lambda";
import { logActivity } from "@repo/core";
import { getDb } from "@repo/db";
import { emailService } from "@repo/services";

interface DealCreatedEvent {
  dealId: string;
  tenantId: string;
  contactEmail: string;
  contactName: string;
  dealTitle: string;
}

async function processRecord(record: SQSRecord): Promise<void> {
  const event: DealCreatedEvent = JSON.parse(record.body);
  const { dealId, tenantId, contactEmail, contactName, dealTitle } = event;

  const db = getDb();
  const ctx = { db, tenantId };

  // Thin handler — delegate to the shared service
  await emailService.sendDealCreatedConfirmation({
    to: contactEmail,
    contactName,
    dealTitle,
    dealId,
  });

  // Record that the email was sent — same logActivity used by the API
  await logActivity(ctx, {
    dealId,
    type: "email_sent",
    metadata: { to: contactEmail, template: "deal_created" },
  });

  console.log(`[emailProcessor] Confirmation sent to ${contactEmail} for deal ${dealId}`);
}

export const handler: SQSHandler = async (event) => {
  // Process each SQS record independently so one failure doesn't block others
  const results = await Promise.allSettled(
    event.Records.map((record) => processRecord(record))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error("[emailProcessor] Some records failed:", failures);
    // Re-throw so Lambda marks these messages for DLQ
    throw new Error(`${failures.length} record(s) failed`);
  }
};
