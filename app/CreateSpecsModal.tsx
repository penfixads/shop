'use client'

import { useState, useMemo } from 'react'
import { computeLineTotal, formatPeso, PRICING_LABELS } from '@/lib/pricing'
import { compressImageToDataUrl } from '@/lib/image'
import { uploadOriginalFile } from './actions'

// Flat add-on for clients who want staff to design the layout instead of
// supplying their own ready file. Not part of the internal JO system yet
// (no client-facing self-service existed there) — placeholder amount,
// adjust here if the real rate differs.
const LAYOUT_FEE = 150

export interface DraftItem {
  key: string
  subcategory_id: string
  subcategory_name: string
  category_name: string
  pricing_model: string
  base_price: number
  quantity: number
  width: number | null
  height: number | null
  depth: number | null
  no_of_mins: number | null
  letter_count: number | null
  production_specs: string
  notes: string
  date_time_needed: string | null
  item_preview: string
  // Storage path of the client's actual attached file (full resolution) — already
  // uploaded to a temporary "pending/" location by the time this item is added to
  // the cart (see uploadOriginalFile in actions.ts); submitJobOrder moves it into
  // its final dated folder. A plain string, not the File itself — Server Actions
  // can't accept a raw File nested inside a larger object/array argument.
  original_file_path: string | null
  needs_layout_help: boolean
  layout_fee: number
  line_total: number
}

interface Subcategory {
  subcategory_id: string
  subcategory_name: string
  category_id: string
  category_name: string
  pricing_model: string
  base_price: number
}

interface Props {
  subcategory: Subcategory
  initialQty: number
  onClose: () => void
  onAdd: (item: DraftItem) => void
}

