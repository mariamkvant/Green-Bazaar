// Simple HTML sanitizer — strips all tags to prevent XSS
export function sanitize(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

export function sanitizeObj(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const result = { ...obj };
  for (const f of fields) {
    if (typeof result[f] === 'string') result[f] = sanitize(result[f]);
  }
  return result;
}
