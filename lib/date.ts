// Ported verbatim from penfixads-OS/lib/jo-helpers.ts's getPhilippineDateStr —
// used to name the jo-print-files storage folder for the day a JO was
// received, so it groups the same way staff already expect "today's JOs" to.
export function getPhilippineDateStr(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
