'use client'

// components/POSTerminal.tsx

import { useState, useRef, useEffect } from 'react'
import { checkoutPosSale } from '@/lib/actions/pharmacy'
import { useLang } from '@/lib/i18n/LangContext'

interface Product {
  id: string
  name: string
  barcode: string | null
  salePriceXaf: number
  form: string | null
  strength: string | null
  onHand: number
}

interface CartLine {
  productId: string
  name: string
  unitPrice: number
  quantity: number
}

export default function POSTerminal({ products }: { products: Product[] }) {
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo' | 'orange_money'>('cash')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ total: number; saleId: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const visibleProducts = query.trim()
    ? products.filter((p) =>
        p.barcode === query.trim() ||
        p.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : products

  function addToCart(product: Product) {
    setError(null)
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) {
        return prev.map((l) => l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l)
      }
      return [...prev, { productId: product.id, name: product.name, unitPrice: product.salePriceXaf, quantity: 1 }]
    })
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    const barcodeMatch = products.find((p) => p.barcode === trimmed)
    if (barcodeMatch) {
      addToCart(barcodeMatch)
      setQuery('')
      return
    }

    if (visibleProducts.length === 1) {
      addToCart(visibleProducts[0])
      setQuery('')
    } else if (visibleProducts.length === 0) {
      setError(lang==='fr'?`Aucun produit trouvé pour « ${trimmed} »`:`No product found for '${trimmed}'`)
    }
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) => prev
      .map((l) => l.productId === productId ? { ...l, quantity: l.quantity + delta } : l)
      .filter((l) => l.quantity > 0)
    )
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

  async function handleCheckout() {
    if (cart.length === 0) return
    setSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.set('payment_method', paymentMethod)
    formData.set('cart', JSON.stringify(cart.map((l) => ({ product_id: l.productId, quantity: l.quantity }))))

    const result = await checkoutPosSale(formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSuccess({ total, saleId: result.saleId })
      setCart([])
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
      <div>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={lang==="fr"?"Scanner un code-barres ou rechercher…":"Scan barcode or search…"}
          style={{
            padding: '12px 16px', border: '2px solid var(--color-accent)', borderRadius: 'var(--radius-md)',
            fontSize: '15px', background: 'var(--color-surface)', color: 'var(--color-text-primary)',
            width: '100%', marginBottom: '1rem', boxSizing: 'border-box',
          }}
          autoFocus
        />

        {error && (
          <p style={{ fontSize: '13px', color: 'var(--color-critical-text)', background: 'var(--color-critical-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
          {visibleProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              style={{
                textAlign: 'left', padding: '14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer',
              }}
            >
              <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 2px', color: 'var(--color-text-primary)' }}>{p.name}</p>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
                {[p.form, p.strength].filter(Boolean).join(' ') || '\u00A0'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-accent)' }}>
                  {p.salePriceXaf.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA
                </span>
                <span style={{ fontSize: '11px', color: p.onHand > 0 ? 'var(--color-text-secondary)' : 'var(--color-critical-text)' }}>
                  {p.onHand} en stock
                </span>
              </div>
            </button>
          ))}
          {visibleProducts.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', gridColumn: '1 / -1' }}>
              {lang==='fr'?'Aucun produit ne correspond.':'No matching products.'}
            </p>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', position: 'sticky', top: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <p style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{lang==='fr'?'Panier':'Cart'}</p>
          <span style={{
            fontSize: '12px', background: 'var(--color-bg)', color: 'var(--color-text-secondary)',
            borderRadius: '999px', padding: '2px 10px',
          }}>
            {cart.length}
          </span>
        </div>

        {success && (
          <p style={{ fontSize: '12px', color: 'var(--color-success-text)', background: 'var(--color-success-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '10px' }}>
            ✓ {success.total.toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA {lang==='fr'?'encaissés.':'collected.'}{' '}
            <a href={`/print/pos-sales/${success.saleId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
              Reçu →
            </a>
          </p>
        )}

        {cart.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
            Scanner ou cliquer pour ajouter des articles
          </p>
        ) : (
          <div style={{ marginBottom: '1rem' }}>
            {cart.map((line) => (
              <div key={line.productId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '12px', flex: 1 }}>{line.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={() => updateQuantity(line.productId, -1)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', width: '22px', height: '22px', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '12px' }}>−</button>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', minWidth: '16px', textAlign: 'center' }}>{line.quantity}</span>
                  <button onClick={() => updateQuantity(line.productId, 1)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', width: '22px', height: '22px', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '12px' }}>+</button>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', width: '64px', textAlign: 'right' }}>
                    {(line.unitPrice * line.quantity).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                  </span>
                  <button onClick={() => removeLine(line.productId)} style={{ background: 'none', border: 'none', color: 'var(--color-critical-text)', cursor: 'pointer', fontSize: '13px' }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{lang==='fr'?'Montant à payer':'Amount due'}</span>
            <span style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
              {total.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <button onClick={() => setPaymentMethod('cash')} style={{
            padding: '10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px',
            border: paymentMethod === 'cash' ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
            background: paymentMethod === 'cash' ? 'var(--color-success-bg)' : 'var(--color-surface)',
            color: 'var(--color-text-primary)',
          }}>
            💵 Comptant
          </button>
          <button onClick={() => setPaymentMethod('momo')} style={{
            padding: '10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px',
            border: paymentMethod === 'momo' ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
            background: paymentMethod === 'momo' ? 'var(--color-success-bg)' : 'var(--color-surface)',
            color: 'var(--color-text-primary)',
          }}>
            📱 Mobile Money
          </button>
        </div>

        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || submitting}
          style={{
            width: '100%', fontSize: '14px', fontWeight: 600, padding: '13px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: cart.length === 0 ? 'var(--color-border)' : 'var(--color-accent)',
            color: cart.length === 0 ? 'var(--color-text-secondary)' : 'var(--color-accent-text-on)',
            cursor: cart.length === 0 || submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Traitement…' : '✓ Finaliser la vente'}
        </button>
      </div>
    </div>
  )
}
