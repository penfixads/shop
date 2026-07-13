'use client'

import { useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import html2canvas from 'html2canvas'

interface Props {
  clientId: string
  clientName: string
  // Set when this QR came from a file the client just uploaded (Rewards' "check
  // points from another device" flow) — they already have that file, so offering
  // "Download QR" again is redundant. Renders a back link instead.
  onBack?: () => void
}

// Reusable QR block: shown wherever a customer needs to see/save their
// rewards QR — right after registering and again under the Rewards tab.
// Encodes a deep link into penfixads-OS's New JO form (not the raw client_id) so staff
// scanning it lands on a pre-filled transaction instead of a dead ID string.
export default function ClientQrCode({ clientId, clientName, onBack }: Props) {
  const [saving, setSaving] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)
  const joLink = `${process.env.NEXT_PUBLIC_JOBS_URL}/jos/today?client=${encodeURIComponent(clientId)}`

  async function download() {
    if (!qrRef.current) return
    setSaving(true)
    try {
      const canvas = await html2canvas(qrRef.current, { backgroundColor: '#ffffff', scale: 2 })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `${clientId}-qr.png`
      a.click()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.95rem', color: '#2a2426', marginBottom: '0.75rem' }}>
        {clientName}
      </p>
      <div ref={qrRef} style={{
        width: 140, height: 140, margin: '0 auto 1rem', padding: 12, border: '1px solid #eee1d6', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff',
      }}>
        <QRCode value={joLink} size={116} style={{ width: '100%', height: '100%' }} />
      </div>
      {onBack ? (
        <button
          onClick={onBack}
          className="pf-btn pf-btn-secondary"
          style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
        >
          ← Back to Rewards
        </button>
      ) : (
        <button
          onClick={download}
          disabled={saving}
          className="pf-btn"
          style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
        >
          {saving ? 'Saving…' : 'Download QR'}
        </button>
      )}
    </div>
  )
}
