// Sends HR action email notifications via the /api/notify serverless function.
// Never throws — a network/config error must never block the HR action itself — but
// DOES return whether the send actually succeeded, so callers can surface a warning to
// HR Admin instead of silently believing every action email went out.

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

export async function sendActionEmail(payload: ActionEmailPayload): Promise<boolean> {
  try {
    const r = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch {
    return false;
  }
}
