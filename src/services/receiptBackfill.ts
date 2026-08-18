/**
 * receiptBackfill — runs silently in the background when a trainer is logged in.
 * Scans localStorage for line items that have base64 receiptData (not yet uploaded
 * to Vercel Blob), uploads each one, then updates both localStorage and Turso so
 * HR Admin can view the receipt from any device.
 */

import { saveLineItems } from './storageService';
import type { ClaimLineItem } from '../types';

const BACKFILL_DONE_KEY = 'tada_receipt_backfill_done';

async function uploadToBlob(base64: string, filename: string): Promise<string | null> {
  try {
    const contentType = base64.match(/^data:([^;]+);/)?.[1] ?? 'application/octet-stream';
    const res = await fetch('/api/turso?type=upload-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, filename, contentType }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}

export async function backfillReceiptsToBlob(): Promise<void> {
  // Only run once per session to avoid re-uploading on every navigation
  const doneThisSession = sessionStorage.getItem(BACKFILL_DONE_KEY);
  if (doneThisSession) return;
  sessionStorage.setItem(BACKFILL_DONE_KEY, '1');

  // Fetch full line items (with receiptData) directly — no longer reads the shared
  // app-wide cache, which is now a lite/no-receiptData variant for bandwidth reasons.
  let allItems: ClaimLineItem[] = [];
  try {
    const r = await fetch('/api/turso?type=lineitems-all');
    if (r.ok) {
      const d = await r.json() as { lineItems?: ClaimLineItem[] };
      allItems = Array.isArray(d.lineItems) ? d.lineItems : [];
    }
  } catch {
    return; // can't reach Turso — nothing to backfill this session
  }
  const toBackfill = allItems.filter(li => {
    const rd = li.receiptData;
    // Has base64 data (not already a blob URL)
    return rd && rd.startsWith('data:') && !rd.startsWith('http');
  });

  if (toBackfill.length === 0) return;

  const updated: ClaimLineItem[] = [];

  for (const li of toBackfill) {
    const url = await uploadToBlob(li.receiptData!, li.receiptFileName || `receipt_${li.lineItemId}`);
    if (url) {
      updated.push({ ...li, receiptData: url, receiptUrl: url } as ClaimLineItem);
    }
    // Small delay to avoid hammering the API
    await new Promise(r => setTimeout(r, 200));
  }

  if (updated.length === 0) return;

  // Save updated items back to localStorage + Turso
  saveLineItems(updated);

  // Also push each updated item to Turso individually by claim group
  const byClaimId: Record<string, ClaimLineItem[]> = {};
  updated.forEach(li => {
    if (!byClaimId[li.claimId]) byClaimId[li.claimId] = [];
    byClaimId[li.claimId].push(li);
  });

  for (const [claimId, items] of Object.entries(byClaimId)) {
    // Merge with existing Turso line items for this claim
    try {
      const existing = await fetch(`/api/turso?type=lineitems&claimId=${encodeURIComponent(claimId)}`)
        .then(r => r.ok ? r.json() as Promise<{ lineItems: ClaimLineItem[] }> : { lineItems: [] });
      const existingMap = new Map((existing.lineItems ?? []).map((li: ClaimLineItem) => [li.lineItemId, li]));
      items.forEach(li => existingMap.set(li.lineItemId, li));
      const merged = Array.from(existingMap.values());
      await fetch('/api/turso?type=lineitems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems: merged }),
      });
    } catch {
      // Silent — localStorage is already updated
    }
  }
}
