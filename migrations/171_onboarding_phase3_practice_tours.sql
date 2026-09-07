-- ============================================================================
-- MIGRATION 171: ONBOARDING PHASE 3 — SAFE WORKFLOW PRACTICE
--
-- Phase 3 reuses onboarding_tours/onboarding_steps/staff_onboarding_progress.
-- metadata.mode = practice identifies interactive, non-production exercises.
-- No patient, encounter, billing, laboratory or pharmacy records are changed.
-- ============================================================================

insert into public.onboarding_tours
  (tour_key, version, title_en, title_fr, description_en, description_fr, phase, is_active)
values
  ('practice_reception', 1, 'Reception practice', 'Exercice Réception', 'Practice the patient journey and laboratory payment workflow without changing real records.', 'Entraînez-vous au parcours patient et au paiement des examens sans modifier les dossiers réels.', 3, true),
  ('practice_doctor', 1, 'Doctor practice', 'Exercice Médecin', 'Practice ordering investigations and finishing a consultation safely.', 'Entraînez-vous à prescrire des examens et à terminer une consultation en toute sécurité.', 3, true),
  ('practice_laboratory', 1, 'Laboratory practice', 'Exercice Laboratoire', 'Practice processing an authorized investigation from queue to result.', 'Entraînez-vous à traiter un examen autorisé de la file au résultat.', 3, true),
  ('practice_pharmacy', 1, 'Pharmacy practice', 'Exercice Pharmacie', 'Practice review, payment and dispensing decisions without touching real stock.', 'Entraînez-vous à valider, vérifier le paiement et délivrer sans modifier le stock réel.', 3, true),
  ('practice_billing', 1, 'Billing practice', 'Exercice Facturation', 'Practice collecting an outstanding balance without creating a real payment.', 'Entraînez-vous à régler un solde restant sans enregistrer un paiement réel.', 3, true)
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
  where phase = 3 and version = 1
    and tour_key in ('practice_reception','practice_doctor','practice_laboratory','practice_pharmacy','practice_billing')
),
steps as (
  select * from (values
    ('practice_reception','find_patient',1,array['admin','receptionist','doctor','nurse']::text[],'Find the patient','Recherchez le patient','In this exercise, select the sample patient. Never use a real patient just to practice.','Dans cet exercice, sélectionnez le patient de démonstration. N’utilisez jamais un vrai patient pour vous entraîner.','Select sample patient','Sélectionner le patient exemple'),
    ('practice_reception','journey',2,array['admin','receptionist','doctor','nurse']::text[],'Check Patient Journey','Vérifiez le Parcours patient','Read the simulated journey before taking another action. The journey tells you the current location and next action.','Lisez le parcours simulé avant d’effectuer une nouvelle action. Le parcours indique la localisation actuelle et l’action suivante.','Check journey','Vérifier le parcours'),
    ('practice_reception','lab_payment',3,array['admin','receptionist','doctor','nurse']::text[],'Choose what the patient can pay','Choisissez ce que le patient peut payer','Select only the investigations the patient can afford. The remaining investigations automatically stay deferred in this simulation.','Sélectionnez uniquement les examens que le patient peut payer. Les autres restent automatiquement différés dans cette simulation.','Select payable tests','Sélectionner les examens payables'),
    ('practice_reception','confirm',4,array['admin','receptionist','doctor','nurse']::text[],'Confirm without duplicating orders','Confirmez sans créer de doublons','Paying selected investigations activates only those selected items. The original order remains one order; do not recreate the tests.','Le paiement des examens sélectionnés active uniquement ces examens. La prescription d’origine reste une seule prescription ; ne recréez pas les examens.','Confirm workflow','Confirmer le workflow'),

    ('practice_doctor','open',1,array['admin','doctor']::text[],'Open the sample encounter','Ouvrez le parcours exemple','Start with a simulated active encounter. This exercise never writes to the clinical database.','Commencez avec un parcours actif simulé. Cet exercice n’écrit jamais dans la base clinique.','Open sample encounter','Ouvrir le parcours exemple'),
    ('practice_doctor','order',2,array['admin','doctor']::text[],'Order the investigations','Prescrivez les examens','Add the three sample investigations. Ordering creates the clinical order in the simulation, not a real order.','Ajoutez les trois examens exemples. La prescription crée une commande dans la simulation, pas une commande réelle.','Order tests','Prescrire les examens'),
    ('practice_doctor','payment_mode',3,array['admin','doctor']::text[],'Choose the payment mode','Choisissez le mode de paiement','Practice the three choices: Pay now, Charge to encounter, or Defer. The simulation shows what each choice does next.','Entraînez-vous avec les trois choix : Payer maintenant, Facturer au parcours ou Différer. La simulation montre la conséquence de chaque choix.','Choose payment mode','Choisir le mode de paiement'),
    ('practice_doctor','finish',4,array['admin','doctor']::text[],'Finish the consultation','Terminez la consultation','When clinical work is complete, finish the consultation. The simulated journey then points to the next operational stage.','Lorsque le travail clinique est terminé, terminez la consultation. Le parcours simulé indique ensuite l’étape opérationnelle suivante.','Finish consultation','Terminer la consultation'),

    ('practice_laboratory','queue',1,array['admin','lab_technician']::text[],'Choose an authorized test','Choisissez un examen autorisé','Only the simulated paid/authorized investigation belongs in the active work queue.','Seul l’examen simulé payé/autorisé appartient à la file active.','Open authorized test','Ouvrir l’examen autorisé'),
    ('practice_laboratory','sample',2,array['admin','lab_technician']::text[],'Collect the sample','Prélevez l’échantillon','Move the sample through collection. A deferred or unpaid test cannot be processed in this exercise.','Faites passer l’échantillon à l’étape de prélèvement. Un examen différé ou non payé ne peut pas être traité dans cet exercice.','Collect sample','Prélever'),
    ('practice_laboratory','result',3,array['admin','lab_technician']::text[],'Enter and verify the result','Saisissez et vérifiez le résultat','Enter the simulated result, verify it, then complete the investigation.','Saisissez le résultat simulé, vérifiez-le, puis terminez l’examen.','Verify result','Vérifier le résultat'),
    ('practice_laboratory','complete',4,array['admin','lab_technician']::text[],'Complete the investigation','Terminez l’examen','Completion removes the simulated item from active work and allows the encounter to move forward.','La fin de l’examen retire l’élément simulé du travail actif et permet au parcours d’avancer.','Complete test','Terminer l’examen'),

    ('practice_pharmacy','review',1,array['admin','pharmacist']::text[],'Review the prescription','Validez la prescription','Check the simulated prescription before dispensing. If review is required, dispensing must wait.','Vérifiez la prescription simulée avant la délivrance. Si une validation est requise, la délivrance doit attendre.','Review prescription','Valider la prescription'),
    ('practice_pharmacy','payment',2,array['admin','pharmacist']::text[],'Check payment status','Vérifiez le paiement','The exercise distinguishes an unpaid charge from an authorized/paid prescription. Authorization and payment are not the same event.','La simulation distingue une charge impayée d’une prescription autorisée/payée. Autorisation et paiement ne sont pas le même événement.','Check payment','Vérifier le paiement'),
    ('practice_pharmacy','stock',3,array['admin','pharmacist']::text[],'Check stock','Vérifiez le stock','Confirm that enough simulated stock exists before dispensing. No real inventory is changed.','Vérifiez que le stock simulé est suffisant avant la délivrance. Aucun stock réel n’est modifié.','Check stock','Vérifier le stock'),
    ('practice_pharmacy','dispense',4,array['admin','pharmacist']::text[],'Dispense safely','Délivrez en toute sécurité','Complete the simulated dispensing action. The exercise shows the expected success state without creating a dispensing record.','Terminez la délivrance simulée. L’exercice montre le résultat attendu sans créer de fiche de délivrance réelle.','Dispense','Délivrer'),

    ('practice_billing','find',1,array['admin','receptionist','billing_clerk']::text[],'Find the outstanding balance','Trouvez le solde restant','Open the simulated ledger and identify the outstanding charge. Do not create a new charge for the same service.','Ouvrez le compte simulé et identifiez la charge restante. Ne créez pas une nouvelle charge pour le même service.','Open ledger','Ouvrir le compte'),
    ('practice_billing','amount',2,array['admin','receptionist','billing_clerk']::text[],'Collect the correct amount','Encaissez le bon montant','Enter the amount actually being collected. Partial payment leaves the remaining balance visible.','Saisissez le montant réellement encaissé. Un paiement partiel laisse le solde restant visible.','Enter payment','Saisir le paiement'),
    ('practice_billing','confirm',3,array['admin','receptionist','billing_clerk']::text[],'Confirm the balance','Confirmez le solde','After full payment, the simulated outstanding balance becomes zero. The system should not create a second charge.','Après paiement complet, le solde restant simulé devient zéro. Le système ne doit pas créer une deuxième charge.','Confirm payment','Confirmer le paiement')
  ) as x(tour_key,step_key,step_order,roles,title_en,title_fr,body_en,body_fr,action_en,action_fr)
)
insert into public.onboarding_steps
  (tour_id,step_key,step_order,phase,roles,title_en,title_fr,body_en,body_fr,action_en,action_fr,target_route,target_selector,metadata)
select t.id,s.step_key,s.step_order,3,s.roles,s.title_en,s.title_fr,s.body_en,s.body_fr,s.action_en,s.action_fr,null,null,
       jsonb_build_object('mode','practice','safe_simulation',true,'scenario',s.step_key)
from steps s join tours t on t.tour_key=s.tour_key
on conflict (tour_id,step_key) do update set
  step_order=excluded.step_order,
  phase=excluded.phase,
  roles=excluded.roles,
  title_en=excluded.title_en,
  title_fr=excluded.title_fr,
  body_en=excluded.body_en,
  body_fr=excluded.body_fr,
  action_en=excluded.action_en,
  action_fr=excluded.action_fr,
  target_route=excluded.target_route,
  target_selector=excluded.target_selector,
  metadata=excluded.metadata;
