-- ============================================================================
-- MIGRATION 167: EXTENSIBLE ONBOARDING FRAMEWORK — PHASE 1
--
-- The onboarding model is deliberately data-driven so later phases can add:
--   * role-specific training
--   * module-specific guided tours
--   * contextual help / checklists
--   * completion analytics and refresher lessons
-- without changing the staff progress model.
--
-- Phase 1 ships one core bilingual tour. The application may render it as a
-- modal/wizard today; target_route and target_selector are already available
-- for future contextual/spotlight tours.
-- ============================================================================

create table if not exists public.onboarding_tours (
  id uuid primary key default gen_random_uuid(),
  tour_key text not null,
  version integer not null default 1 check (version > 0),
  title_en text not null,
  title_fr text not null,
  description_en text,
  description_fr text,
  phase integer not null default 1 check (phase > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tour_key, version)
);

create table if not exists public.onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.onboarding_tours(id) on delete cascade,
  step_key text not null,
  step_order integer not null check (step_order > 0),
  phase integer not null default 1 check (phase > 0),
  roles text[] not null default array[]::text[],
  title_en text not null,
  title_fr text not null,
  body_en text not null,
  body_fr text not null,
  action_en text,
  action_fr text,
  target_route text,
  target_selector text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tour_id, step_key),
  unique (tour_id, step_order)
);

create table if not exists public.staff_onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  tour_id uuid not null references public.onboarding_tours(id) on delete cascade,
  tour_version integer not null check (tour_version > 0),
  enabled boolean not null default true,
  completed boolean not null default false,
  current_step integer not null default 1 check (current_step > 0),
  started_at timestamptz,
  last_seen_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, tour_id, tour_version)
);

create index if not exists idx_onboarding_tours_active
  on public.onboarding_tours(is_active, phase, tour_key, version desc);

create index if not exists idx_onboarding_steps_tour_order
  on public.onboarding_steps(tour_id, step_order);

create index if not exists idx_staff_onboarding_progress_staff
  on public.staff_onboarding_progress(staff_id, enabled, completed);

create index if not exists idx_staff_onboarding_progress_clinic
  on public.staff_onboarding_progress(clinic_id, tour_id);

-- Reuse the application's existing updated_at helper when present.
create or replace function public.touch_onboarding_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_onboarding_tours_updated_at on public.onboarding_tours;
create trigger trg_onboarding_tours_updated_at
before update on public.onboarding_tours
for each row execute function public.touch_onboarding_updated_at();

drop trigger if exists trg_onboarding_steps_updated_at on public.onboarding_steps;
create trigger trg_onboarding_steps_updated_at
before update on public.onboarding_steps
for each row execute function public.touch_onboarding_updated_at();

drop trigger if exists trg_staff_onboarding_progress_updated_at on public.staff_onboarding_progress;
create trigger trg_staff_onboarding_progress_updated_at
before update on public.staff_onboarding_progress
for each row execute function public.touch_onboarding_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.onboarding_tours enable row level security;
alter table public.onboarding_steps enable row level security;
alter table public.staff_onboarding_progress enable row level security;

drop policy if exists onboarding_tours_select on public.onboarding_tours;
create policy onboarding_tours_select
  on public.onboarding_tours
  for select
  to authenticated
  using (is_active = true);

drop policy if exists onboarding_steps_select on public.onboarding_steps;
create policy onboarding_steps_select
  on public.onboarding_steps
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.onboarding_tours t
      where t.id = onboarding_steps.tour_id
        and t.is_active = true
    )
  );

drop policy if exists staff_onboarding_progress_select on public.staff_onboarding_progress;
create policy staff_onboarding_progress_select
  on public.staff_onboarding_progress
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.staff s
      where s.id = staff_onboarding_progress.staff_id
        and s.auth_user_id = auth.uid()
        and s.clinic_id = staff_onboarding_progress.clinic_id
        and s.is_active = true
    )
  );

