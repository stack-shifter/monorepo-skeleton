/**
 * EmailService — stub for transactional email.
 *
 * In production, swap the implementation to call SES, Resend, Postmark, etc.
 */
export interface DealCreatedEmailPayload {
  to: string;
  contactName: string;
  dealTitle: string;
  dealId: string;
}

export interface EmailService {
  sendDealCreatedConfirmation(payload: DealCreatedEmailPayload): Promise<void>;
}

export class StubEmailService implements EmailService {
  async sendDealCreatedConfirmation(payload: DealCreatedEmailPayload): Promise<void> {
    // Stub: log to console instead of sending real email.
    // Replace with SES.sendEmail / Resend.emails.send etc. in production.
    console.log("[EmailService] sendDealCreatedConfirmation (stub)", {
      to: payload.to,
      subject: `Deal created: ${payload.dealTitle}`,
      body: `Hi ${payload.contactName}, your deal "${payload.dealTitle}" (ID: ${payload.dealId}) has been created.`,
    });
  }
}

export const emailService: EmailService = new StubEmailService();
