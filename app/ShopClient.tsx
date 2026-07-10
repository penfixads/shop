'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { formatPriceLabel } from '@/lib/pricing'
import CreateSpecsModal, { type DraftItem } from './CreateSpecsModal'
import { RegistrationModal, RewardsModal, JobOrderModal } from './HelpDeskModals'

interface Category {
  category_id: string
  category_name: string
}

interface Subcategory {
  subcategory_id: string
  subcategory_name: string
  category_id: string
  pricing_model: string
  base_price: number
  unit: string | null
}

interface Props {
  categories: Category[]
  subcategories: Subcategory[]
}

export default function ShopClient({ categories, subcategories }: Props) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.category_id ?? '')
  const [search, setSearch] = useState('')
  const [qtyBySubcategory, setQtyBySubcategory] = useState<Record<string, number>>({})
  const [helpMenuOpen, setHelpMenuOpen] = useState(false)
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const [specsFor, setSpecsFor] = useState<Subcategory | null>(null)
  const [cart, setCart] = useState<DraftItem[]>([])
  const [activeHelpModal, setActiveHelpModal] = useState<'registration' | 'rewards' | null>(null)
  const [jobOrderOpen, setJobOrderOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const inCategory = subcategories.filter(s => s.category_id === activeCategory)
    if (!q) return inCategory
    // Search reaches across all categories once there's a query, not just the active tab.
    return subcategories.filter(s =>
      s.subcategory_name.toLowerCase().includes(q) || s.subcategory_id.toLowerCase().includes(q)
    )
  }, [subcategories, activeCategory, search])

  function getQty(id: string) {
    return qtyBySubcategory[id] ?? 1
  }
  function setQty(id: string, qty: number) {
    setQtyBySubcategory(prev => ({ ...prev, [id]: Math.max(1, qty) }))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <header>
        <div style={{ background: '#5C001F' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 0' }}>
              <Image src="/penfixtwhhite.png" alt="Penfix" width={52} height={52} style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Penfix Services</span>
            </div>
          </div>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
        <nav style={{ position: 'relative', padding: '0.75rem 0 1rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            What service are you looking for?
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setCategoryMenuOpen(v => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#F9EBD8',
                  border: '1px solid #eee1d6',
                  borderRadius: 8,
                  color: '#7A1828',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '0.55rem 0.9rem',
                  cursor: 'pointer',
                }}
              >
                {categories.find(c => c.category_id === activeCategory)?.category_name ?? 'Categories'}
                <span style={{ transition: 'transform 0.15s ease', transform: categoryMenuOpen ? 'rotate(180deg)' : 'none', fontSize: '0.7rem' }}>▾</span>
              </button>

              {categoryMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setCategoryMenuOpen(false)} />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '0.4rem',
                    background: '#fff',
                    border: '1px solid #eee1d6',
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    padding: '0.5rem',
                    minWidth: 260,
                    maxHeight: 360,
                    overflowY: 'auto',
                    zIndex: 40,
                  }}>
                    {categories.map(c => (
                      <button
                        key={c.category_id}
                        onClick={() => { setActiveCategory(c.category_id); setSearch(''); setCategoryMenuOpen(false) }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          background: activeCategory === c.category_id ? '#F9EBD8' : 'none',
                          border: 'none',
                          borderRadius: 8,
                          color: activeCategory === c.category_id ? '#7A1828' : '#2a2426',
                          fontWeight: activeCategory === c.category_id ? 700 : 500,
                          fontSize: '0.85rem',
                          padding: '0.5rem 0.7rem',
                          cursor: 'pointer',
                        }}
                      >
                        {c.category_name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setJobOrderOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 999, padding: '0.35rem 0.9rem', background: 'none', cursor: 'pointer', flexShrink: 0 }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>JO</span>
              <span style={{ background: '#C9A84C', color: '#5C001F', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, padding: '0.05rem 0.5rem' }}>{cart.length}</span>
            </button>
          </div>
        </nav>
          </div>
        </div>
      </header>

      <main className="pf-main-content" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: '1.25rem', maxWidth: 400 }}>
          <input
            className="pf-input"
            style={{ border: '1px solid #d8ccc0', borderRadius: 8, padding: '0.6rem 0.9rem' }}
            placeholder="Search by SKU, name, or group…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
          {search ? `Results for "${search}"` : categories.find(c => c.category_id === activeCategory)?.category_name}
        </h2>

        {filtered.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.9rem' }}>No services found.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {filtered.map(s => (
              <div key={s.subcategory_id} style={{ background: '#fff', border: '1px solid #eee1d6', borderRadius: 12, padding: '1rem' }}>
                <div style={{ height: 100, background: '#F9EBD8', borderRadius: 8, marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2a2426' }}>{s.subcategory_name}</div>
                <div style={{ fontSize: '0.72rem', color: '#999', marginBottom: '0.4rem' }}>{s.subcategory_id}</div>
                <div style={{ fontSize: '0.85rem', color: '#1a5a1a', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {formatPriceLabel(s.pricing_model, s.base_price, s.unit)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#F9EBD8', borderRadius: 8, padding: '0.2rem 0.4rem' }}>
                    <button className="pf-btn pf-btn-secondary" style={{ padding: '0.15rem 0.5rem' }} onClick={() => setQty(s.subcategory_id, getQty(s.subcategory_id) - 1)}>−</button>
                    <span style={{ fontSize: '0.85rem', minWidth: 16, textAlign: 'center' }}>{getQty(s.subcategory_id)}</span>
                    <button className="pf-btn pf-btn-secondary" style={{ padding: '0.15rem 0.5rem' }} onClick={() => setQty(s.subcategory_id, getQty(s.subcategory_id) + 1)}>+</button>
                  </div>
                  <button className="pf-link-btn" style={{ fontSize: '0.85rem' }} onClick={() => setSpecsFor(s)}>Create Specs</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', display: 'flex', alignItems: 'center' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: helpMenuOpen ? '1.5rem' : 0,
          maxWidth: helpMenuOpen ? 400 : 0,
          opacity: helpMenuOpen ? 1 : 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          transition: 'max-width 0.25s ease, opacity 0.2s ease, gap 0.25s ease',
          marginRight: helpMenuOpen ? '1.5rem' : 0,
        }}>
          <button onClick={() => { setActiveHelpModal('registration'); setHelpMenuOpen(false) }} className="pf-link-btn" style={{ fontSize: '0.85rem' }}>Registration</button>
          <button onClick={() => { setActiveHelpModal('rewards'); setHelpMenuOpen(false) }} className="pf-link-btn" style={{ fontSize: '0.85rem' }}>Rewards</button>
        </div>
        <button
          className="pf-btn"
          style={{ borderRadius: '50%', width: 40, height: 40, fontSize: '1.1rem', flexShrink: 0 }}
          onClick={() => setHelpMenuOpen(v => !v)}
          aria-label={helpMenuOpen ? 'Close help menu' : 'Open help menu'}
        >
          {helpMenuOpen ? '×' : '?'}
        </button>
      </div>

      {specsFor && (
        <CreateSpecsModal
          subcategory={{
            ...specsFor,
            category_name: categories.find(c => c.category_id === specsFor.category_id)?.category_name ?? '',
          }}
          initialQty={getQty(specsFor.subcategory_id)}
          onClose={() => setSpecsFor(null)}
          onAdd={item => { setCart(prev => [...prev, item]); setSpecsFor(null) }}
        />
      )}

      {activeHelpModal === 'registration' && <RegistrationModal onClose={() => setActiveHelpModal(null)} />}
      {activeHelpModal === 'rewards' && <RewardsModal onClose={() => setActiveHelpModal(null)} />}
      {jobOrderOpen && <JobOrderModal cart={cart} onClose={() => setJobOrderOpen(false)} onOrderPlaced={() => setCart([])} />}
    </div>
  )
}