drop policy if exists staff_onboarding_progress_insert on public.staff_onboarding_progress;
create policy staff_onboarding_progress_insert
  on public.staff_onboarding_progress
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.staff s
      where s.id = staff_onboarding_progress.staff_id
        and s.auth_user_id = auth.uid()
        and s.clinic_id = staff_onboarding_progress.clinic_id
        and s.is_active = true
    )
  );

drop policy if exists staff_onboarding_progress_update on public.staff_onboarding_progress;
create policy staff_onboarding_progress_update
  on public.staff_onboarding_progress
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.staff s
      where s.id = staff_onboarding_progress.staff_id
        and s.auth_user_id = auth.uid()
        and s.clinic_id = staff_onboarding_progress.clinic_id
        and s.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.staff s
      where s.id = staff_onboarding_progress.staff_id
        and s.auth_user_id = auth.uid()
        and s.clinic_id = staff_onboarding_progress.clinic_id
        and s.is_active = true
    )
  );

grant select on public.onboarding_tours, public.onboarding_steps to authenticated;
grant select, insert, update on public.staff_onboarding_progress to authenticated;

-- ---------------------------------------------------------------------------
-- PHASE 1: CORE TOUR CONTENT
-- ---------------------------------------------------------------------------
insert into public.onboarding_tours (
  tour_key, version, title_en, title_fr, description_en, description_fr, phase, is_active
) values (
  'core_workflow', 1,
  'Welcome to TotalCare OS', 'Bienvenue dans TotalCare OS',
  'A short tour of the patient workflow and the modules you use every day.',
  'Une courte visite du parcours patient et des modules utilisés chaque jour.',
  1, true
)
on conflict (tour_key, version) do update set
  title_en = excluded.title_en,
  title_fr = excluded.title_fr,
  description_en = excluded.description_en,
  description_fr = excluded.description_fr,
  phase = excluded.phase,
  is_active = excluded.is_active;

with tour as (
  select id
  from public.onboarding_tours
  where tour_key = 'core_workflow' and version = 1
)
insert into public.onboarding_steps (
  tour_id, step_key, step_order, phase, roles,
  title_en, title_fr, body_en, body_fr,
  action_en, action_fr, target_route, target_selector, metadata
)
select
  tour.id,
  s.step_key,
  s.step_order,
  1,
  s.roles,
  s.title_en,
  s.title_fr,
  s.body_en,
  s.body_fr,
  s.action_en,
  s.action_fr,
  s.target_route,
  s.target_selector,
  '{}'::jsonb
