-- ============================================================================
-- MIGRATION 175: DATABASE-LEVEL SIGNED SOAP IMMUTABILITY
--
-- The RPCs already prevent editing a signed consultation. This trigger adds a
-- second protection layer so a signed SOAP cannot be modified through a direct
-- table UPDATE, regardless of client/UI behaviour.
-- ============================================================================

create or replace function public.prevent_signed_consultation_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.signed_at is not null then
    if new.subjective_notes is distinct from old.subjective_notes
       or new.examination_notes is distinct from old.examination_notes
       or new.diagnosis is distinct from old.diagnosis
       or new.treatment_plan is distinct from old.treatment_plan
       or new.signed_at is distinct from old.signed_at
       or new.signed_by is distinct from old.signed_by then
      raise exception 'Signed clinical note is immutable; use a consultation addendum';
    end if;
  end if;

  if old.signed_at is null and new.signed_at is not null then
    if new.signed_by is null then
      raise exception 'A signed clinical note must have a signing clinician';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_signed_consultation_mutation on public.consultations;
create trigger trg_prevent_signed_consultation_mutation
before update on public.consultations
for each row execute function public.prevent_signed_consultation_mutation();
