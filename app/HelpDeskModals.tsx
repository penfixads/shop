'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import jsQR from 'jsqr'
import { formatPeso } from '@/lib/pricing'
import type { DraftItem } from './CreateSpecsModal'
import { registerClient, getClientRewards, lookupClientForCheckout, submitJobOrder } from './actions'
import ClientQrCode from '@/components/ClientQrCode'

async function decodeQrFromFile(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      resolve(code?.data ?? null)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image.')) }
    img.src = url
  })
}

// The shop has no login/session system yet (no password field in the
// registration form) — a successful save just remembers this browser as
// belonging to that client_id, so a later Job Order submission can attach
// to the right client without asking again.
const STORED_CLIENT_KEY = 'penfix_shop_client'

export function getStoredClient(): { clientId: string; clientName: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORED_CLIENT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Shared chrome for all Help Desk / Job Order popups: a panel that swipes in
// from the right edge, maroon header banner, a circular avatar straddling
// the header/body seam, white body. `anchor="bottom"` docks just above the
// floating "?" button (Registration/Assist/Rewards); `anchor="top"` docks
// just below the header's JO badge (the Job Order cart).
function HelpDeskModal({ title, avatar, onClose, children, anchor = 'bottom' }: {
  title: string
  avatar: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  anchor?: 'top' | 'bottom'
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }} onClick={onClose}>
      <div
        className="pf-helpdesk-panel"
        style={{
          position: 'fixed',
          right: '1.5rem',
          width: 'min(420px, calc(100vw - 3rem))',
          background: '#fff',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          // Only the anchor edge is pinned — the other edge is left free so the
          // panel sizes to its content instead of stretching to fill the gap
          // (that stretch was the cause of the empty space at the bottom).
          ...(anchor === 'bottom'
            ? { bottom: '5rem', maxHeight: 'calc(95vh - 5rem)' }
            : { top: '6.5rem', maxHeight: 'calc(95vh - 6.5rem)' }),
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ background: '#7A1828', padding: '1.5rem 1.5rem 3rem', position: 'relative', flexShrink: 0 }}>
          <h2 style={{ color: '#fff', textAlign: 'center', fontSize: '1.5rem', fontWeight: 700 }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: '#fff', fontSize: '1.1rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Avatar sits in its own non-scrolling wrapper so the negative
            margin pulling it up into the header isn't clipped by the
            scrollable body's overflow (that was cutting off its top half). */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 84, height: 84, borderRadius: '50%', background: '#fff', border: '4px solid #fff',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)', margin: '-42px auto 0', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2,
          }}>
            {avatar}
          </div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// penfix-logo-ico.png now has its own breathing space baked in (icon-only crop with margin),
// so no extra CSS padding is needed here to keep it clear of the circular clip.
const PenfixLogoAvatar = (
  <div style={{ width: '100%', height: '100%', position: 'relative', background: '#fff' }}>
    <Image src="/penfix-logo-ico.png" alt="Penfix" fill sizes="84px" style={{ objectFit: 'contain' }} />
  </div>
)

interface FieldSpec {
  icon: string
  placeholder: string
}

const REGISTRATION_FIELDS: FieldSpec[] = [
  { icon: '📱', placeholder: 'Mobile No. (PH) — 09xxxxxxxxx' },
  { icon: '👤', placeholder: 'Customer Name — Full Name' },
  { icon: '✉️', placeholder: 'Email (optional)' },
  { icon: '💬', placeholder: 'Messenger (optional)' },
  { icon: '📞', placeholder: 'Viber (optional)' },
  { icon: '📲', placeholder: 'WhatsApp (optional)' },
]

