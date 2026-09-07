-- ============================================================================
-- MIGRATION 170: ONBOARDING PHASE 2 — MODULE-SPECIFIC GUIDED TOURS
--
-- Phase 1 introduced the versioned onboarding framework.
-- Phase 2 uses the same model to add contextual, role-aware tours that open
-- in the module the staff member is currently using.
--
-- No schema changes are required: onboarding_steps.target_route,
-- target_selector and metadata were deliberately reserved for this phase.
-- ============================================================================

-- Helper: keep inserts idempotent when migrations are re-run.

insert into public.onboarding_tours (
  tour_key, version, title_en, title_fr, description_en, description_fr, phase, is_active
) values
  ('module_dashboard', 1, 'Dashboard tour', 'Visite du tableau de bord', 'Learn how to read the dashboard and find the next task.', 'Apprenez à lire le tableau de bord et à trouver la prochaine tâche.', 2, true),
  ('module_reception', 1, 'Reception tour', 'Visite de la Réception', 'Learn how Reception starts, tracks and redirects a patient journey.', 'Apprenez comment la Réception démarre, suit et oriente le parcours du patient.', 2, true),
  ('module_doctor', 1, 'Doctor tour', 'Visite du module Médecin', 'Learn what to do during consultation and what happens when you finish.', 'Apprenez quoi faire pendant la consultation et ce qui se passe lorsque vous terminez.', 2, true),
  ('module_laboratory', 1, 'Laboratory tour', 'Visite du Laboratoire', 'Learn which investigations belong in the active laboratory queue.', 'Apprenez quels examens doivent apparaître dans la file active du laboratoire.', 2, true),
  ('module_pharmacy', 1, 'Pharmacy tour', 'Visite de la Pharmacie', 'Learn the review, payment and dispensing workflow.', 'Apprenez le circuit de validation, paiement et délivrance.', 2, true),
  ('module_billing', 1, 'Billing tour', 'Visite de la Facturation', 'Learn how charges, payments and outstanding balances work.', 'Apprenez comment fonctionnent les charges, paiements et soldes restants.', 2, true),
  ('module_patients', 1, 'Patient profile tour', 'Visite du dossier patient', 'Learn where to find the patient record and active encounter.', 'Apprenez où trouver le dossier patient et le parcours actif.', 2, true)
on conflict (tour_key, version) do update set
  title_en = excluded.title_en,
  title_fr = excluded.title_fr,
  description_en = excluded.description_en,
  description_fr = excluded.description_fr,
  phase = excluded.phase,
  is_active = excluded.is_active;

