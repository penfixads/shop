// Ported verbatim from penfixads-OS/lib/jo-helpers.ts so shop-registered
// clients use the exact same ID format as the internal JO system.
export function generateClientId(): string {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(2)
  const rand = String(Math.floor(Math.random() * 9000000) + 1000000)
  return `C${mm}${dd}${yy}-${rand}`
}

// Ported verbatim from penfixads-OS/lib/jo-helpers.ts — shop-submitted job orders
// write into the exact same job_orders table, so IDs must follow the identical
// format and sequencing or they'll collide with (or look inconsistent next to)
// orders created inside penfixads-OS itself.
export function generateJobOrderId(seq: number, date: Date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `JO-${mm}${dd}${yyyy}-${String(seq).padStart(3, '0')}`
}

export function generateItemId(jobOrderId: string, seq: number): string {
  return `${jobOrderId}-ITEM-${seq}`
}

export function getNextJOSequence(existingIds: string[], dateStr: string): number {
  const prefix = `JO-${dateStr}-`
  const seqs = existingIds
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.replace(prefix, '')) || 0)
  return seqs.length > 0 ? Math.max(...seqs) + 1 : 1
}
