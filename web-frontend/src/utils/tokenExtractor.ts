/**
 * Reusable utility to extract and normalize a Token ID from raw scanner payloads.
 * 
 * Supported inputs:
 * 1. Raw Token ID: "BAR-20260914-00001" or "BAR-20260728-1"
 * 2. Full Customer Access URL: "http://localhost:5173/customer/access/BAR-20260914-00001"
 * 3. Short Access Route: "http://localhost:5173/t/BAR-20260914-00001"
 * 4. Query Parameter URL: "http://localhost:5173/customer/access?token=BAR-20260914-00001" or "?id=BAR-20260914-00001"
 * 5. Relative Route Path: "/customer/access/BAR-20260914-00001" or "/t/BAR-20260914-00001"
 * 
 * Returns the uppercase Token ID (e.g. "BAR-20260914-00001") or null if invalid.
 */
export function extractTokenNumber(rawInput: string | null | undefined): string | null {
  if (!rawInput) return null;
  const input = rawInput.trim();
  if (!input) return null;

  // 1. Direct match for standard Token format (e.g. BAR-20260914-00001 or BAR-20260728-1)
  const directTokenRegex = /^BAR-\d{8}-\d+$/i;
  if (directTokenRegex.test(input)) {
    return input.toUpperCase();
  }

  // 2. If it's a URL or route path containing /customer/access/:token or /t/:token
  try {
    if (input.includes('://') || input.startsWith('/') || input.includes('/customer/access') || input.includes('/t/')) {
      // Use URL parser with a dummy origin for relative URLs
      const url = input.includes('://') ? new URL(input) : new URL(input, 'http://localhost');

      // Check query parameter '?token=...' or '?id=...'
      const qToken = url.searchParams.get('token') || url.searchParams.get('id') || url.searchParams.get('tokenNumber');
      if (qToken && directTokenRegex.test(qToken.trim())) {
        return qToken.trim().toUpperCase();
      }

      // Check pathname segments
      const segments = url.pathname.split('/').filter(Boolean);
      const accessIdx = segments.findIndex(s => s.toLowerCase() === 'access' || s.toLowerCase() === 't');
      if (accessIdx !== -1 && segments[accessIdx + 1]) {
        const potentialToken = decodeURIComponent(segments[accessIdx + 1]).trim();
        if (directTokenRegex.test(potentialToken)) {
          return potentialToken.toUpperCase();
        }
      }

      // Check last path segment
      if (segments.length > 0) {
        const lastSegment = decodeURIComponent(segments[segments.length - 1]).trim();
        if (directTokenRegex.test(lastSegment)) {
          return lastSegment.toUpperCase();
        }
      }
    }
  } catch {}

  // 3. Regex extraction fallback if embedded in custom text or URL string
  const embeddedMatch = input.match(/BAR-\d{8}-\d+/i);
  if (embeddedMatch && embeddedMatch[0]) {
    return embeddedMatch[0].toUpperCase();
  }

  return null;
}
