-- 165_backfill_completed_encounters.sql
-- One-time reconciliation for encounters left at waiting_pharmacy/waiting_lab/billing
-- after their actual work was already completed.

DO $$
declare
  r record;
begin
  for r in
    select v.id
    from public.visits v
    where v.status::text in ('waiting_pharmacy', 'waiting_lab', 'billing')
  loop
    perform public.advance_encounter_status(r.id);
  end loop;
end;
$$;
