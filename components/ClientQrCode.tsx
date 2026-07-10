'use client'

import { useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import html2canvas from 'html2canvas'

interface Props {
  clientId: string
  clientName: string
}

// Reusable QR block: shown wherever a customer needs to see/save their
// rewards QR — right after registering and again under the Rewards tab.
// Encodes a deep link into penfixads-OS's New JO form (not the raw client_id) so staff
// scanning it lands on a pre-filled transaction instead of a dead ID string.
export default function ClientQrCode({ clientId, clientName }: Props) {
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
      <div ref={qrRef} style={{
        width: 140, height: 140, margin: '0 auto 1rem', padding: 12, border: '1px solid #eee1d6', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff',
      }}>
        <QRCode value={joLink} size={116} style={{ width: '100%', height: '100%' }} />
      </div>
      <button
        onClick={download}
        disabled={saving}
        className="pf-btn"
        style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
      >
        {saving ? 'Saving…' : 'Download QR'}
      </button>
    </div>
  )
}
