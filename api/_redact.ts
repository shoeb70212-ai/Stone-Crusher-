/**
 * Redacts email-like substrings from a string, replacing them with ***@***.
 */
export function redactEmail(s: string): string {
  return s.replace(/[\w.-]+@[\w.-]+\.\w+/g, '***@***');
}
