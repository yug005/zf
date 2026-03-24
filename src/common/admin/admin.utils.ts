function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getAdminEmails(adminEmailsRaw?: string): string[] {
  if (!adminEmailsRaw) {
    return [];
  }

  return [...new Set(adminEmailsRaw.split(',').map(normalizeEmail).filter(Boolean))];
}

export function isAdminEmail(email: string, adminEmailsRaw?: string): boolean {
  if (!email) {
    return false;
  }

  return getAdminEmails(adminEmailsRaw).includes(normalizeEmail(email));
}
