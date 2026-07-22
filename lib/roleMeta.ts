// lib/roleMeta.ts
// Single source of truth for how a staff_role reads in the UI — label in
// both languages, and which role-color token pair it maps to. Anything
// that renders a role (the Admin staff directory today, anywhere else
// tomorrow) should pull from here rather than re-deriving its own label.

import type { StaffRole } from '@/lib/types'

export const ROLE_META: Record<StaffRole, { labelFr: string; labelEn: string; bgVar: string; textVar: string }> = {
  admin:          { labelFr: 'Administrateur', labelEn: 'Admin',         bgVar: '--role-admin-bg',      textVar: '--role-admin-text' },
  doctor:         { labelFr: 'Médecin',         labelEn: 'Doctor',       bgVar: '--role-doctor-bg',     textVar: '--role-doctor-text' },
  nurse:          { labelFr: 'Infirmier(ère)',  labelEn: 'Nurse',        bgVar: '--role-nurse-bg',      textVar: '--role-nurse-text' },
  pharmacist:     { labelFr: 'Pharmacien(ne)',  labelEn: 'Pharmacist',   bgVar: '--role-pharmacist-bg', textVar: '--role-pharmacist-text' },
  lab_technician: { labelFr: 'Technicien lab.', labelEn: 'Lab Tech',     bgVar: '--role-lab-bg',        textVar: '--role-lab-text' },
  receptionist:   { labelFr: 'Réceptionniste',  labelEn: 'Receptionist', bgVar: '--role-reception-bg',  textVar: '--role-reception-text' },
  billing_clerk:  { labelFr: 'Agent facturation', labelEn: 'Billing Clerk', bgVar: '--role-billing-bg', textVar: '--role-billing-text' },
  auditor:        { labelFr: 'Auditeur',        labelEn: 'Auditor',      bgVar: '--role-auditor-bg',    textVar: '--role-auditor-text' },
}

export const ALL_ROLES = Object.keys(ROLE_META) as StaffRole[]

export function roleLabel(role: StaffRole, lang: 'fr' | 'en') {
  return lang === 'fr' ? ROLE_META[role].labelFr : ROLE_META[role].labelEn
}

export function initialsOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase() || '?'
}
