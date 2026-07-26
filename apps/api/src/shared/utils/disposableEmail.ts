import disposableDomains from 'disposable-email-domains';

const domainSet = new Set(disposableDomains as string[]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return domainSet.has(domain);
}
