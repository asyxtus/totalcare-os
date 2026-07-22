-- ============================================================================
-- CONSULTATION TEMPLATES + SOAP RESTRUCTURING
-- Adds a real Subjective field to consultations (Objective = the existing
-- examination_notes column, Assessment = diagnosis + diagnosis_code,
-- Plan = treatment_plan — no need to rename existing columns, just add
-- what's missing and treat the four together as SOAP in the UI).
--
-- Templates are platform-wide by default (clinic_id null), same pattern
-- as clinical_thresholds and drug_classes — every clinic gets these on
-- day one, any clinic can add their own on top.
-- ============================================================================

alter table consultations add column subjective_notes text;

create type template_category as enum ('illness', 'annual_physical', 'antenatal', 'well_child');

create table consultation_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade,  -- null = platform default
  category template_category not null,
  name_fr text not null,
  name_en text not null,
  age_group_label text,          -- only meaningful for category = 'well_child'
  subjective_prompt text,
  objective_prompt text,
  assessment_prompt text,
  plan_prompt text,
  suggested_icd10_code text references icd10_codes(code),
  is_active boolean not null default true
);

-- ----------------------------------------------------------------------------
-- ILLNESS TEMPLATES (12) — each pre-fills the four SOAP fields with
-- relevant prompts, not final documentation. The doctor edits from here,
-- doesn't type from a blank page.
-- ----------------------------------------------------------------------------
insert into consultation_templates (category, name_fr, name_en, subjective_prompt, objective_prompt, assessment_prompt, plan_prompt, suggested_icd10_code) values
('illness', 'Paludisme', 'Malaria',
 'Fièvre depuis [durée]. Frissons, sueurs, céphalées, courbatures ? Voyage/résidence en zone d''endémie confirmée.',
 'Température : ___°C. Splénomégalie ? Ictère ? Signes de gravité (confusion, convulsions, détresse respiratoire) ? TDR/goutte épaisse : ___',
 'Paludisme [simple/grave], [confirmé par TDR/goutte épaisse/clinique]',
 'Traitement antipaludique selon protocole. Antipyrétique si besoin. Réévaluation si signes de gravité. Conseils : hydratation, retour immédiat si aggravation.',
 'B54'),

('illness', 'Fièvre typhoïde', 'Typhoid fever',
 'Fièvre progressive depuis [durée]. Douleurs abdominales, constipation ou diarrhée, céphalées ?',
 'Température : ___°C. Sensibilité abdominale ? Splénomégalie ? Langue saburrale ? Test Widal/hémoculture : ___',
 'Fièvre typhoïde [suspectée/confirmée]',
 'Antibiothérapie selon protocole. Hydratation. Repos. Suivi à [X] jours. Conseils hygiène alimentaire/eau.',
 'A01.0'),

('illness', 'Infection respiratoire', 'Respiratory infection',
 'Toux depuis [durée]. Productive ou sèche ? Fièvre, douleur thoracique, dyspnée ?',
 'FR : ___/min. Auscultation : ___. SpO2 : ___%. Signes de détresse respiratoire ?',
 'Infection respiratoire [haute/basse], [voir SpO2 pour gravité]',
 'Traitement symptomatique / antibiothérapie si indiquée. Réévaluation si SpO2 bas ou aggravation.',
 'J06.9'),

('illness', 'Infection urinaire', 'Urinary tract infection',
 'Brûlures mictionnelles, pollakiurie, urgenturie depuis [durée]. Fièvre, douleur lombaire ?',
 'Sensibilité sus-pubienne ? Douleur à l''ébranlement lombaire (pyélonéphrite) ? Bandelette urinaire : ___',
 'Infection urinaire [basse/haute - pyélonéphrite si fièvre+douleur lombaire]',
 'Antibiothérapie selon protocole. Hydratation abondante. Suivi si pas d''amélioration à 48-72h.',
 'N39.0'),

('illness', 'Gastro-entérite / Diarrhée', 'Gastroenteritis / Diarrhea',
 'Diarrhée depuis [durée], [nombre] épisodes/jour. Sang/glaires ? Vomissements ? Fièvre ?',
 'Signes de déshydratation (pli cutané, muqueuses, état général) ? Sensibilité abdominale ?',
 'Gastro-entérite aiguë, déshydratation [absente/légère/modérée/sévère]',
 'Réhydratation orale (SRO) ou IV selon gravité. Antibiothérapie seulement si indiquée. Conseils hygiène.',
 'A09'),

