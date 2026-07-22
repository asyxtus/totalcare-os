-- ============================================================================
-- FOUNDATION PATCH: ESTIMATED AGE THAT ACTUALLY AGES
-- Problem: estimated_age was stored as a static number, frozen at whatever
-- was entered at registration. A patient estimated at 45 would still show
-- 45 two years later. Fix: record the DATE the estimate was made
-- alongside the number, so current age can always be calculated forward
-- from that point — the same way a real date_of_birth already works.
-- ============================================================================

alter table patients add column estimated_age_recorded_at date not null default current_date;

-- Existing rows (if any test data already has estimated_age set) get
-- today's date as their reference point — not perfectly accurate for
-- backdated records, but a reasonable one-time correction with no better
-- information available.
comment on column patients.estimated_age_recorded_at is
  'The date estimated_age was recorded. Current age = estimated_age + years elapsed since this date. Ignored when date_of_birth is set.';
