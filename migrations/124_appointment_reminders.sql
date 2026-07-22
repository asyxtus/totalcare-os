-- ============================================================================
-- APPOINTMENT REMINDER CALL LIST
--
-- No-shows are pure lost revenue. Without an SMS gateway, the practical tool
-- is a daily call list: tomorrow's scheduled appointments with the patient's
-- phone number, so the receptionist can ring each one and confirm.
--
-- Adds a reminder_called_at timestamp so the receptionist can mark who's been
-- reached and not call the same person twice. The RPC returns tomorrow's list
-- (or any target date) with everything needed to make the call.
-- ============================================================================

alter table appointments
  add column if not exists reminder_called_at timestamptz,
  add column if not exists reminder_called_by uuid references staff(id),
  add column if not exists reminder_outcome text
    check (reminder_outcome is null or reminder_outcome in ('confirmed', 'no_answer', 'rescheduled', 'cancelled'));

-- ── The call list for a given date (defaults to tomorrow) ───────────────────
create or replace function appointment_reminder_list(
  p_clinic_id uuid,
  p_date date default null
)
returns table (
  appointment_id     uuid,
  scheduled_at       timestamptz,
  patient_id         uuid,
  patient_name       text,
  patient_phone      text,
  doctor_name        text,
  reason             text,
  reminder_called_at timestamptz,
  reminder_outcome   text
)
language sql
stable
as $$
  with target as (
    select coalesce(
      p_date,
      (timezone('Africa/Douala', now()))::date + 1   -- tomorrow by default
    ) as d
  )
  select
    a.id,
    a.scheduled_at,
    p.id,
    p.full_name,
    p.phone,
    s.full_name,
    a.reason,
    a.reminder_called_at,
    a.reminder_outcome
  from appointments a
  join patients p on p.id = a.patient_id
  left join staff s on s.id = a.doctor_id, target
  where a.clinic_id = p_clinic_id
    and a.status = 'scheduled'
    and date(timezone('Africa/Douala', a.scheduled_at)) = target.d
  order by a.scheduled_at asc
$$;

-- ── Mark an appointment as called with an outcome ───────────────────────────
create or replace function mark_appointment_reminded(
  p_appointment_id uuid,
  p_called_by      uuid,
  p_outcome        text
)
returns void
language plpgsql
as $$
begin
  update appointments
  set reminder_called_at = now(),
      reminder_called_by = p_called_by,
      reminder_outcome   = p_outcome
  where id = p_appointment_id;

  -- If the patient cancelled during the reminder call, reflect it on the appointment
  if p_outcome = 'cancelled' then
    update appointments set status = 'cancelled', cancelled_reason = 'Annulé lors de l''appel de rappel'
    where id = p_appointment_id;
  end if;
end;
$$;
