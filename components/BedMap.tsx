'use client'

// components/BedMap.tsx
import { useLang } from '@/lib/i18n/LangContext'
import DischargeRow from '@/components/DischargeRow'
interface Bed {
  id: string; bed_number: string; status: string
  patient_name?: string; patient_code?: string; admission_id?: string; admission_number?: string; bed_assigned_at?: string; days_admitted?: number
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
                        <div style={{
                          marginTop: '8px',
                          paddingTop: '8px',
                          borderTop: '1px solid var(--color-border)',
                        }}>
                          <p style={{ fontSize: '12px', margin: 0, fontWeight: 650, lineHeight: 1.3 }}>{bed.patient_name}</p>
                          {bed.patient_code && (
                            <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '3px 0 0', fontFamily: 'var(--font-mono)' }}>
                              {bed.patient_code}
                            </p>
                          )}
                          <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', margin: '3px 0 0', fontFamily: 'var(--font-mono)' }}>
                            {bed.admission_number} · {lang === 'fr' ? 'Jour' : 'Day'} {bed.days_admitted}
                          </p>
                          {bed.admission_id && (
                            <div style={{ marginTop: '8px' }}>
                              <DischargeRow
                                startExpanded={false}
                                hideHeader={false}
                                admission={{
                                  id: bed.admission_id,
                                  admission_number: bed.admission_number ?? '—',
                                  patient_name: bed.patient_name,
                                  ward_name: ward.name,
                                  bed_number: bed.bed_number,
                                }}
                              />
                            </div>
                          )}
                        </div>
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
