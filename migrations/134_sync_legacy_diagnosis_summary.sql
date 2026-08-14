-- Migration 134: keep legacy consultation diagnosis fields compatible with
-- the structured consultation_diagnoses model.
--
-- This is intentionally a compatibility layer for existing print/report routes
-- that still read consultations.diagnosis and consultations.diagnosis_code.

create or replace function public.sync_consultation_legacy_diagnosis_summary(p_consultation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_diagnosis text;
  v_code text;
  v_clinic_id uuid;
begin
  select clinic_id into v_clinic_id
  from public.consultations
  where id = p_consultation_id;

  if v_clinic_id is null then
    return;
  end if;

  select
    string_agg(
      case
        when d.icd10_code is null or btrim(d.icd10_code) = '' then d.diagnosis
        else d.diagnosis || ' (ICD-10: ' || d.icd10_code || ')'
      end,
      E'\n' order by d.sequence, d.created_at
    ),
    max(d.icd10_code) filter (where d.is_primary)
  into v_diagnosis, v_code
  from public.consultation_diagnoses d
  where d.consultation_id = p_consultation_id
    and d.clinic_id = v_clinic_id;

  update public.consultations
  set
    diagnosis = v_diagnosis,
    diagnosis_code = v_code
  where id = p_consultation_id;
end;
$$;

create or replace function public.trg_sync_consultation_legacy_diagnosis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_consultation_legacy_diagnosis_summary(coalesce(new.consultation_id, old.consultation_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists consultation_diagnoses_sync_legacy on public.consultation_diagnoses;

create trigger consultation_diagnoses_sync_legacy
after insert or update or delete on public.consultation_diagnoses
for each row execute function public.trg_sync_consultation_legacy_diagnosis();

-- Synchronize all existing consultations once.
do $$
declare
  r record;
begin
  for r in select id from public.consultations loop
    perform public.sync_consultation_legacy_diagnosis_summary(r.id);
  end loop;
end;
$$;
