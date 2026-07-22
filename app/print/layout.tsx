// app/print/layout.tsx
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'
import { sourceSerif } from '@/lib/fonts'
import PrintButton from '@/components/PrintButton'

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff() // redirects to /login internally if not authenticated —
                           // print pages still require a real session, just no sidebar chrome

  return (
    <div className={sourceSerif.variable} style={{
      fontFamily: 'var(--font-source-serif)',
      maxWidth: '210mm', // A4 width, since this is what gets printed/saved as PDF
      margin: '0 auto',
      padding: '20mm',
      color: '#16211E',
      background: 'white',
      minHeight: '100vh',
    }}>
      {/* Screen-only print button, hidden by the print media query below */}
      <div className="no-print" style={{ marginBottom: '20px', textAlign: 'right' }}>
        <PrintButton lang={staff.preferredLanguage} />
      </div>

      {children}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 15mm; }
        }
      `}</style>
    </div>
  )
}