('illness', 'Hypertension artérielle (suivi)', 'Hypertension (follow-up)',
 'Observance du traitement ? Effets secondaires ? Céphalées, vertiges, douleur thoracique ?',
 'TA : ___/___. Pouls : ___. Poids/IMC. Œdèmes ?',
 'Hypertension artérielle, [contrôlée/non contrôlée]',
 'Ajustement thérapeutique si besoin. Conseils hygiéno-diététiques (sel, activité physique). Bilan annuel (fonction rénale, ECG).',
 'I10'),

('illness', 'Diabète type 2 (suivi)', 'Type 2 diabetes (follow-up)',
 'Observance traitement/régime ? Symptômes d''hypo/hyperglycémie ? Polyurie, polydipsie ?',
 'Glycémie : ___. Poids/IMC. Examen des pieds. TA : ___/___.',
 'Diabète de type 2, [équilibré/déséquilibré]',
 'Ajustement thérapeutique. Conseils diététiques. Bilan (HbA1c, fonction rénale, fond d''œil) si dû.',
 'E11.9'),

('illness', 'Gastrite / Ulcère peptique', 'Gastritis / Peptic ulcer',
 'Douleur épigastrique depuis [durée]. Lien avec les repas ? Brûlures, nausées ? Prise d''AINS ?',
 'Sensibilité épigastrique ? Signes d''alarme (méléna, amaigrissement, vomissements sanglants) ?',
 'Gastrite / suspicion d''ulcère peptique',
 'IPP selon protocole. Arrêt AINS si possible. Conseils diététiques. Référence si signes d''alarme.',
 'K29.7'),

('illness', 'Parasitose intestinale', 'Intestinal parasitosis',
 'Douleurs abdominales, prurit anal, troubles du transit depuis [durée] ?',
 'Sensibilité abdominale ? Examen parasitologique des selles : ___',
 'Parasitose intestinale [type si identifié]',
 'Antiparasitaire selon protocole. Traitement familial si indiqué. Conseils hygiène.',
 'B82.9'),

('illness', 'Anémie', 'Anemia',
 'Fatigue, pâleur, dyspnée d''effort, vertiges depuis [durée] ? Régime alimentaire ?',
 'Pâleur conjonctivale/cutanée ? Souffle systolique ? Hémoglobine : ___',
 'Anémie [légère/modérée/sévère], étiologie à préciser',
 'Supplémentation fer/acide folique selon cause. Bilan étiologique si besoin. Transfusion si sévère.',
 'D64.9'),

('illness', 'Infection cutanée', 'Skin infection',
 'Lésion cutanée depuis [durée]. Prurit, douleur, écoulement ?',
 'Description lésion : localisation, aspect, taille. Signes d''extension/cellulite ?',
 'Infection cutanée [fongique/bactérienne], à préciser',
 'Traitement topique/systémique selon type. Conseils hygiène. Suivi si pas d''amélioration.',
 'B35.9'),

('illness', 'Lombalgie', 'Low back pain',
 'Douleur lombaire depuis [durée]. Irradiation ? Traumatisme ? Signes neurologiques (engourdissement, faiblesse) ?',
 'Mobilité rachis. Signes neurologiques (réflexes, sensibilité, force) ? Signes d''alarme ?',
 'Lombalgie [mécanique/autre], sans/avec signe d''alarme',
 'Antalgiques, repos relatif, kinésithérapie si besoin. Référence si signes neurologiques.',
 'M54.5');

-- ----------------------------------------------------------------------------
-- ANNUAL PHYSICAL
-- ----------------------------------------------------------------------------
insert into consultation_templates (category, name_fr, name_en, subjective_prompt, objective_prompt, assessment_prompt, plan_prompt) values
('annual_physical', 'Examen physique annuel', 'Annual physical exam',
 'Antécédents médicaux/chirurgicaux/familiaux mis à jour ? Traitements en cours ? Habitudes de vie (tabac, alcool, activité physique, alimentation) ? Symptômes nouveaux ?',
 'Poids/taille/IMC. TA. Examen systématique (cardio-pulmonaire, abdominal, ORL, cutané). Dépistages selon âge/sexe (glycémie, cholestérol, frottis, PSA, etc. si applicable).',
 'Statut de santé général : [normal/anomalies notées]',
 'Vaccinations à jour ? Dépistages recommandés programmés. Conseils préventifs (nutrition, activité physique, tabac/alcool). Suivi dans [X] mois/an.');