export default function CreateSpecsModal({ subcategory, initialQty, onClose, onAdd }: Props) {
  const [quantity, setQuantity] = useState(String(initialQty))
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [depth, setDepth] = useState('')
  const [noOfMins, setNoOfMins] = useState('')
  const [letterCount, setLetterCount] = useState('')
  const [productionSpecs, setProductionSpecs] = useState('')
  const [remarks, setRemarks] = useState('')
  const [dateNeeded, setDateNeeded] = useState('')
  const [needsLayoutHelp, setNeedsLayoutHelp] = useState(false)
  const [preview, setPreview] = useState('')
  const [previewBytes, setPreviewBytes] = useState<number | null>(null)
  const [originalFileName, setOriginalFileName] = useState('')
  const [originalFilePath, setOriginalFilePath] = useState<string | null>(null)
  const [uploadingOriginal, setUploadingOriginal] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [formError, setFormError] = useState('')

  const pricingModel = subcategory.pricing_model
  const basePrice = subcategory.base_price

  const needsDims = ['area', 'dimension', 'area_cube', 'per_lettersqft'].includes(pricingModel)
  const needsDepth = pricingModel === 'area_cube'
  const needsMins = pricingModel === 'per_minute'
  const needsLetters = pricingModel === 'per_lettersqft'

  const itemTotal = useMemo(() => computeLineTotal(
    pricingModel,
    basePrice,
    parseFloat(width) || undefined,
    parseFloat(height) || undefined,
    parseFloat(depth) || undefined,
    parseInt(quantity) || 1,
    parseFloat(noOfMins) || undefined,
    parseFloat(letterCount) || undefined,
    0,
  ), [pricingModel, basePrice, width, height, depth, quantity, noOfMins, letterCount])

  const layoutFee = needsLayoutHelp ? LAYOUT_FEE : 0
  const lineTotal = itemTotal + layoutFee

  async function handlePreviewFile(file: File | null) {
    if (!file) return
    setPreviewError('')
    setOriginalFileName(file.name)
    setOriginalFilePath(null)
    setCompressing(true)
    setUploadingOriginal(true)

    // Two independent things happen with the same file: a small compressed
    // thumbnail for on-screen preview (can fail, e.g. browsers can't decode
    // TIFF, without blocking anything), and the real full-resolution file
    // uploaded to storage for actual printing (a separate Server Action taking
    // FormData, since a raw File can't be nested inside the cart item passed to
    // submitJobOrder later).
    compressImageToDataUrl(file)
      .then(({ dataUrl, bytes }) => { setPreview(dataUrl); setPreviewBytes(bytes) })
      .catch((e: any) => setPreviewError(e.message || 'Failed to process image.'))
      .finally(() => setCompressing(false))

    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadOriginalFile(formData)
      if (result.success) setOriginalFilePath(result.path)
    } finally {
      setUploadingOriginal(false)
    }
  }

  function handlePreviewPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    handlePreviewFile(item.getAsFile())
  }

  function handleAdd() {
    if (!dateNeeded) { setFormError('Please set a deadline/date needed.'); return }
    setFormError('')
    onAdd({
      key: `${subcategory.subcategory_id}-${Date.now()}`,
      subcategory_id: subcategory.subcategory_id,
      subcategory_name: subcategory.subcategory_name,
      category_name: subcategory.category_name,
      pricing_model: pricingModel,
      base_price: basePrice,
      quantity: parseInt(quantity) || 1,
      width: parseFloat(width) || null,
      height: parseFloat(height) || null,
      depth: parseFloat(depth) || null,
      no_of_mins: parseFloat(noOfMins) || null,
      letter_count: parseInt(letterCount) || null,
      production_specs: productionSpecs,
      notes: remarks,
      date_time_needed: dateNeeded ? new Date(dateNeeded).toISOString() : null,
      item_preview: preview,
      original_file_path: originalFilePath,
      needs_layout_help: needsLayoutHelp,
      layout_fee: layoutFee,
      line_total: lineTotal,
    })
  }

  return (
    <div className="pf-modal-overlay" style={{ zIndex: 200, alignItems: 'flex-start' }}>
      <div className="pf-modal-card pf-modal-wine" style={{ maxWidth: 580, marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '1.7rem' }}>Create Specification</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#E8B9C6', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ color: '#E8B9C6', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          {subcategory.subcategory_name} · {subcategory.category_name}
        </p>

        <div className="pf-field">
          <label className="pf-label">Pricing Model</label>
          <input type="text" value={PRICING_LABELS[pricingModel] || pricingModel} disabled className="pf-input" />
        </div>

        <div className="pf-field">
          <label className="pf-label">Item Preview</label>
          {preview ? (
            <div onPaste={handlePreviewPaste} tabIndex={0} style={{ display: 'flex', alignItems: 'center', gap: 12, outline: 'none' }}>
              <img
                src={preview}
                alt="Item preview"
                onClick={() => window.open(preview, '_blank')}
                title="Click to view full size"
                style={{ width: 140, height: 140, objectFit: 'contain', background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', cursor: 'zoom-in' }}
              />
              <div style={{ flex: 1 }}>
                {previewBytes != null && (
                  <div style={{ color: '#E8B9C6', fontSize: '0.72rem' }}>Compressed to {(previewBytes / 1024).toFixed(1)} KB</div>
                )}
                <label className="pf-link-btn" style={{ cursor: 'pointer', fontSize: '0.78rem' }}>
                  Change image
                  <input type="file" accept="image/*" onChange={e => handlePreviewFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                </label>
                <div style={{ color: '#E8B9C6', fontSize: '0.68rem', marginTop: 2 }}>...or click here and paste (Ctrl+V) to replace</div>
              </div>
            </div>
          ) : (
            <div onPaste={handlePreviewPaste} tabIndex={0} style={{ border: '1.5px dashed rgba(255,255,255,0.3)', borderRadius: 8, padding: '0.6rem 0.75rem', outline: 'none' }}>
              <input type="file" accept="image/*" onChange={e => handlePreviewFile(e.target.files?.[0] || null)} className="pf-input" style={{ border: 'none', padding: 0 }} />
              <div style={{ color: '#E8B9C6', fontSize: '0.7rem', marginTop: 6 }}>
                Optional — <b>upload</b> the actual file you want printed, or <b>paste (Ctrl+V)</b> a reference/mockup image if you're just showing us the layout idea you want.
              </div>
            </div>
          )}
          {compressing && <div style={{ color: '#E8B9C6', fontSize: '0.72rem', marginTop: 4 }}>Compressing image…</div>}
          {uploadingOriginal && <div style={{ color: '#E8B9C6', fontSize: '0.72rem', marginTop: 4 }}>Uploading file…</div>}
          {previewError && (
            <div style={{ color: '#e74c3c', fontSize: '0.72rem', marginTop: 4 }}>
              {previewError}
              {originalFileName && <> No on-screen preview, but <b>{originalFileName}</b> will still be saved for printing.</>}
            </div>
          )}
        </div>

        <div className="pf-field">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={needsLayoutHelp} onChange={e => setNeedsLayoutHelp(e.target.checked)} style={{ accentColor: '#C9A84C', width: 15, height: 15 }} />
            <span style={{ color: '#fff', fontSize: '0.85rem' }}>I need help with layout/design (+{formatPeso(LAYOUT_FEE)})</span>
          </label>
          <div style={{ color: '#E8B9C6', fontSize: '0.7rem', marginTop: 6 }}>
            {formatPeso(LAYOUT_FEE)} is a starting estimate — the actual layout fee can be lower or higher depending on how complex your design turns out to be. Our team will confirm the final amount with you before starting.
          </div>
          {needsLayoutHelp && originalFileName && (
            <div style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 8, padding: '0.6rem 0.75rem', marginTop: 8, color: '#C9A84C', fontSize: '0.72rem' }}>
              Since you're asking for layout help, we'll treat <b>{originalFileName}</b> as a reference for the look you want — not the final file to print. Our design team will create the layout around it and confirm with you before production.
            </div>
          )}
        </div>

        <div className="pf-grid-2" style={{ marginBottom: '0.85rem' }}>
          <div>
            <label className="pf-label">Base Price (₱)</label>
            <input type="text" value={basePrice.toFixed(2)} disabled className="pf-input" />
          </div>
          <div>
            <label className="pf-label">Quantity</label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" className="pf-input" />
          </div>
        </div>

        {needsDims && (
          <div className={needsDepth ? 'pf-grid-3' : 'pf-grid-2'} style={{ marginBottom: '0.85rem' }}>
            <div>
              <label className="pf-label">Width</label>
              <input type="number" value={width} onChange={e => setWidth(e.target.value)} placeholder="ft" className="pf-input" />
            </div>
            <div>
              <label className="pf-label">Height</label>
              <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="ft" className="pf-input" />
            </div>
            {needsDepth && (
              <div>
                <label className="pf-label">Depth</label>
                <input type="number" value={depth} onChange={e => setDepth(e.target.value)} placeholder="ft" className="pf-input" />
              </div>
            )}
          </div>
        )}

        {needsMins && (
          <div className="pf-field">
            <label className="pf-label">No. of Minutes</label>
            <input type="number" value={noOfMins} onChange={e => setNoOfMins(e.target.value)} className="pf-input" />
          </div>
        )}

        {needsLetters && (
          <div className="pf-field">
            <label className="pf-label">Letter Count</label>
            <input type="number" value={letterCount} onChange={e => setLetterCount(e.target.value)} className="pf-input" />
          </div>
        )}

        <div className="pf-field">
          <label className="pf-label">Production Specs / Description</label>
          <textarea value={productionSpecs} onChange={e => setProductionSpecs(e.target.value)} rows={2} placeholder="Material, size details, color, etc." className="pf-textarea" />
        </div>

        <div className="pf-field">
          <label className="pf-label">Deadline / Date Needed <span className="pf-req">*</span></label>
          <input type="datetime-local" value={dateNeeded} onChange={e => setDateNeeded(e.target.value)} className="pf-input" />
        </div>

        <div className="pf-field">
          <label className="pf-label">Remarks</label>
          <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional" className="pf-input" />
        </div>

        <div className="pf-totals-box">
          {needsLayoutHelp && (
            <>
              <div className="pf-totals-row">
                <span>Item Subtotal</span>
                <span>{formatPeso(itemTotal)}</span>
              </div>
              <div className="pf-totals-row">
                <span>Layout Fee</span>
                <span>{formatPeso(layoutFee)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#000', fontSize: '0.82rem' }}>Line Total</span>
            <span style={{ color: '#000', fontWeight: 700, fontSize: '1rem' }}>{formatPeso(lineTotal)}</span>
          </div>
        </div>

        {formError && <div style={{ color: '#e74c3c', fontSize: '0.82rem', marginTop: '0.75rem', textAlign: 'right' }}>{formError}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button onClick={onClose} className="pf-btn pf-btn-secondary">Cancel</button>
          <button onClick={handleAdd} disabled={compressing || uploadingOriginal} className="pf-btn">Add to Job Order</button>
        </div>
      </div>
    </div>
  )
}
