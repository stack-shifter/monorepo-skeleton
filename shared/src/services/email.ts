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
    console.log("[EmailService] sendDealCreatedConfirmation (stub)", {
      to: payload.to,
      subject: `Deal created: ${payload.dealTitle}`,
      body: `Hi ${payload.contactName}, your deal "${payload.dealTitle}" (ID: ${payload.dealId}) has been created.`,
    });
  }
}

export const emailService: EmailService = new StubEmailService();