-- ----------------------------------------------------------------------------
-- ANTENATAL VISIT
-- DRAFT built from general WHO / Cameroon EPI-aligned antenatal care
-- practice (focused antenatal care model, IPTp-SP malaria prevention
-- schedule, standard danger-sign screening) — NOT sourced from Total
-- Care's own protocols manual, which could not be located. This needs
-- your clinical review before real use, same caution as the ICD-10 list.
-- ----------------------------------------------------------------------------
insert into consultation_templates (category, name_fr, name_en, subjective_prompt, objective_prompt, assessment_prompt, plan_prompt, suggested_icd10_code) values
('antenatal', 'Visite prénatale', 'Antenatal visit',
 'Âge gestationnel : ___ SA (DDR : ___). Mouvements fœtaux perçus ? Signes de danger : saignement, céphalées sévères, troubles visuels, douleur épigastrique, œdèmes brutaux, fièvre, diminution des mouvements fœtaux ?',
 'TA : ___/___. Poids. Hauteur utérine : ___cm. Bruits du cœur fœtal : ___bpm. Œdèmes ? Bandelette urinaire (protéinurie) : ___. Hémoglobine si due.',
 'Grossesse à [X] SA, évolution [normale/à surveiller — préciser]',
 'Supplémentation fer/acide folique. TPI-SP (traitement préventif intermittent du paludisme) si dû selon calendrier. Statut vaccination antitétanique vérifié/mis à jour. Prochaine visite programmée à [X] SA. Plan d''accouchement discuté si applicable.',
 'Z34.9');

-- ----------------------------------------------------------------------------
-- WELL-CHILD CARE, BY AGE GROUP (5)
-- ----------------------------------------------------------------------------
insert into consultation_templates (category, name_fr, name_en, age_group_label, subjective_prompt, objective_prompt, assessment_prompt, plan_prompt, suggested_icd10_code) values
('well_child', 'Soins du nouveau-né', 'Newborn care', 'Nouveau-né (0-28 jours)',
 'Allaitement (fréquence, prise du sein) ? Selles/urines normales ? Ictère ? Chute du cordon ?',
 'Poids (courbe de croissance). Température. Ictère (zone) ? Cordon ombilical. Réflexes archaïques. Auscultation cardio-pulmonaire.',
 'Nouveau-né, développement [normal/à surveiller]',
 'Vaccinations selon calendrier PEV. Conseils allaitement exclusif. Signes d''alarme à surveiller expliqués aux parents. Prochain contrôle à [X] semaines.',
 'Z00.1'),

('well_child', 'Soins du nourrisson', 'Infant care', 'Nourrisson (1-12 mois)',
 'Alimentation (allaitement/diversification) ? Développement psychomoteur (tenue de tête, position assise, etc. selon âge) ? Maladies récentes ?',
 'Poids/taille (courbe de croissance). Développement psychomoteur selon âge. Examen systématique.',
 'Nourrisson, croissance et développement [normaux/à surveiller]',
 'Vaccinations PEV à jour ? Conseils diversification alimentaire. Supplémentation vitamine A/fer si indiqué. Prochain contrôle selon calendrier.',
 'Z00.1'),

('well_child', 'Soins de la petite enfance', 'Early childhood care', 'Petite enfance (1-5 ans)',
 'Alimentation équilibrée ? Développement du langage/moteur ? Maladies récentes, épisodes de fièvre ?',
 'Poids/taille (courbe de croissance). Développement selon âge. Examen dentaire sommaire.',
 'Enfant, croissance et développement [normaux/à surveiller]',
 'Vaccinations à jour. Déparasitage si dû. Conseils nutrition et stimulation. Prochain contrôle annuel ou selon besoin.',
 'Z00.1'),

('well_child', 'Soins de l''enfance', 'Childhood care', 'Enfance (5-12 ans)',
 'Scolarité normale ? Alimentation ? Activité physique ? Symptômes particuliers ?',
 'Poids/taille (courbe de croissance). Acuité visuelle sommaire. Examen systématique.',
 'Enfant, croissance et développement [normaux/à surveiller]',
 'Vaccinations de rappel à jour. Conseils nutrition/activité physique. Dépistage visuel/auditif si indiqué.',
 'Z00.1'),

('well_child', 'Soins de l''adolescent', 'Adolescent care', 'Adolescent (12-18 ans)',
 'Développement pubertaire. Scolarité. Habitudes de vie (alimentation, sommeil, activité physique, écrans). Questions de santé sexuelle/reproductive si approprié.',
 'Poids/taille/IMC. Stade pubertaire (Tanner) si pertinent. TA.',
 'Adolescent, développement [normal/à surveiller]',
 'Vaccinations de rappel (dont HPV si applicable). Conseils prévention (IST, grossesse, substances). Soutien psychosocial si besoin.',
 'Z00.1');

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table consultation_templates enable row level security;

create policy consultation_templates_select on consultation_templates for select
  using (clinic_id is null or clinic_id = current_staff_clinic_id());

create policy consultation_templates_write on consultation_templates for all using (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
) with check (
  clinic_id = current_staff_clinic_id() and current_staff_role() = 'admin'
);
