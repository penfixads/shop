'use client'

import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react'
import Image from 'next/image'
import { formatPriceLabel, formatStartsAtLabel, isQuoteOnlyCategory } from '@/lib/pricing'
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
  imageMap: Record<string, string>
}

// Same inline-SVG-icon approach as penfixads-OS's Sidebar.tsx (stroke="currentColor" so
// the icon always matches the surrounding text color instead of carrying its own).
const NavIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} {...p} />
)

function getCategoryIcon(categoryName: string): React.ReactNode {
  const name = categoryName.toLowerCase()
  if (name.includes('banner')) return <NavIcon><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></NavIcon>
  if (name.includes('business') || name.includes('marketing')) return <NavIcon><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></NavIcon>
  if (name.includes('acrylic')) return <NavIcon><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></NavIcon>
  if (name.includes('merch')) return <NavIcon><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></NavIcon>
  if (name.includes('desktop') || name.includes('publishing')) return <NavIcon><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></NavIcon>
  if (name.includes('display')) return <NavIcon><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></NavIcon>
  if (name.includes('non-lighted') || name.includes('non lighted')) return <NavIcon><rect x="3" y="4" width="18" height="12" rx="1" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="16" x2="12" y2="20" /></NavIcon>
  if (name.includes('lighted') || name.includes('sign')) return <NavIcon><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></NavIcon>
  if (name.includes('material')) return <NavIcon><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></NavIcon>
  if (name.includes('production')) return <NavIcon><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41" /></NavIcon>
  if (name.includes('sticker')) return <NavIcon><path d="M20.59 13.41L11 3.83V3H10.17L1.59 11.58a2 2 0 0 0 0 2.83l7 7a2 2 0 0 0 2.83 0l9.17-9.17a2 2 0 0 0 0-2.83z" /><circle cx="6.5" cy="6.5" r="1" /></NavIcon>
  return <NavIcon><circle cx="12" cy="12" r="9" /></NavIcon>
}

export default function ShopClient({ categories, subcategories, imageMap }: Props) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.category_id ?? '')
  const [search, setSearch] = useState('')
  const [qtyBySubcategory, setQtyBySubcategory] = useState<Record<string, number>>({})
  const [helpMenuOpen, setHelpMenuOpen] = useState(false)
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const [specsFor, setSpecsFor] = useState<Subcategory | null>(null)
  const [cart, setCart] = useState<DraftItem[]>([])
  const [activeHelpModal, setActiveHelpModal] = useState<'registration' | 'rewards' | null>(null)
  const [jobOrderOpen, setJobOrderOpen] = useState(false)
  const [page, setPage] = useState(1)
  const gridRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const inCategory = subcategories.filter(s => s.category_id === activeCategory)
    if (!q) return inCategory
    // Search reaches across all categories once there's a query, not just the active tab.
    return subcategories.filter(s =>
      s.subcategory_name.toLowerCase().includes(q) || s.subcategory_id.toLowerCase().includes(q)
    )
  }, [subcategories, activeCategory, search])

  // The grid uses auto-fill columns, so the actual column count depends on
  // viewport width. Read it back from the rendered grid so "3 rows" means
  // 3 rows regardless of how many columns fit.
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const count = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length
      setColumns(Math.max(1, count))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const itemsPerPage = columns * 3
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))

  useEffect(() => {
    setPage(1)
  }, [search, activeCategory, itemsPerPage])

  const pageItems = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage)

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
            <div style={{ position: 'relative', width: 280 }}>
              <button
                onClick={() => setCategoryMenuOpen(v => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  width: '100%',
                  background: '#3b3f46',
                  border: '1px solid #4b4f57',
                  borderRadius: 10,
                  color: '#f5f5f5',
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
                    background: '#1e2939',
                    border: '1px solid #3a3d42',
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                    padding: '0.5rem',
                    width: '100%',
                    maxHeight: 360,
                    overflowY: 'auto',
                    zIndex: 40,
                  }}>
                    {categories.map(c => (
                      <button
                        key={c.category_id}
                        onClick={() => { setActiveCategory(c.category_id); setSearch(''); setCategoryMenuOpen(false) }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          width: '100%',
                          textAlign: 'left',
                          background: activeCategory === c.category_id ? '#3b3f46' : 'none',
                          border: 'none',
                          borderRadius: 8,
                          color: activeCategory === c.category_id ? '#fff' : '#c7c9cc',
                          fontWeight: activeCategory === c.category_id ? 700 : 500,
                          fontSize: '0.85rem',
                          padding: '0.5rem 0.7rem',
                          cursor: 'pointer',
                        }}
                      >
                        {getCategoryIcon(c.category_name)}
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
          <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#999', marginLeft: '0.5rem' }}>
            ({filtered.length} {filtered.length === 1 ? 'service' : 'services'})
          </span>
        </h2>

        {filtered.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.9rem' }}>No services found.</p>
        ) : (
          <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {pageItems.map(s => (
              <div key={s.subcategory_id} style={{ background: '#fff', border: '1px solid #eee1d6', borderRadius: 12, padding: '1rem' }}>
                {imageMap[s.subcategory_id] ? (
                  <div style={{ position: 'relative', height: 100, borderRadius: 8, marginBottom: '0.75rem', overflow: 'hidden', background: '#F9EBD8' }}>
                    <Image src={imageMap[s.subcategory_id]} alt={s.subcategory_name} fill style={{ objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ height: 100, background: '#F9EBD8', borderRadius: 8, marginBottom: '0.75rem' }} />
                )}
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2a2426' }}>{s.subcategory_name}</div>
                <div style={{ fontSize: '0.72rem', color: '#999', marginBottom: '0.4rem' }}>{s.subcategory_id}</div>
                <div style={{ fontSize: '0.85rem', color: '#1a5a1a', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {isQuoteOnlyCategory(s.category_id)
                    ? formatStartsAtLabel(s.pricing_model, s.base_price, s.unit)
                    : formatPriceLabel(s.pricing_model, s.base_price, s.unit)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#E5E5E5', borderRadius: 8, padding: '0.2rem 0.4rem' }}>
                    <button className="pf-btn pf-btn-secondary" style={{ padding: '0.15rem 0.5rem' }} onClick={() => setQty(s.subcategory_id, getQty(s.subcategory_id) - 1)}>−</button>
                    <span style={{ fontSize: '0.85rem', minWidth: 16, textAlign: 'center' }}>{getQty(s.subcategory_id)}</span>
                    <button className="pf-btn pf-btn-secondary" style={{ padding: '0.15rem 0.5rem' }} onClick={() => setQty(s.subcategory_id, getQty(s.subcategory_id) + 1)}>+</button>
                  </div>
                  <button className="pf-link-btn" style={{ fontSize: '0.85rem' }} onClick={() => setSpecsFor(s)}>
                    {isQuoteOnlyCategory(s.category_id) ? 'Request Quotation' : 'Create Specs'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length > 0 && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
            <button
              className="pf-btn pf-btn-secondary"
              style={{ padding: '0.4rem 0.9rem', opacity: page === 1 ? 0.5 : 1 }}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>Page {page} of {totalPages}</span>
            <button
              className="pf-btn pf-btn-secondary"
              style={{ padding: '0.4rem 0.9rem', opacity: page === totalPages ? 0.5 : 1 }}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
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
          background: 'rgba(255,255,255,0.28)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.35)',
          borderRadius: 999,
          padding: helpMenuOpen ? '0.6rem 1.1rem' : 0,
          boxShadow: '0 4px 18px rgba(0,0,0,0.15)',
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
