// lib/auditLabels.ts
// Every action string audit_log has actually seen written to it across
// the schema, given a plain-language label in both languages. Anything
// not in this map still displays — just as its raw action string — so
// a new action added later doesn't need a code change here to show up
// correctly, only to show up *nicely*.

export const AUDIT_ACTION_LABELS: Record<string, { fr: string; en: string }> = {
  'visit.emergency_flagged': { fr: 'Urgence signalée', en: 'Emergency flagged' },
  'visit.advanced_past_reception': { fr: 'Passé la réception', en: 'Advanced past reception' },
  'visit.triage_completed': { fr: 'Triage terminé', en: 'Triage completed' },
  'visit.consultation_completed': { fr: 'Consultation terminée', en: 'Consultation completed' },
  'visit.transferred_to_doctor': { fr: 'Transféré à un médecin', en: 'Transferred to a doctor' },
  'visit.returned_to_doctor_after_lab': { fr: 'Retour au médecin après labo', en: 'Returned to doctor after lab' },
  'pharmacy.batch_recalled': { fr: 'Lot rappelé', en: 'Batch recalled' },
  'pharmacy.stock_adjusted': { fr: 'Stock ajusté', en: 'Stock adjusted' },
  'admission.recommended': { fr: 'Admission recommandée', en: 'Admission recommended' },
  'admission.bed_assigned': { fr: 'Lit assigné', en: 'Bed assigned' },
  'admission.discharged': { fr: 'Sortie', en: 'Discharged' },
  'admission.transferred': { fr: 'Transféré de service', en: 'Transferred between wards' },
  'admission.prescription_ordered': { fr: 'Prescription ordonnée', en: 'Prescription ordered' },
  'billing.deposit_recorded': { fr: 'Acompte enregistré', en: 'Deposit recorded' },
  'billing.manual_charge_added': { fr: 'Frais manuel ajouté', en: 'Manual charge added' },
  'insurance.claim_created': { fr: 'Réclamation créée', en: 'Claim created' },
  'insurance.claim_submitted': { fr: 'Réclamation soumise', en: 'Claim submitted' },
  'insurance.claim_status_updated': { fr: 'Statut de réclamation modifié', en: 'Claim status updated' },
  'insurance.claim_paid': { fr: 'Réclamation payée', en: 'Claim paid' },
  'staff.invited': { fr: 'Membre du personnel invité', en: 'Staff member invited' },
  'staff.role_changed': { fr: 'Rôle modifié', en: 'Role changed' },
  'staff.deactivated': { fr: 'Compte désactivé', en: 'Account deactivated' },
  'staff.reactivated': { fr: 'Compte réactivé', en: 'Account reactivated' },
  'pricing.service_created': { fr: 'Service créé', en: 'Service created' },
  'pricing.service_price_updated': { fr: 'Tarif de service modifié', en: 'Service price updated' },
  'pricing.service_reactivated': { fr: 'Service réactivé', en: 'Service reactivated' },
  'pricing.service_deactivated': { fr: 'Service désactivé', en: 'Service deactivated' },
  'pricing.lab_test_created': { fr: 'Test de laboratoire créé', en: 'Lab test created' },
  'pricing.lab_test_price_updated': { fr: 'Tarif de test modifié', en: 'Lab test price updated' },
  'pricing.lab_test_reactivated': { fr: 'Test réactivé', en: 'Lab test reactivated' },
  'pricing.lab_test_deactivated': { fr: 'Test désactivé', en: 'Lab test deactivated' },
  'pricing.lab_panel_created': { fr: 'Bilan créé', en: 'Lab panel created' },
  'pricing.lab_panel_price_updated': { fr: 'Tarif de bilan modifié', en: 'Lab panel price updated' },
  'pricing.lab_panel_reactivated': { fr: 'Bilan réactivé', en: 'Lab panel reactivated' },
  'pricing.lab_panel_deactivated': { fr: 'Bilan désactivé', en: 'Lab panel deactivated' },
  'ward.rate_updated': { fr: "Tarif d'hospitalisation modifié", en: 'Ward rate updated' },
  'clinic.nursing_rate_updated': { fr: 'Tarif de soins infirmiers modifié', en: 'Nursing rate updated' },
}

export const AUDIT_CATEGORIES: { prefix: string; fr: string; en: string }[] = [
  { prefix: 'visit', fr: 'Visites', en: 'Visits' },
  { prefix: 'admission', fr: 'Hospitalisation', en: 'Inpatient' },
  { prefix: 'pharmacy', fr: 'Pharmacie', en: 'Pharmacy' },
  { prefix: 'billing', fr: 'Facturation', en: 'Billing' },
  { prefix: 'insurance', fr: 'Assurance', en: 'Insurance' },
  { prefix: 'staff', fr: 'Personnel', en: 'Staff' },
  { prefix: 'pricing', fr: 'Tarifs', en: 'Pricing' },
  { prefix: 'ward', fr: 'Services (hospitalisation)', en: 'Wards' },
  { prefix: 'clinic', fr: 'Clinique', en: 'Clinic' },
]

export function auditActionLabel(action: string, lang: 'fr' | 'en'): string {
  return AUDIT_ACTION_LABELS[action]?.[lang] ?? action
}
