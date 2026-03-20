import type { SQSHandler, SQSRecord } from "aws-lambda";
import { logActivity } from "@repo/shared/core";
import { getDb } from "@repo/shared/db";
import { emailService } from "@repo/shared/services";

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

  await emailService.sendDealCreatedConfirmation({
    to: contactEmail,
    contactName,
    dealTitle,
    dealId,
  });

  await logActivity(ctx, {
    dealId,
    type: "email_sent",
    metadata: { to: contactEmail, template: "deal_created" },
  });

  console.log(`[emailProcessor] Confirmation sent to ${contactEmail} for deal ${dealId}`);
}

export const handler: SQSHandler = async (event) => {
  const results = await Promise.allSettled(
    event.Records.map((record) => processRecord(record))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error("[emailProcessor] Some records failed:", failures);
    throw new Error(`${failures.length} record(s) failed`);
  }
};