with tours as (
  select id, tour_key
  from public.onboarding_tours
  where version = 1
    and tour_key in (
      'module_dashboard','module_reception','module_doctor','module_laboratory',
      'module_pharmacy','module_billing','module_patients'
    )
),
steps as (
  select * from (values
    ('module_dashboard', 'location', 1, array[]::text[], 'You are here', 'Vous êtes ici', 'The highlighted navigation item shows the module you are currently using. The dashboard gives you the broadest view of active work.', 'Le module de navigation mis en évidence indique où vous travaillez. Le tableau de bord donne la vue la plus globale des activités en cours.', 'Show dashboard', 'Voir le tableau de bord', '/dashboard', '.nav-link[href="/dashboard"]'),
    ('module_dashboard', 'next_task', 2, array[]::text[], 'Look for the next operational task', 'Cherchez la prochaine tâche opérationnelle', 'Use the dashboard to identify patients or work that still needs attention. Then open the relevant module instead of guessing where the patient is.', 'Utilisez le tableau de bord pour identifier les patients ou les tâches qui nécessitent encore une action. Ouvrez ensuite le module concerné au lieu de deviner où se trouve le patient.', 'Go to dashboard', 'Aller au tableau de bord', '/dashboard', 'main h1'),
    ('module_dashboard', 'help', 3, array[]::text[], 'You can reopen training anytime', 'Vous pouvez rouvrir la formation à tout moment', 'Use the ? button at the bottom-right whenever you need a refresher. Turning off automatic opening does not remove the guide.', 'Utilisez le bouton ? en bas à droite lorsque vous avez besoin d’une révision. Désactiver l’ouverture automatique ne supprime pas le guide.', null, null, null, null),

    ('module_reception', 'search', 1, array['admin','receptionist','doctor','nurse']::text[], 'Reception is the starting point', 'La Réception est le point de départ', 'Find or register the patient, then open the active encounter. If an encounter already exists, continue it rather than creating a duplicate.', 'Recherchez ou enregistrez le patient, puis ouvrez le parcours actif. Si un parcours existe déjà, continuez-le au lieu d’en créer un deuxième.', 'Open Reception', 'Ouvrir la Réception', '/reception', '.nav-link[href="/reception"]'),
    ('module_reception', 'tabs', 2, array['admin','receptionist','doctor','nurse']::text[], 'Use the Reception tabs for the right task', 'Utilisez les onglets de Réception pour la bonne tâche', 'Queue, appointments and direct laboratory/imaging actions are separate workflows. Stay in the tab that matches the action you need to perform.', 'La file, les rendez-vous et les actions directes de laboratoire/imagerie sont des workflows distincts. Restez dans l’onglet correspondant à l’action à effectuer.', 'Show Reception', 'Voir la Réception', '/reception', '.reception-tabs, main h1'),
    ('module_reception', 'journey', 3, array['admin','receptionist','doctor','nurse']::text[], 'Patient Journey answers “where is this patient?”', 'Le Parcours patient répond à « où est ce patient ? »', 'Before booking another appointment or creating another encounter, check the current journey. It tells you the current location, current action and what remains to be done.', 'Avant de créer un autre rendez-vous ou parcours, vérifiez le parcours actuel. Il indique la localisation, l’action en cours et ce qu’il reste à faire.', null, null, null, null),

    ('module_doctor', 'queue', 1, array['admin','doctor']::text[], 'Start from the doctor queue', 'Commencez par la file du médecin', 'Open the patient from the consultation queue and confirm you are working on the correct active encounter.', 'Ouvrez le patient depuis la file de consultation et vérifiez que vous travaillez sur le bon parcours actif.', 'Open Doctor', 'Ouvrir le module Médecin', '/doctor', '.nav-link[href="/doctor"]'),
    ('module_doctor', 'orders', 2, array['admin','doctor']::text[], 'Order services deliberately', 'Prescrivez les services avec précision', 'Laboratory investigations, prescriptions and other services are recorded during the encounter. Ordering something does not automatically mean it has been paid for or performed.', 'Les examens de laboratoire, prescriptions et autres services sont enregistrés pendant le parcours. Prescrire ne signifie pas automatiquement que le service est payé ou réalisé.', 'Show Doctor', 'Voir le module Médecin', '/doctor', 'main h1'),
    ('module_doctor', 'finish', 3, array['admin','doctor']::text[], 'When you finish, the patient moves forward', 'Lorsque vous terminez, le patient avance', 'Finish the consultation only after your clinical work is complete. TotalCare OS then uses the encounter work to determine the next operational stage, such as Laboratory, Pharmacy or Billing.', 'Terminez la consultation uniquement lorsque votre travail clinique est terminé. TotalCare OS utilise ensuite les tâches du parcours pour déterminer l’étape suivante : Laboratoire, Pharmacie ou Facturation.', null, null, null, null),

    ('module_laboratory', 'queue', 1, array['admin','lab_technician']::text[], 'The active queue contains actionable tests', 'La file active contient les examens réalisables', 'Only investigations that are paid or explicitly authorized should enter the active laboratory workflow. Deferred or awaiting-payment items stay out of the work queue.', 'Seuls les examens payés ou explicitement autorisés doivent entrer dans le workflow actif du laboratoire. Les examens différés ou en attente de paiement restent hors de la file de travail.', 'Open Laboratory', 'Ouvrir le Laboratoire', '/laboratory', '.nav-link[href="/laboratory"]'),
    ('module_laboratory', 'workflow', 2, array['admin','lab_technician']::text[], 'Follow the investigation state', 'Suivez l’état de l’examen', 'Collect the sample, process the investigation and enter/verify the result according to the current state. Do not perform an item that is still awaiting authorization or payment.', 'Prélevez, réalisez l’examen et saisissez/vérifiez le résultat selon l’état actuel. Ne réalisez pas un examen qui attend encore une autorisation ou un paiement.', 'Show Laboratory', 'Voir le Laboratoire', '/laboratory', 'main h1'),
    ('module_laboratory', 'completion', 3, array['admin','lab_technician']::text[], 'Completion sends the journey forward', 'La fin de l’examen fait avancer le parcours', 'Once the required laboratory work is completed, the encounter resolver can direct the patient back to the doctor or onward to another operational stage.', 'Lorsque les examens nécessaires sont terminés, le résolveur du parcours peut renvoyer le patient au médecin ou l’orienter vers l’étape opérationnelle suivante.', null, null, null, null),

    ('module_pharmacy', 'queue', 1, array['admin','pharmacist']::text[], 'Start from the pharmacy queue', 'Commencez par la file de Pharmacie', 'Open the active prescription and check the patient and encounter before dispensing.', 'Ouvrez la prescription active et vérifiez le patient et le parcours avant de délivrer.', 'Open Pharmacy', 'Ouvrir la Pharmacie', '/pharmacy', '.nav-link[href="/pharmacy"]'),
    ('module_pharmacy', 'review', 2, array['admin','pharmacist']::text[], 'Review comes before dispensing', 'La validation précède la délivrance', 'If a prescription requires review, complete that review first. A prescription can exist without yet being ready for dispensing.', 'Si une prescription nécessite une validation, effectuez-la d’abord. Une prescription peut exister sans être encore prête à être délivrée.', 'Show Pharmacy', 'Voir la Pharmacie', '/pharmacy', 'main h1'),
    ('module_pharmacy', 'payment', 3, array['admin','pharmacist']::text[], 'Check payment and stock before dispensing', 'Vérifiez le paiement et le stock avant la délivrance', 'The patient journey distinguishes review, payment and dispensing. If payment is required or stock is insufficient, the system should tell you what blocks the action.', 'Le parcours patient distingue validation, paiement et délivrance. Si un paiement est requis ou si le stock est insuffisant, le système doit indiquer ce qui bloque l’action.', null, null, null, null),

    ('module_billing', 'queue', 1, array['admin','receptionist','billing_clerk']::text[], 'Billing shows what still needs payment', 'La Facturation montre ce qui reste à payer', 'Use the billing queue to find outstanding charges. A service being ordered or authorized is not the same as it being paid.', 'Utilisez la file de facturation pour trouver les charges restantes. Un service prescrit ou autorisé n’est pas forcément payé.', 'Open Billing', 'Ouvrir la Facturation', '/billing', '.nav-link[href="/billing"]'),
    ('module_billing', 'payments', 2, array['admin','receptionist','billing_clerk']::text[], 'Record the actual payment', 'Enregistrez le paiement réel', 'Select the correct patient/encounter and record the amount actually collected. Avoid creating a second charge for an existing service.', 'Sélectionnez le bon patient/parcours et enregistrez le montant réellement encaissé. Évitez de créer une deuxième charge pour un service déjà enregistré.', 'Show Billing', 'Voir la Facturation', '/billing', 'main h1'),
    ('module_billing', 'balance', 3, array['admin','receptionist','billing_clerk']::text[], 'Outstanding balance follows the patient', 'Le solde restant suit le patient', 'An unpaid balance can still matter at a later consultation or follow-up. Check the patient journey and ledger before assuming the account is settled.', 'Un solde impayé peut rester important lors d’une consultation ou d’un suivi ultérieur. Vérifiez le parcours patient et le compte avant de considérer le dossier comme soldé.', null, null, null, null),

    ('module_patients', 'record', 1, array['admin','doctor','nurse','receptionist']::text[], 'Open the patient record', 'Ouvrez le dossier patient', 'The patient record is the clinical identity anchor. Confirm the patient before working on an encounter.', 'Le dossier patient est le point d’ancrage de l’identité clinique. Vérifiez le patient avant de travailler sur un parcours.', 'Open Patients', 'Ouvrir les Patients', '/patients', '.nav-link[href="/patients"]'),
    ('module_patients', 'encounter', 2, array['admin','doctor','nurse','receptionist']::text[], 'Use the active encounter, not a duplicate', 'Utilisez le parcours actif, pas un doublon', 'If the patient already has an active encounter, continue that encounter. The system is designed to prevent multiple active journeys for the same patient.', 'Si le patient a déjà un parcours actif, continuez ce parcours. Le système est conçu pour empêcher plusieurs parcours actifs pour le même patient.', 'Show patient record', 'Voir le dossier patient', '/patients', 'main h1'),
    ('module_patients', 'history', 3, array['admin','doctor','nurse','receptionist']::text[], 'Use history to understand context', 'Utilisez l’historique pour comprendre le contexte', 'Review previous encounters, results and documented actions when you need context. For “where is the patient now?”, use Patient Journey.', 'Consultez les parcours précédents, résultats et actions documentées lorsque vous avez besoin de contexte. Pour savoir « où est le patient maintenant ? », utilisez le Parcours patient.', null, null, null, null)
  ) as x(tour_key, step_key, step_order, roles, title_en, title_fr, body_en, body_fr, action_en, action_fr, target_route, target_selector)
)
insert into public.onboarding_steps (
  tour_id, step_key, step_order, phase, roles,
  title_en, title_fr, body_en, body_fr,
  action_en, action_fr, target_route, target_selector, metadata
)
select
  t.id, s.step_key, s.step_order, 2, s.roles,
  s.title_en, s.title_fr, s.body_en, s.body_fr,
  s.action_en, s.action_fr, s.target_route, s.target_selector,
  jsonb_build_object('mode','spotlight','module_tour',true,'allow_interaction',true)
from steps s
join tours t on t.tour_key = s.tour_key
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
  target_selector = excluded.target_selector,
  metadata = excluded.metadata;

comment on table public.onboarding_steps is
'Ordered, bilingual, role-aware onboarding content. Phase 2 uses target_route, target_selector and metadata.mode=spotlight for contextual module tours.';
