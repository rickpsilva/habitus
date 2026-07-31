// Single source of truth for non-essential cookie consent. Strictly-necessary
// cookies (e.g. the login/session cookie) are exempt and are NOT gated here.
export type CookieConsent = 'accepted' | 'rejected';

const STORAGE_KEY = 'cookie-consent';

export const COOKIE_CONSENT_EVENT = 'cookie-consent-changed';

export function getCookieConsent(): CookieConsent | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'accepted' || value === 'rejected') {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCookieConsent(value: CookieConsent): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore storage errors (e.g. private mode); consent simply is not persisted.
  }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }));
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'accepted';
}
