'use client'

// components/InventoryTable.tsx

import { useState } from 'react'
import InventoryTableRow from '@/components/InventoryTableRow'
import { useLang } from '@/lib/i18n/LangContext'

interface DrugClass { id: string; name_fr: string }
interface Product {
  product_id: string
  sku: string | null
  name: string
  drug_class_name: string | null
  barcode: string | null
  sale_price_xaf: number
  cost_price_xaf: number | null
  reorder_threshold: number
  is_active: boolean
  on_hand: number
}

export default function InventoryTable({ products, categories, drugClasses }: { products: Product[]; categories: string[]; drugClasses: DrugClass[] }) {
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all')

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)',
  }

  const filtered = products.filter((p) => {
    if (query.trim()) {
      const q = query.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !(p.barcode ?? '').toLowerCase().includes(q) && !(p.sku ?? '').toLowerCase().includes(q)) return false
    }
    if (category && p.drug_class_name !== category) return false
    if (statusFilter === 'low' && !(p.on_hand > 0 && p.on_hand < p.reorder_threshold)) return false
    if (statusFilter === 'out' && p.on_hand !== 0) return false
    return true
  })

  const filterButtonStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '12px', padding: '7px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    border: '1px solid var(--color-border)',
    background: active ? 'var(--color-accent)' : 'var(--color-surface)',
    color: active ? 'var(--color-accent-text-on)' : 'var(--color-text-primary)',
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang==="fr"?"Rechercher un produit ou un code-barres…":"Search product or barcode…"}
          style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          <option value="">{lang==="fr"?"Toutes catégories":"All categories"}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setStatusFilter('all')} style={filterButtonStyle(statusFilter === 'all')}>{lang==='fr'?'Tous':'All'}</button>
        <button onClick={() => setStatusFilter('low')} style={filterButtonStyle(statusFilter === 'low')}>{lang==='fr'?'Stock faible':'Low stock'}</button>
        <button onClick={() => setStatusFilter('out')} style={filterButtonStyle(statusFilter === 'out')}>{lang==='fr'?'Épuisé':'Out of stock'}</button>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '0.7fr 2fr 1.2fr 1fr 1fr 0.7fr 1.2fr', gap: '10px', padding: '10px 14px', minWidth: '640px',
          fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span>SKU</span><span>{lang==='fr'?'Produit':'Product'}</span><span>{lang==='fr'?'Catégorie':'Category'}</span><span>Stock</span><span>{lang==='fr'?'Prix':'Price'}</span><span>{lang==='fr'?'Statut':'Status'}</span><span></span>
        </div>
        {filtered.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', padding: '1rem' }}>{lang==="fr"?'Aucun produit ne correspond.':'No matching products.'}</p>
        )}
        {filtered.map((p) => <InventoryTableRow key={p.product_id} product={p} drugClasses={drugClasses} />)}
      </div>
    </div>
  )
}
