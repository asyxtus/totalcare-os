import Link from 'next/link'
import PatientDiagnosisHistory from '@/components/patients/PatientDiagnosisHistory'

export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-2.5rem', position: 'relative', zIndex: 2 }}>
        <Link
          href={`/patients/${id}/edit`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          ✎ Edit patient / Modifier
        </Link>
      </div>
      {children}
      <PatientDiagnosisHistory patientId={id} />
    </div>
  )
}
