'use client'

// components/BedMap.tsx
import { useLang } from '@/lib/i18n/LangContext'
interface Bed {
  id: string; bed_number: string; status: string
  patient_name?: string; admission_number?: string; days_admitted?: number
}
interface Ward {
  id: string; name: string; ward_type: string | null; capacity: number | null; beds: Bed[]
}

export default function BedMap({ wards }: { wards: Ward[] }) {
  const lang = useLang()
  if (wards.length === 0) {
    return <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucun service créé.':'No wards created.'}</p>
  }

  return (
    <div>
      {wards.map((ward) => {
        const available = ward.beds.filter((b) => b.status === 'available').length
        const occupied = ward.beds.filter((b) => b.status === 'occupied').length

        return (
          <div key={ward.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{ward.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                  {ward.ward_type ?? '—'}{ward.capacity ? ` · Capacité : ${ward.capacity}` : ''}
                </p>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                <span style={{ color: 'var(--color-success-text)' }}>{available} disponibles</span>
                {' · '}
                <span style={{ color: 'var(--color-warning-text)' }}>{occupied} {lang==='fr'?'occupés':'occupied'}</span>
                {' · '}{ward.beds.length} lits
              </span>
            </div>

            {ward.beds.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{lang==='fr'?'Aucun lit dans ce service.':'No beds in this ward.'}</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {ward.beds.map((bed) => {
                  const isOccupied = bed.status === 'occupied'
                  const bg = isOccupied ? 'var(--color-warning-bg)' : bed.status === 'available' ? 'var(--color-success-bg)' : 'var(--color-bg)'
                  const border = isOccupied ? '1px solid var(--color-warning-text)' : bed.status === 'available' ? '1px solid var(--color-success-text)' : '1px solid var(--color-border)'
                  return (
                    <div key={bed.id} style={{ background: bg, border, borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>
                        {isOccupied ? '● ' : '○ '}{bed.bed_number}
                      </p>
                      <p style={{ fontSize: '11px', margin: 0, color: isOccupied ? 'var(--color-warning-text)' : 'var(--color-success-text)' }}>
                        {bed.status}
                      </p>
                      {isOccupied && bed.patient_name && (
                        <>
                          <p style={{ fontSize: '12px', margin: '6px 0 0', fontWeight: 500 }}>{bed.patient_name}</p>
                          <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
                            {bed.admission_number} · Jour {bed.days_admitted}
                          </p>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
