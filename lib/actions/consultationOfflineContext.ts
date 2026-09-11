'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export interface OfflineConsultationContext {
  visitId: string
  consultationId: string
  clinicId: string
  staffId: string
  patientName: string
  patientCode: string
  subjectiveNotes: string
  examinationNotes: string
  diagnosis: string
  diagnosisCode: string
  treatmentPlan: string
}

export async function getOfflineConsultationContext(visitId: string): Promise<OfflineConsultationContext | null> {
  const staff = await getCurrentStaff()
  if (!['doctor', 'admin'].includes(staff.role)) return null

  const supabase = await createClient()
  const { data: visit } = await supabase
    .from('visits')
    .select('id, clinic_id, patient_id, status, patients(full_name, patient_code)')
    .eq('id', visitId)
    .eq('clinic_id', staff.clinicId)
    .maybeSingle()

  if (!visit || !['in_consultation', 'waiting_lab', 'waiting_consultation'].includes(visit.status)) return null

  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, doctor_id, subjective_notes, examination_notes, diagnosis, diagnosis_code, treatment_plan, completed_at')
    .eq('visit_id', visitId)
    .eq('clinic_id', staff.clinicId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!consultation || consultation.completed_at) return null
  if (consultation.doctor_id !== staff.staffId && staff.role !== 'admin') return null

  const patient = visit.patients as any
  return {
    visitId: visit.id,
    consultationId: consultation.id,
    clinicId: staff.clinicId,
    staffId: staff.staffId,
    patientName: patient?.full_name ?? 'Patient',
    patientCode: patient?.patient_code ?? '',
    subjectiveNotes: consultation.subjective_notes ?? '',
    examinationNotes: consultation.examination_notes ?? '',
    diagnosis: consultation.diagnosis ?? '',
    diagnosisCode: consultation.diagnosis_code ?? '',
    treatmentPlan: consultation.treatment_plan ?? '',
  }
}
