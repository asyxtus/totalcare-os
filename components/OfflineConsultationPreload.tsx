'use client'

import { useEffect } from 'react'
import { setOfflineCache } from '@/lib/offline/cache'

interface Props {
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

export default function OfflineConsultationPreload(props: Props) {
  useEffect(() => {
    void setOfflineCache(
      `consultation:${props.clinicId}:${props.visitId}`,
      {
        visitId: props.visitId,
        consultationId: props.consultationId,
        clinicId: props.clinicId,
        staffId: props.staffId,
        patientName: props.patientName,
        patientCode: props.patientCode,
        subjectiveNotes: props.subjectiveNotes,
        examinationNotes: props.examinationNotes,
        diagnosis: props.diagnosis,
        diagnosisCode: props.diagnosisCode,
        treatmentPlan: props.treatmentPlan,
        cachedAt: new Date().toISOString(),
      },
      12 * 60 * 60 * 1000,
    )
  }, [props])

  return null
}
