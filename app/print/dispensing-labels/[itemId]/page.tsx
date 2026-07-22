// app/print/dispensing-labels/[itemId]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export default async function PrintDispensingLabelPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const supabase = await createClient()

  const { data: item, error } = await supabase
    .from('prescription_items')
    .select(`
      dose, frequency, duration_days, instructions, quantity_prescribed, dispensing_notes,
      products(name),
      drug_name_freetext,
      prescriptions(visits(patients(full_name, patient_code)), clinics(name, phone))
    `)
    .eq('id', itemId)
    .maybeSingle()

  if (error || !item) notFound()

  const prescription = item.prescriptions as any
  const patient = prescription?.visits?.patients
  const clinic = prescription?.clinics
  const drugName = (item.products as any)?.name ?? item.drug_name_freetext ?? (lang === 'fr' ? 'Médicament' : 'Medication')

  const L = {
    note: lang === 'fr' ? 'Note : étiquette compacte — découper à la taille.' : 'Note: compact label — cut to size.',
    instructions: lang === 'fr' ? 'Conseils' : 'Instructions',
    quantity: lang === 'fr' ? 'Quantité' : 'Quantity',
  }

  return (
    <div>
      <p style={{ fontSize: '11px', color: '#5C6B65', margin: '0 0 20px' }}>
        {L.note}
      </p>

      <div style={{
        border: '2px solid #16211E', borderRadius: '4px', padding: '16px', maxWidth: '340px',
      }}>
        <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 6px' }}>{clinic?.name}</p>
        <p style={{ fontSize: '11px', color: '#5C6B65', margin: '0 0 12px' }}>{clinic?.phone}</p>

        <p style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>{drugName}</p>
        <p style={{ fontSize: '13px', margin: '0 0 10px' }}>
          {[item.dose, item.frequency, item.duration_days ? `${item.duration_days} ${lang === 'fr' ? 'j' : 'days'}` : null].filter(Boolean).join(' — ')}
        </p>

        {item.instructions && (
          <p style={{ fontSize: '12px', margin: '0 0 10px', fontStyle: 'italic' }}>{item.instructions}</p>
        )}

        <div style={{ borderTop: '1px solid #DCE3DE', paddingTop: '8px', marginTop: '8px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>{patient?.full_name}</p>
          <p style={{ fontSize: '10px', color: '#5C6B65', margin: '2px 0 0' }}>{patient?.patient_code}</p>
        </div>

        {item.dispensing_notes && (
          <p style={{ fontSize: '11px', color: '#5C6B65', margin: '8px 0 0' }}>
            {L.instructions}: {item.dispensing_notes}
          </p>
        )}

        <p style={{ fontSize: '10px', color: '#5C6B65', margin: '10px 0 0' }}>
          {L.quantity}: {item.quantity_prescribed}
        </p>
      </div>
    </div>
  )
}
