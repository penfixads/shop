// A client's QR encodes a deep link into penfixads-OS
// (`${origin}/jos/today?client=<id>`) — extract the client_id from that, but
// fall back to treating the decoded value as a bare client_id in case an
// older-format QR (pre-deep-link) ever gets scanned.
export function extractClientIdFromQr(raw: string): string | null {
  try {
    const url = new URL(raw)
    const id = url.searchParams.get('client')
    if (id) return id
  } catch {
    // Not a URL — fall through to treating it as a bare client_id.
  }
  const trimmed = raw.trim()
  return trimmed || null
}
