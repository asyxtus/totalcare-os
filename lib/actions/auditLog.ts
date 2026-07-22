// lib/actions/auditLog.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth/getCurrentStaff'

export interface AuditLogEntry {
  id: string
  created_at: string
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  staff_id: string | null
  staff: { full_name: string } | null
}

export async function fetchAuditLogAction(filters: {
  category?: string
  search?: string
  before?: string
}): Promise<{ entries: AuditLogEntry[]; error?: string }> {
  const staff = await getCurrentStaff()
  if (!['admin', 'auditor'].includes(staff.role)) {
    return { entries: [], error: 'Accès réservé aux administrateurs et auditeurs.' }
  }

  const supabase = await createClient()
  let query = supabase
    .from('audit_log')
    .select('id, created_at, action, entity_type, entity_id, details, staff_id, staff(full_name)')
    .eq('clinic_id', staff.clinicId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (filters.category) {
    query = query.like('action', `${filters.category}.%`)
  }
  if (filters.before) {
    query = query.lt('created_at', filters.before)
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim()
    query = query.or(`action.ilike.%${q}%,entity_type.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) {
    console.error('fetchAuditLog failed:', error)
    return { entries: [], error: 'Impossible de charger le journal d\'audit.' }
  }

  return { entries: (data ?? []) as any }
}
