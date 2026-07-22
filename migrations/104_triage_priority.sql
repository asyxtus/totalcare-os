-- ============================================================================
-- TRIAGE PRIORITY + NURSE-TO-DOCTOR NOTIFICATIONS
--
-- Part of the full clinical flow redesign:
-- Register → Reception/Schedule → Triage (nurse sets priority) →
-- Doctor queue (sorted by priority) → Consultation → Admit or discharge
--
-- Priority is set by the nurse during triage, not by the doctor or
-- reception. The nurse is the clinical gatekeeper who has actually
-- assessed the patient — they're the right person to decide urgency.
--
-- Three levels, deliberately not more:
--   routine  — standard queue order (FIFO within this level)
--   urgent   — patient needs to be seen soon; appears above routine
--   critical — patient needs immediate attention; appears at top,
--              triggers a banner on the Doctor module
--
-- priority_note is a free-text field from the nurse to the doctor:
-- "SpO2 82%, respiratory distress", "severe pain 9/10", etc. This is
-- the actual notification mechanism — more reliable than a push
-- notification in a clinic where doctors are often not at a desk.
-- ============================================================================

alter table visits
  add column if not exists triage_priority text not null default 'routine'
    check (triage_priority in ('routine', 'urgent', 'critical')),
  add column if not exists priority_note text,
  add column if not exists priority_flagged_by uuid references staff(id),
  add column if not exists priority_flagged_at timestamptz;

create index if not exists idx_visits_priority on visits (triage_priority, created_at)
  where status in ('waiting_consultation', 'triage');

-- A function nurses call to flag/update priority without going through
-- the full triage flow — for when a patient's condition changes while
-- waiting (e.g. they were routine but deteriorated in the waiting room).
create or replace function set_visit_priority(
  p_visit_id uuid,
  p_priority text,
  p_note text default null
)
returns void
language plpgsql
security invoker
as $$
begin
  if p_priority not in ('routine', 'urgent', 'critical') then
    raise exception 'Invalid priority: %', p_priority;
  end if;

  update visits
  set
    triage_priority = p_priority,
    priority_note = p_note,
    priority_flagged_by = auth.uid()::uuid,
    priority_flagged_at = now()
  where id = p_visit_id
    and clinic_id = current_staff_clinic_id();

  if not found then
    raise exception 'Visit not found or not in your clinic';
  end if;
end;
$$;
