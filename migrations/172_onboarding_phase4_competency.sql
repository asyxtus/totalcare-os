-- ============================================================================
-- MIGRATION 172: ONBOARDING PHASE 4 — COMPETENCY / ASSESSMENT
--
-- Phase 4 extends onboarding into Learn -> Practice -> Perform -> Verify.
-- Training data is isolated from production clinical, billing, inventory,
-- laboratory, and dispensing records.
-- ============================================================================

create table if not exists public.training_scenarios (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null unique,
  phase integer not null default 4 check (phase = 4),
  title_en text not null,
  title_fr text not null,
  description_en text not null,
  description_fr text not null,
  roles text[] not null default array[]::text[],
  module_key text,
  difficulty text not null default 'beginner' check (difficulty in ('beginner','intermediate','advanced')),
  passing_score integer not null default 80 check (passing_score between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_scenario_steps (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.training_scenarios(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  prompt_en text not null,
  prompt_fr text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option text not null,
  explanation_en text not null,
  explanation_fr text not null,
  points integer not null default 20 check (points > 0),
  unique (scenario_id, step_order)
);

create table if not exists public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  scenario_id uuid not null references public.training_scenarios(id) on delete cascade,
  score integer not null default 0 check (score between 0 and 100),
  passed boolean not null default false,
  answers jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_training_scenarios_active on public.training_scenarios(is_active, module_key, difficulty);
create index if not exists idx_training_steps_scenario on public.training_scenario_steps(scenario_id, step_order);
create index if not exists idx_training_attempts_staff on public.training_attempts(staff_id, scenario_id, completed_at desc);

create or replace function public.touch_training_scenario_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_training_scenarios_updated_at on public.training_scenarios;
create trigger trg_training_scenarios_updated_at
before update on public.training_scenarios
for each row execute function public.touch_training_scenario_updated_at();

alter table public.training_scenarios enable row level security;
alter table public.training_scenario_steps enable row level security;
alter table public.training_attempts enable row level security;

drop policy if exists training_scenarios_select on public.training_scenarios;
create policy training_scenarios_select on public.training_scenarios
for select to authenticated using (is_active = true);

drop policy if exists training_steps_select on public.training_scenario_steps;
create policy training_steps_select on public.training_scenario_steps
for select to authenticated using (exists (select 1 from public.training_scenarios s where s.id = scenario_id and s.is_active = true));

drop policy if exists training_attempts_select on public.training_attempts;
create policy training_attempts_select on public.training_attempts
for select to authenticated using (exists (select 1 from public.staff s where s.id = training_attempts.staff_id and s.auth_user_id = auth.uid() and s.clinic_id = training_attempts.clinic_id and s.is_active = true));

drop policy if exists training_attempts_insert on public.training_attempts;
create policy training_attempts_insert on public.training_attempts
for insert to authenticated with check (exists (select 1 from public.staff s where s.id = training_attempts.staff_id and s.auth_user_id = auth.uid() and s.clinic_id = training_attempts.clinic_id and s.is_active = true));

grant select on public.training_scenarios, public.training_scenario_steps to authenticated;
grant select, insert on public.training_attempts to authenticated;

insert into public.training_scenarios
(scenario_key,title_en,title_fr,description_en,description_fr,roles,module_key,difficulty,passing_score)
values
('reception_affordable_labs','A patient cannot pay for every laboratory test','Le patient ne peut pas payer tous les examens','Practice the correct deferred-payment workflow without creating duplicate orders or charges.','Pratiquez le bon parcours de paiement différé sans créer de doublons de commandes ou de factures.',array['receptionist','admin'],'reception','beginner',80),
('doctor_lab_payment_modes','Choose the correct laboratory payment mode','Choisir le bon mode de paiement du laboratoire','Decide what happens to laboratory investigations after a doctor orders them.','Décidez de ce qui arrive aux examens après leur prescription par le médecin.',array['doctor','admin'],'doctor','beginner',80),
('laboratory_authorized_work','Work only on authorized laboratory investigations','Travailler uniquement sur les examens autorisés','Practice distinguishing deferred, unpaid, authorized, and completed laboratory work.','Apprenez à distinguer les examens différés, impayés, autorisés et terminés.',array['lab_technician','admin'],'laboratory','intermediate',80),
('pharmacy_safe_dispensing','Complete a safe pharmacy workflow','Effectuer correctement le parcours pharmacie','Practice review, payment, stock validation, and dispensing without creating a second charge.','Pratiquez la validation, le paiement, le stock et la délivrance sans créer une seconde facturation.',array['pharmacist','admin'],'pharmacy','intermediate',80),
('billing_followup_balance','Resolve an outstanding balance','Régulariser un solde impayé','Practice recognizing outstanding charges and confirming the account is settled.','Apprenez à reconnaître les impayés et à confirmer que le compte est régularisé.',array['billing_clerk','receptionist','admin'],'billing','beginner',80)
on conflict (scenario_key) do update set
 title_en=excluded.title_en,title_fr=excluded.title_fr,description_en=excluded.description_en,description_fr=excluded.description_fr,
 roles=excluded.roles,module_key=excluded.module_key,difficulty=excluded.difficulty,passing_score=excluded.passing_score,is_active=true;

-- Every step explicitly includes the points target column. This prevents the
-- INSERT-has-more-expressions-than-target-columns error when rerunning 172.
with s as (select id from public.training_scenarios where scenario_key='reception_affordable_labs')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,1,'The doctor ordered 3 tests. The patient can afford only 1 today. What should Reception do?','Le médecin a prescrit 3 examens. Le patient ne peut en payer qu’un aujourd’hui. Que doit faire la Réception?','[{"id":"pay_one","en":"Select the affordable test and Pay selected","fr":"Sélectionner l’examen abordable et Encaisser la sélection"},{"id":"pay_all","en":"Require payment for all three","fr":"Exiger le paiement des trois"},{"id":"delete_two","en":"Delete the other two orders","fr":"Supprimer les deux autres commandes"}]'::jsonb,'pay_one','Only the selected investigation should become paid/available. The remaining orders stay deferred.','Seul l’examen sélectionné doit devenir payé/disponible. Les autres restent différés.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='reception_affordable_labs')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,2,'What should happen to the two tests the patient did not select?','Que doit-il arriver aux deux examens non sélectionnés?','[{"id":"defer","en":"Remain deferred for later activation","fr":"Rester différés pour une activation ultérieure"},{"id":"cancel","en":"Be cancelled and reordered later","fr":"Être annulés puis prescrits à nouveau"},{"id":"lab","en":"Appear in the active laboratory queue","fr":"Apparaître dans la file active du laboratoire"}]'::jsonb,'defer','Deferred tests remain part of the original order and can later be activated without duplicate orders.','Les examens différés restent dans la commande initiale et peuvent être activés plus tard sans doublon.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='reception_affordable_labs')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,3,'When can the deferred test reach the laboratory?','Quand l’examen différé peut-il arriver au laboratoire?','[{"id":"activate_pay","en":"After it is activated and financially authorized/paid as required","fr":"Après activation et autorisation/paiement selon le cas"},{"id":"immediate","en":"Immediately after the original consultation","fr":"Immédiatement après la consultation"},{"id":"new_order","en":"Only after creating a new order","fr":"Uniquement après une nouvelle commande"}]'::jsonb,'activate_pay','Activation changes the financial state; it should not create a duplicate clinical order.','L’activation modifie l’état financier; elle ne doit pas créer une nouvelle commande clinique.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='doctor_lab_payment_modes')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,1,'Which mode sends an authorized emergency investigation to the lab without waiting for payment?','Quel mode permet à un examen d’urgence autorisé d’arriver au laboratoire sans attendre le paiement?','[{"id":"charge","en":"Charge to encounter","fr":"Facturer sur l’encounter"},{"id":"defer","en":"Defer","fr":"Différer"},{"id":"pay","en":"Pay now only","fr":"Payer maintenant uniquement"}]'::jsonb,'charge','Charge to encounter authorizes the work while the amount remains on the encounter balance.','La facturation sur l’encounter autorise l’examen tandis que le montant reste sur le solde.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='doctor_lab_payment_modes')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,2,'What does Defer mean?','Que signifie Différer?','[{"id":"later","en":"Keep the order for possible later activation; do not send it to the active lab queue","fr":"Conserver la commande pour une activation ultérieure; ne pas l’envoyer dans la file active"},{"id":"delete","en":"Delete the investigation","fr":"Supprimer l’examen"},{"id":"paid","en":"Treat it as already paid","fr":"Le considérer comme déjà payé"}]'::jsonb,'later','Deferred is a valid state, not a deleted order or a payment.','Différé est un état valide, pas une suppression ni un paiement.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='doctor_lab_payment_modes')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,3,'Does ordering alone create a second charge when the lab performs the test?','La prescription seule crée-t-elle une seconde facturation lorsque le laboratoire réalise l’examen?','[{"id":"no","en":"No","fr":"Non"},{"id":"yes","en":"Yes","fr":"Oui"}]'::jsonb,'no','Ordering and performing are separate workflow events; performing should not duplicate the charge.','La prescription et la réalisation sont des événements distincts; la réalisation ne doit pas dupliquer la facturation.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='laboratory_authorized_work')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,1,'Which investigation belongs in the active lab work queue?','Quel examen appartient à la file active du laboratoire?','[{"id":"paid","en":"Paid","fr":"Payé"},{"id":"deferred","en":"Deferred","fr":"Différé"},{"id":"unpaid","en":"Unpaid and not authorized","fr":"Impayé et non autorisé"}]'::jsonb,'paid','Paid investigations are authorized for work.','Les examens payés sont autorisés pour réalisation.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='laboratory_authorized_work')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,2,'An emergency test is charged to the encounter. Can the lab perform it before payment?','Un examen d’urgence est facturé sur l’encounter. Le laboratoire peut-il le réaliser avant paiement?','[{"id":"yes","en":"Yes, if authorized","fr":"Oui, s’il est autorisé"},{"id":"no","en":"No, never","fr":"Non, jamais"}]'::jsonb,'yes','Authorization and payment are distinct. Emergency authorized work can proceed and accumulate on the encounter balance.','L’autorisation et le paiement sont distincts. Un examen d’urgence autorisé peut être réalisé et ajouté au solde.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='laboratory_authorized_work')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,3,'Should a deferred investigation appear in the active queue?','Un examen différé doit-il apparaître dans la file active?','[{"id":"no","en":"No","fr":"Non"},{"id":"yes","en":"Yes","fr":"Oui"}]'::jsonb,'no','Deferred work stays out of the active laboratory queue until activated and authorized.','Un examen différé reste hors de la file active jusqu’à son activation et son autorisation.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='pharmacy_safe_dispensing')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,1,'A prescription requires pharmacist review. What comes first?','Une ordonnance nécessite une validation pharmaceutique. Que faire en premier?','[{"id":"review","en":"Review/validate the prescription","fr":"Valider l’ordonnance"},{"id":"dispense","en":"Dispense immediately","fr":"Délivrer immédiatement"},{"id":"charge","en":"Create another charge","fr":"Créer une autre facture"}]'::jsonb,'review','A prescription awaiting review is not ready for dispensing.','Une ordonnance en attente de validation n’est pas prête à être délivrée.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='pharmacy_safe_dispensing')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,2,'The patient has paid and the prescription is ready, but sellable stock is zero. What should happen?','Le patient a payé et l’ordonnance est prête, mais le stock vendable est à zéro. Que faire?','[{"id":"stop","en":"Do not dispense; explain the stock shortage","fr":"Ne pas délivrer; expliquer l’insuffisance de stock"},{"id":"negative","en":"Dispense negative stock","fr":"Délivrer malgré le stock négatif"},{"id":"charge","en":"Charge the patient again","fr":"Facturer à nouveau le patient"}]'::jsonb,'stop','Payment does not override stock validation.','Le paiement ne remplace pas la vérification du stock.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='pharmacy_safe_dispensing')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,3,'After successful dispensing, should the pharmacist create another pharmacy charge?','Après une délivrance réussie, le pharmacien doit-il créer une autre facture pharmacie?','[{"id":"no","en":"No","fr":"Non"},{"id":"yes","en":"Yes","fr":"Oui"}]'::jsonb,'no','The dispensing action fulfills the existing prescription/charge; it must not double-bill the patient.','La délivrance exécute la prescription/facturation existante; elle ne doit pas facturer deux fois.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='billing_followup_balance')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,1,'A patient returns for a follow-up with an outstanding previous encounter balance. What should you do first?','Un patient revient pour un suivi avec un ancien solde impayé. Que faire en premier?','[{"id":"review","en":"Review and explain the outstanding balance","fr":"Vérifier et expliquer le solde impayé"},{"id":"hide","en":"Ignore it because this is a new visit","fr":"L’ignorer car c’est une nouvelle visite"},{"id":"duplicate","en":"Create the old charge again","fr":"Recréer l’ancienne facture"}]'::jsonb,'review','The outstanding balance remains visible across the patient/encounter financial history.','Le solde impayé reste visible dans l’historique financier du patient/de l’encounter.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='billing_followup_balance')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,2,'After the patient pays the full outstanding amount, what confirms resolution?','Après paiement intégral du solde, qu’est-ce qui confirme la régularisation?','[{"id":"zero","en":"Outstanding balance is 0 FCFA","fr":"Le solde impayé est de 0 FCFA"},{"id":"receipt","en":"A receipt exists even if balance remains","fr":"Un reçu existe même si le solde reste dû"},{"id":"new","en":"A new charge is created","fr":"Une nouvelle facture est créée"}]'::jsonb,'zero','The account is settled when the outstanding amount reaches zero.','Le compte est régularisé lorsque le montant impayé atteint zéro.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;

with s as (select id from public.training_scenarios where scenario_key='billing_followup_balance')
insert into public.training_scenario_steps(scenario_id,step_order,prompt_en,prompt_fr,options,correct_option,explanation_en,explanation_fr,points)
select s.id,3,'Should a new follow-up visit automatically erase an old outstanding balance?','Une nouvelle visite de suivi doit-elle automatiquement effacer un ancien solde impayé?','[{"id":"no","en":"No","fr":"Non"},{"id":"yes","en":"Yes","fr":"Oui"}]'::jsonb,'no','A new encounter does not erase historical financial obligations.','Une nouvelle rencontre n’efface pas les obligations financières antérieures.',20 from s
on conflict (scenario_id,step_order) do update set prompt_en=excluded.prompt_en,prompt_fr=excluded.prompt_fr,options=excluded.options,correct_option=excluded.correct_option,explanation_en=excluded.explanation_en,explanation_fr=excluded.explanation_fr,points=excluded.points;
