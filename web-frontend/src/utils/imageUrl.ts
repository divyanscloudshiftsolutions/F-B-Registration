/**
 * Normalizes image URLs for external HTTPS URLs and local/deployed static uploads
 */
export function formatImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || !url.trim()) return '';

  const trimmed = url.trim();

  // Fully qualified external or S3/MinIO URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Local or deployed backend relative uploads
  if (trimmed.startsWith('/uploads/')) {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocalOrNetworkHost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        Boolean(hostname.match(/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/));

      if (isLocalOrNetworkHost) {
        return `http://${hostname}:4000${trimmed}`;
      }
    }
    return `https://api.nfc-qr.app.cloudshiftsolutions.in${trimmed}`;
  }

  return trimmed;
}