// Field order is fixed and mapped by index below (0=mobile, 1=name,
// 2=email, 3=messenger, 4=viber, 5=whatsapp) — keep REGISTRATION_FIELDS and
// the registerClient() call in sync if this ever changes.
export function RegistrationModal({ onClose }: { onClose: () => void }) {
  const stored = getStoredClient()
  const [values, setValues] = useState<Record<number, string>>({ 1: stored?.clientName ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<{ clientId: string; clientName: string; returning: boolean } | null>(null)

  async function handleSave() {
    setError('')
    setSaving(true)
    const result = await registerClient({
      contactNumber: values[0] ?? '',
      clientName: values[1] ?? '',
      email: values[2] ?? '',
      messenger: values[3] ?? '',
      viber: values[4] ?? '',
      whatsapp: values[5] ?? '',
    })
    setSaving(false)
    if (!result.success) { setError(result.message); return }
    localStorage.setItem(STORED_CLIENT_KEY, JSON.stringify({ clientId: result.clientId, clientName: result.clientName }))
    setSaved({ clientId: result.clientId, clientName: result.clientName, returning: result.returning })
  }

  if (saved) {
    return (
      <HelpDeskModal title="Client Registration" avatar={PenfixLogoAvatar} onClose={onClose}>
        <p style={{ color: '#1a5a1a', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>
          {saved.returning ? `Welcome back, ${saved.clientName}! 👋` : `You're registered, ${saved.clientName}! 🎉`}
        </p>
        <p style={{ color: '#666', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
          {saved.returning
            ? 'We found your existing account by mobile number — you\'re all set.'
            : 'Your details are saved. You can now proceed to request a quote or place an order.'}
        </p>
        <ClientQrCode clientId={saved.clientId} clientName={saved.clientName} />
        <p style={{ textAlign: 'center', color: '#999', fontSize: '0.72rem' }}>
          Show this to staff to check or redeem points
        </p>
      </HelpDeskModal>
    )
  }

  return (
    <HelpDeskModal title="Client Registration" avatar={PenfixLogoAvatar} onClose={onClose}>
      <p style={{ color: '#666', fontSize: '0.82rem', textAlign: 'center', marginBottom: '1.25rem' }}>
        Tell us how to reach you and we'll have your details ready the next time you order.
      </p>
      {REGISTRATION_FIELDS.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', borderBottom: '1px solid #eee1d6', padding: '0.7rem 0' }}>
          <span style={{ fontSize: '1rem' }}>{f.icon}</span>
          <input
            value={values[i] ?? ''}
            onChange={e => setValues(prev => ({ ...prev, [i]: e.target.value }))}
            placeholder={f.placeholder}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.85rem', color: '#2a2426' }}
          />
        </div>
      ))}
      {error && <p style={{ color: '#c0392b', fontSize: '0.8rem', marginTop: '0.75rem' }}>{error}</p>}
      <button
        onClick={handleSave}
        disabled={saving}
        className="pf-btn"
        style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem' }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </HelpDeskModal>
  )
}

const PhoenixAvatar = (
  <div style={{ width: '100%', height: '100%', position: 'relative', background: '#5C001F' }}>
    <Image src="/phoenix.png" alt="Phoenix" fill style={{ objectFit: 'cover', objectPosition: 'center 15%' }} />
  </div>
)

const SAMPLE_MESSAGE = 'Tarpaulin, 3ft x 5ft, qty 2, matte finish, for pickup, needed by Friday.'

export function PhoenixAssistModal({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{ from: 'phoenix' | 'you'; text: React.ReactNode }[]>([
    { from: 'phoenix', text: <>Hello po! 😊 I can help you with a quote for <b>General Inquiry</b> in <b>Help Desk</b>. Kindly share the specs (size, qty, material/finish, install/delivery, target date).</> },
  ])
  const [draft, setDraft] = useState('')

  function send() {
    if (!draft.trim()) return
    setMessages(prev => [...prev, { from: 'you', text: draft }])
    setDraft('')
  }

  return (
    <HelpDeskModal title="Phoenix (Assist)" avatar={PhoenixAvatar} onClose={onClose}>
      <div style={{ border: '1px solid #eee1d6', borderRadius: 10, padding: '0.85rem', minHeight: 180, maxHeight: 260, overflowY: 'auto', marginBottom: '0.75rem' }}>
        <p style={{ color: '#999', fontSize: '0.78rem', marginBottom: '0.6rem' }}>Phoenix joined the chat</p>
        {messages.map((m, i) => (
          <p key={i} style={{ fontSize: '0.85rem', color: '#2a2426', marginBottom: '0.5rem', lineHeight: 1.5 }}>
            <b>{m.from === 'phoenix' ? 'Phoenix' : 'You'}:</b> {m.text}
          </p>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #eee1d6', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.9rem' }}>💬</span>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type your message…"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.85rem', color: '#2a2426' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={send} className="pf-link-btn" style={{ fontSize: '0.85rem' }}>Send</button>
        <button onClick={() => setDraft(SAMPLE_MESSAGE)} className="pf-link-btn" style={{ fontSize: '0.85rem' }}>Paste sample</button>
      </div>
    </HelpDeskModal>
  )
}

const BlankAvatar = <div style={{ width: '100%', height: '100%', background: '#F9EBD8' }} />

// 1 point = ₱1 earned (rewards_ledger credits 1% of each paid JO's grand_total).
// Thresholds picked from the real client base's earned-points distribution:
// ~35% of clients land at 1 star, ~8% at 2, tapering to the top ~2% at 5 stars —
// easy to reach the first star, genuinely rare to hit five.
function rewardsTier(points: number): number {
  if (points <= 0) return 0
  if (points < 10) return 1
  if (points < 25) return 2
  if (points < 50) return 3
  if (points < 100) return 4
  return 5
}

const HOW_TO_EARN = (
  <>
    <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2a2426', marginBottom: '0.5rem' }}>How to earn</p>
    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#555', fontSize: '0.85rem', lineHeight: 1.8 }}>
      <li>+1 point per ₱100 spend</li>
      <li>+50 points for first-time registration</li>
      <li>+20 points when you refer a friend</li>
    </ul>
  </>
)

export function RewardsModal({ onClose }: { onClose: () => void }) {
  const stored = getStoredClient()
  // Lets a client who registered on a different device (so this browser has nothing in
  // localStorage) still check their points here, by uploading the same QR they'd show staff —
  // same decode-then-lookup pattern as the checkout flow's "Scan Your QR" step. Deliberately
  // kept as in-memory state only (not saved to localStorage) since the QR being viewed may not
  // belong to whoever's sitting at this browser.
  const [uploadedClient, setUploadedClient] = useState<{ clientId: string; clientName: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  // Lets "← Back" return to the register/upload prompt even for an already-stored
  // client, since getStoredClient() would otherwise re-select them every render.
  const [dismissed, setDismissed] = useState(false)

  const activeClient = dismissed ? null : stored || uploadedClient

  function goBack() {
    setUploadedClient(null)
    setDismissed(true)
  }

  const [loading, setLoading] = useState(!!activeClient)
  const [points, setPoints] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeClient) return
    setLoading(true)
    getClientRewards(activeClient.clientId).then(result => {
      if (result.success) setPoints(result.points)
      else setError(result.message)
      setLoading(false)
    })
  }, [activeClient?.clientId])

  async function handleQrUpload(file: File | undefined) {
    if (!file) return
    setUploading(true); setUploadError('')
    try {
      const decoded = await decodeQrFromFile(file)
      if (!decoded) { setUploadError("Couldn't read a QR code in that image — try a clearer photo or screenshot."); return }
      const result = await lookupClientForCheckout(decoded)
      if (!result.success) { setUploadError(result.message); return }
      setUploadedClient({ clientId: result.clientId, clientName: result.clientName })
    } catch {
      setUploadError('Something went wrong reading that image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (!activeClient) {
    return (
      <HelpDeskModal title="Rewards" avatar={BlankAvatar} onClose={onClose}>
        <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          Register first to get your rewards QR and start earning points.
        </p>
        <p style={{ color: '#999', fontSize: '0.78rem', textAlign: 'center', marginBottom: '0.75rem' }}>
          Already registered on another device? Upload your QR here to view your points.
        </p>
        <label className="pf-btn" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer' }}>
          {uploading ? 'Reading…' : 'Upload Your QR'}
          <input type="file" accept="image/*" onChange={e => handleQrUpload(e.target.files?.[0])} disabled={uploading} style={{ display: 'none' }} />
        </label>
        {uploadError && <p style={{ color: '#c0392b', fontSize: '0.78rem', textAlign: 'center', marginTop: '1rem' }}>{uploadError}</p>}
        <div style={{ marginTop: '1.25rem' }}>{HOW_TO_EARN}</div>
      </HelpDeskModal>
    )
  }

  return (
    <HelpDeskModal title="Rewards" avatar={BlankAvatar} onClose={onClose}>
      <ClientQrCode
        clientId={activeClient.clientId}
        clientName={activeClient.clientName}
        onBack={goBack}
      />
      <p style={{ textAlign: 'center', color: '#999', fontSize: '0.72rem', marginBottom: '1rem' }}>
        Show this to staff to check or redeem points
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', marginBottom: '1rem', paddingBottom: '0.85rem', borderBottom: '1px solid #eee1d6' }}>
        <div style={{ fontSize: '1.3rem', letterSpacing: '0.15rem' }}>
          {loading || error ? '★★★★★'.split('').map((s, i) => <span key={i} style={{ color: '#e5dcd0' }}>{s}</span>) : (
            [1, 2, 3, 4, 5].map(i => (
              <span key={i} style={{ color: i <= rewardsTier(points ?? 0) ? '#C9A84C' : '#e5dcd0' }}>★</span>
            ))
          )}
        </div>
        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#2a2426' }}>
          {loading ? 'Loading…' : error ? '—' : `${points} pts`}
        </span>
      </div>
      {error && <p style={{ color: '#c0392b', fontSize: '0.78rem', textAlign: 'center', marginBottom: '1rem' }}>{error}</p>}
      {HOW_TO_EARN}
    </HelpDeskModal>
  )
}

type CheckoutStep = 'cart' | 'register' | 'confirm' | 'done'

export function JobOrderModal({ cart, onClose, onOrderPlaced }: { cart: DraftItem[]; onClose: () => void; onOrderPlaced: () => void }) {
  const grandTotal = cart.reduce((sum, item) => sum + item.line_total, 0)
  const [step, setStep] = useState<CheckoutStep>('cart')
  const [client, setClient] = useState<{ clientId: string; clientName: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [jobOrderId, setJobOrderId] = useState('')
  const [registerValues, setRegisterValues] = useState<Record<number, string>>({})
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState('')

  function handleCheckout() {
    const stored = getStoredClient()
    if (!stored) { setStep('register'); return }
    setClient(stored)
    setStep('confirm')
  }

  async function handleRegisterAndCheckout() {
    setRegisterError('')
    setRegistering(true)
    const result = await registerClient({
      contactNumber: registerValues[0] ?? '',
      clientName: registerValues[1] ?? '',
      email: registerValues[2] ?? '',
      messenger: registerValues[3] ?? '',
      viber: registerValues[4] ?? '',
      whatsapp: registerValues[5] ?? '',
    })
    setRegistering(false)
    if (!result.success) { setRegisterError(result.message); return }
    localStorage.setItem(STORED_CLIENT_KEY, JSON.stringify({ clientId: result.clientId, clientName: result.clientName }))
    setClient({ clientId: result.clientId, clientName: result.clientName })
    setStep('confirm')
  }

  async function handlePlaceOrder() {
    if (!client) return
    setSubmitting(true); setSubmitError('')
    const result = await submitJobOrder({ clientId: client.clientId, items: cart })
    if (!result.success) { setSubmitError(result.message); setSubmitting(false); return }
    setJobOrderId(result.jobOrderId)
    onOrderPlaced()
    setStep('done')
    setSubmitting(false)
  }

  if (step === 'done') {
    const trackUrl = `${process.env.NEXT_PUBLIC_JOBS_URL}/track/${jobOrderId}`
    return (
      <HelpDeskModal title="Job Order" avatar={PenfixLogoAvatar} onClose={onClose} anchor="top">
        <p style={{ color: '#1a5a1a', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>Order placed! 🎉</p>
        <p style={{ color: '#666', fontSize: '0.82rem', marginBottom: '1rem' }}>
          Your job order <b>{jobOrderId}</b> has been submitted for <b>{client?.clientName}</b>. Our team will review it and reach out about payment and timeline.
        </p>
        <a href={trackUrl} target="_blank" rel="noreferrer" className="pf-link-btn" style={{ fontSize: '0.85rem' }}>Track this order →</a>
        <button onClick={onClose} className="pf-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem' }}>Done</button>
      </HelpDeskModal>
    )
  }

  if (step === 'register') {
    return (
      <HelpDeskModal title="Client Registration" avatar={PenfixLogoAvatar} onClose={onClose} anchor="top">
        <p style={{ color: '#666', fontSize: '0.82rem', textAlign: 'center', marginBottom: '1.25rem' }}>
          Please register first before placing an order.
        </p>
        {REGISTRATION_FIELDS.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', borderBottom: '1px solid #eee1d6', padding: '0.7rem 0' }}>
            <span style={{ fontSize: '1rem' }}>{f.icon}</span>
            <input
              value={registerValues[i] ?? ''}
              onChange={e => setRegisterValues(prev => ({ ...prev, [i]: e.target.value }))}
              placeholder={f.placeholder}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.85rem', color: '#2a2426' }}
            />
          </div>
        ))}
        {registerError && <p style={{ color: '#c0392b', fontSize: '0.8rem', marginTop: '0.75rem' }}>{registerError}</p>}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button onClick={() => setStep('cart')} className="pf-link-btn" style={{ fontSize: '0.85rem' }} disabled={registering}>← Back to cart</button>
          <button onClick={handleRegisterAndCheckout} disabled={registering} className="pf-btn" style={{ flex: 1, justifyContent: 'center' }}>
            {registering ? 'Saving…' : 'Register & Continue'}
          </button>
        </div>
      </HelpDeskModal>
    )
  }

  if (step === 'confirm' && client) {
    return (
      <HelpDeskModal title="Confirm Order" avatar={PenfixLogoAvatar} onClose={onClose} anchor="top">
        <p style={{ color: '#666', fontSize: '0.82rem', marginBottom: '1rem' }}>Checking out as:</p>
        <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2a2426', marginBottom: '1.25rem' }}>{client.clientName}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.85rem', marginBottom: '1rem', borderBottom: '1px solid #eee1d6' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2a2426' }}>Total</span>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#7A1828' }}>{formatPeso(grandTotal)}</span>
        </div>
        {submitError && <p style={{ color: '#c0392b', fontSize: '0.8rem', marginBottom: '1rem' }}>{submitError}</p>}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => { setStep('cart'); setClient(null) }} className="pf-link-btn" style={{ fontSize: '0.85rem' }} disabled={submitting}>Not you?</button>
          <button onClick={handlePlaceOrder} disabled={submitting} className="pf-btn" style={{ flex: 1, justifyContent: 'center' }}>
            {submitting ? 'Placing Order…' : 'Confirm & Place Order'}
          </button>
        </div>
      </HelpDeskModal>
    )
  }

  return (
    <HelpDeskModal title="Job Order" avatar={PenfixLogoAvatar} onClose={onClose} anchor="top">
      {cart.length === 0 ? (
        <p style={{ color: '#999', fontSize: '0.85rem' }}>No items yet.</p>
      ) : (
        <>
          {cart.map(item => (
            <div key={item.key} style={{ borderBottom: '1px solid #eee1d6', padding: '0.75rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#2a2426' }}>{item.subcategory_name}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2a2426', whiteSpace: 'nowrap' }}>{formatPeso(item.line_total)}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#999' }}>{item.category_name} · Qty {item.quantity}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 0', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2a2426' }}>Total</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#7A1828' }}>{formatPeso(grandTotal)}</span>
          </div>
          <button onClick={handleCheckout} className="pf-btn" style={{ width: '100%', justifyContent: 'center' }}>Checkout</button>
        </>
      )}
    </HelpDeskModal>
  )
}
