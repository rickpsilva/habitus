/**
 * Email masking utility for RGPD compliance.
 * Masks the local part of email addresses (before @) while keeping domain partially visible.
 * Example: "user@example.com" -> "*****@exa**.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  
  // Mask local part: keep first char if longer than 1, rest as asterisks
  const maskedLocal = localPart.length > 1
    ? localPart[0] + '*'.repeat(localPart.length - 1)
    : '*'.repeat(localPart.length);

  // Mask domain: keep first 2-3 chars and TLD
  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    return `${maskedLocal}@${'*'.repeat(domain.length)}`;
  }

  const tld = domainParts.pop() || '';
  const domainName = domainParts.join('.');
  
  const maskedDomain = domainName.length > 2
    ? domainName.substring(0, 2) + '*'.repeat(Math.max(0, domainName.length - 2))
    : '*'.repeat(domainName.length);

  return `${maskedLocal}@${maskedDomain}.${tld}`;
}

/**
 * Email masking utility - alternative format
 * Shows first letter of local part and masks the rest
 * Example: "user@example.com" -> "u****@example.com"
 */
export function maskEmailPreserveDomain(email: string): string {
  if (!email || !email.includes('@')) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  
  const maskedLocal = localPart.length > 1
    ? localPart[0] + '*'.repeat(localPart.length - 1)
    : '*'.repeat(localPart.length);

  return `${maskedLocal}@${domain}`;
}