from tour
cross join (values
  (
    'welcome', 1, array[]::text[],
    'Your patient journey, one step at a time',
    'Le parcours de votre patient, étape par étape',
    'TotalCare OS connects Reception, Doctor, Laboratory, Pharmacy, Billing and Appointments around one patient encounter. This guide shows you where each action belongs.',
    'TotalCare OS relie la Réception, le Médecin, le Laboratoire, la Pharmacie, la Facturation et les Rendez-vous autour d’un même parcours patient. Ce guide vous montre où effectuer chaque action.',
    'Start tour', 'Commencer', null::text, null::text
  ),
  (
    'navigation', 2, array[]::text[],
    'Use the navigation to move between modules',
    'Utilisez la navigation pour passer d’un module à l’autre',
    'The left menu contains the modules available to your role. The active module is highlighted. On mobile, use the bottom navigation.',
    'Le menu de gauche contient les modules disponibles pour votre rôle. Le module actif est mis en évidence. Sur mobile, utilisez la navigation du bas.',
    'Open Dashboard', 'Ouvrir le tableau de bord', '/dashboard', '.nav-link[data-active="true"]'
  ),
  (
    'reception', 3, array['admin','receptionist','doctor','nurse']::text[],
    'Reception starts and tracks the patient journey',
    'La Réception démarre et suit le parcours du patient',
    'Register or find the patient, open the encounter, and use Patient Journey to see where the patient is now. Do not create a second encounter when an active one already exists.',
    'Enregistrez ou recherchez le patient, ouvrez le dossier de consultation et utilisez le Parcours patient pour voir où se trouve le patient. Ne créez pas un deuxième parcours lorsqu’un parcours est déjà actif.',
    'Open Reception', 'Ouvrir la Réception', '/reception', null::text
  ),
  (
    'doctor', 4, array['admin','doctor']::text[],
    'Doctor: finish the consultation and send the patient forward',
    'Médecin : terminer la consultation et orienter le patient',
    'During consultation, order the needed services. When you finish, TotalCare OS determines the next operational stage — for example Laboratory, Pharmacy or Billing.',
    'Pendant la consultation, prescrivez les examens et services nécessaires. Lorsque vous terminez, TotalCare OS détermine l’étape opérationnelle suivante — par exemple Laboratoire, Pharmacie ou Facturation.',
    'Open Doctor', 'Ouvrir le module Médecin', '/doctor', null::text
  ),
  (
    'laboratory', 5, array['admin','lab_technician']::text[],
    'Laboratory works only on authorized or paid tests',
    'Le Laboratoire ne travaille que sur les examens autorisés ou payés',
    'A test may be ordered without being ready for the lab. Paid or authorized investigations become active work; deferred or unpaid investigations remain out of the active queue until activated.',
    'Un examen peut être prescrit sans être immédiatement disponible au laboratoire. Les examens payés ou autorisés deviennent des tâches actives ; les examens différés ou non payés restent hors de la file jusqu’à leur activation.',
    'Open Laboratory', 'Ouvrir le Laboratoire', '/laboratory', null::text
  ),
  (
    'pharmacy', 6, array['admin','pharmacist']::text[],
    'Pharmacy: review, payment and dispensing',
    'Pharmacie : validation, paiement et délivrance',
    'Pharmacy work can be waiting for review, payment or dispensing. The patient journey shows the exact current action so you know what must happen next.',
    'La Pharmacie peut être en attente de validation, de paiement ou de délivrance. Le parcours patient affiche l’action exacte à effectuer ensuite.',
    'Open Pharmacy', 'Ouvrir la Pharmacie', '/pharmacy', null::text
  ),
  (
    'billing', 7, array['admin','receptionist','billing_clerk']::text[],
    'Billing tells you what is still owed',
    'La Facturation indique ce qui reste à payer',
    'Ordering a service, authorizing it and paying for it are different events. Billing keeps the outstanding balance visible and records the actual payment.',
    'Prescrire un service, l’autoriser et le payer sont trois événements différents. La Facturation garde le solde restant visible et enregistre le paiement réel.',
    'Open Billing', 'Ouvrir la Facturation', '/billing', null::text
  ),
  (
    'journey', 8, array[]::text[],
    'Patient Journey is your “where is this patient?” tool',
    'Le Parcours patient répond à « où se trouve ce patient ? »',
    'Search a patient by name or code to see the current location, current action, outstanding balance and the next stage. This is the fastest way to understand what is blocking the encounter.',
    'Recherchez un patient par nom ou par code pour voir sa localisation actuelle, l’action en cours, le solde restant et l’étape suivante. C’est le moyen le plus rapide de comprendre ce qui bloque le parcours.',
    'Find a patient', 'Rechercher un patient', null::text, null::text
  )
) as s(
  step_key, step_order, roles,
  title_en, title_fr, body_en, body_fr,
  action_en, action_fr, target_route, target_selector
)
on conflict (tour_id, step_key) do update set
  step_order = excluded.step_order,
  phase = excluded.phase,
  roles = excluded.roles,
  title_en = excluded.title_en,
  title_fr = excluded.title_fr,
  body_en = excluded.body_en,
  body_fr = excluded.body_fr,
  action_en = excluded.action_en,
  action_fr = excluded.action_fr,
  target_route = excluded.target_route,
  target_selector = excluded.target_selector;

comment on table public.onboarding_tours is
'Versioned onboarding tour definitions. Future phases can add role/module/contextual tours without changing staff progress.';

comment on table public.onboarding_steps is
'Ordered, bilingual, role-aware onboarding content. target_route/target_selector support future contextual spotlight tours.';

comment on table public.staff_onboarding_progress is
'Per-staff progress and enable/disable state for each versioned onboarding tour.';
