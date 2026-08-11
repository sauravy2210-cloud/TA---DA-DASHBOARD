// Sends HR action email notifications via the /api/notify serverless function.
// Fails silently — a network/config error must never block the HR action itself.

export interface ActionEmailPayload {
  toEmail: string;
  toName: string;
  actionKey: string;
  claimId: string;
  billNo: string;
  remarks?: string;
  hrName: string;
  approvedAmount?: number;
  currency?: string;
}

export async function sendActionEmail(payload: ActionEmailPayload): Promise<void> {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silent — email is a notification, not a blocking operation
  }
}
