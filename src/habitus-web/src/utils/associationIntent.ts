// FLOW A — Register fallback intent. When an existing email tries to register
// against a condominium, we stash the intended association so that, right after
// the user signs in, we can auto-create the membership association request.
// Persistence is best-effort: a corrupted/absent intent must never break login.

export interface PendingAssociationIntent {
  targetCondominiumId: string;
  requestedRole: number;
  source: number;
}

const STORAGE_KEY = 'pendingAssociationIntent';

export function setPendingAssociationIntent(intent: PendingAssociationIntent): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Ignore storage failures; the register fallback still shows the sign-in CTA.
  }
}

export function getPendingAssociationIntent(): PendingAssociationIntent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingAssociationIntent>;
    if (
      typeof parsed?.targetCondominiumId === 'string' &&
      typeof parsed?.requestedRole === 'number' &&
      typeof parsed?.source === 'number'
    ) {
      return {
        targetCondominiumId: parsed.targetCondominiumId,
        requestedRole: parsed.requestedRole,
        source: parsed.source,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingAssociationIntent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
