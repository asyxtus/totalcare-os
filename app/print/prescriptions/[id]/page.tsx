// app/print/prescriptions/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export default async function PrintPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const staff = await getCurrentStaff()
  const lang = staff.preferredLanguage
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const supabase = await createClient()

  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .select(`
      id, created_at,
      clinics(name, city, quartier, phone),
      visits(patients(full_name, patient_code, date_of_birth, estimated_age, sex)),
      staff:doctor_id(full_name, license_number),
      prescription_items(id, product_id, drug_name_freetext, dose, frequency, duration_days, quantity_prescribed, products(name))
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !prescription) {
    notFound()
  }

  const clinic = prescription.clinics as any
  const patient = (prescription.visits as any)?.patients as any
  const doctor = prescription.staff as any
  const items = prescription.prescription_items as any[]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', borderBottom: '2px solid #16211E', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>{clinic?.name}</h1>
          <p style={{ fontSize: '13px', color: '#5C6B65', margin: '4px 0 0' }}>
            {clinic?.quartier}, {clinic?.city}
            {clinic?.phone ? ` · ${clinic.phone}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '13px', color: '#5C6B65', margin: 0 }}>{lang === 'fr' ? 'Ordonnance médicale' : 'Medical Prescription'}</p>
          <p style={{ fontSize: '13px', margin: '4px 0 0' }}>
            {new Date(prescription.created_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', margin: '0 0 2px' }}><strong>{patient?.full_name}</strong></p>
        <p style={{ fontSize: '13px', color: '#5C6B65', margin: 0 }}>
          {patient?.patient_code}
          {patient?.date_of_birth
            ? ` · ${lang === 'fr' ? 'Né(e) le' : 'DOB'}: ${new Date(patient.date_of_birth).toLocaleDateString(locale)}`
            : patient?.estimated_age
            ? ` · ${patient.estimated_age} ${lang === 'fr' ? 'ans (estimé)' : 'yrs (estimated)'}`
            : ''}
          {patient?.sex ? ` · ${patient.sex}` : ''}
        </p>
      </div>

      <div style={{ marginBottom: '30px' }}>
        {items.map((item, i) => (
          <div key={item.id} style={{ marginBottom: '16px', paddingLeft: '4px' }}>
            <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 2px' }}>
              {i + 1}. {item.products?.name ?? item.drug_name_freetext}
            </p>
            <p style={{ fontSize: '13px', color: '#3d3d3a', margin: 0, paddingLeft: '18px' }}>
              {[
                item.dose,
                item.frequency,
                item.duration_days ? `${item.duration_days} ${lang === 'fr' ? 'j' : 'days'}` : null,
                `${lang === 'fr' ? 'Qté' : 'Qty'}: ${item.quantity_prescribed}`,
              ].filter(Boolean).join(' — ')}
            </p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '13px', margin: '0 0 40px' }}>{lang === 'fr' ? 'Signature du médecin' : "Doctor's signature"}</p>
          <div style={{ borderTop: '1px solid #16211E', paddingTop: '6px', minWidth: '200px' }}>
            <p style={{ fontSize: '13px', margin: 0 }}>{doctor?.full_name}</p>
            {doctor?.license_number && (
              <p style={{ fontSize: '11px', color: '#5C6B65', margin: '2px 0 0' }}>{lang === 'fr' ? 'N°' : 'No.'} {doctor.license_number}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
