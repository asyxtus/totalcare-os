-- ============================================================================
-- CONSULTATION TEMPLATE ENGLISH PROMPTS
--
-- The templates table has name_fr/name_en (done) but the actual SOAP
-- prompt content (subjective_prompt, objective_prompt, assessment_prompt,
-- plan_prompt) is French-only. This migration adds English columns and
-- populates them with clinical translations of each template.
--
-- The prompts are clinical guides, not translations of patient data —
-- they tell the doctor what to ask/check. An English-speaking doctor
-- gets English guidance; a French-speaking doctor gets French guidance.
-- Patient answers they type in are always in whatever language they use.
-- ============================================================================

alter table consultation_templates
  add column if not exists subjective_prompt_en text,
  add column if not exists objective_prompt_en text,
  add column if not exists assessment_prompt_en text,
  add column if not exists plan_prompt_en text;

-- ── Illness templates ───────────────────────────────────────────────────────

update consultation_templates set
  subjective_prompt_en = 'Fever for [duration]. Chills, sweats, headache, body aches? Travel/residence in confirmed endemic area?',
  objective_prompt_en  = 'Temperature: ___°C. Splenomegaly? Jaundice? Danger signs (confusion, seizures, respiratory distress)? RDT/thick smear: ___',
  assessment_prompt_en = 'Simple malaria / Severe malaria. Responsible species (P. falciparum / P. vivax). Rule out differential (typhoid, bacterial infection).',
  plan_prompt_en       = 'ACT (artemether-lumefantrine or artesunate-amodiaquine per protocol). Paracetamol for fever. Hydration. Rest. Return if no improvement at 48h or danger signs. Follow-up Day 3 and Day 7.'
where name_en = 'Malaria';

update consultation_templates set
  subjective_prompt_en = 'Fever for [duration]. Headache, abdominal pain, constipation or diarrhea? Altered general condition? Rash (rose spots)? Previous treatment?',
  objective_prompt_en  = 'Temperature: ___°C. Relative bradycardia? Hepatosplenomegaly? Abdominal tenderness? Neurological status.',
  assessment_prompt_en = 'Typhoid fever (Salmonella typhi). Confirm with Widal test or blood culture if available. Rule out malaria (co-infection possible).',
  plan_prompt_en       = 'Azithromycin 1g/day × 5 days (first line) or ciprofloxacin 500mg BD × 7 days. Antipyretics. Hydration. Soft diet. Strict isolation of stools. Report notifiable disease if required.'
where name_en = 'Typhoid fever';

update consultation_templates set
  subjective_prompt_en = 'Cough for [duration]. Productive (purulent/blood-streaked)? Dyspnea? Chest pain? Fever? Known TB contact? HIV status?',
  objective_prompt_en  = 'Temperature: ___°C. SpO2: __%. RR: __/min. Auscultation (crackles, wheezing, decreased breath sounds)? Signs of severity?',
  assessment_prompt_en = 'Upper respiratory infection / Bronchitis / Pneumonia. Severity: mild / moderate / severe. Rule out TB if cough > 2 weeks.',
  plan_prompt_en       = 'If bacterial: amoxicillin 500mg TID × 7 days (or azithromycin if atypical). Antipyretics. Hydration. Return if dyspnea, SpO2 < 94%, or no improvement at 48h. TB screening if indicated.'
where name_en = 'Respiratory infection';

update consultation_templates set
  subjective_prompt_en = 'Dysuria, frequency, urgency? Suprapubic pain? Fever or lumbar pain (suggests pyelonephritis)? Pregnancy status? Previous UTIs?',
  objective_prompt_en  = 'Temperature: ___°C. Suprapubic tenderness? Renal angle tenderness (CVA)? Urinalysis/dipstick: leucocytes___ nitrites___.',
  assessment_prompt_en = 'Lower UTI (cystitis) / Upper UTI (pyelonephritis). Rule out STI if risk factors. Rule out pregnancy (urine hCG).',
  plan_prompt_en       = 'Lower UTI: cotrimoxazole 960mg BD × 5 days or nitrofurantoin 100mg BD × 5 days. Upper UTI: ciprofloxacin 500mg BD × 10–14 days. Hydration. Urine culture if recurrent.'
where name_en = 'Urinary tract infection';

update consultation_templates set
  subjective_prompt_en = 'Diarrhea duration/frequency? Blood or mucus? Vomiting? Fever? Hydration status (thirst, urine output)? Food exposure? Other cases in household?',
  objective_prompt_en  = 'Temperature: ___°C. Dehydration signs (skin turgor, sunken eyes, dry mucosa, HR, BP)? Abdominal tenderness? Stool examination.',
  assessment_prompt_en = 'Gastroenteritis / Diarrhea: viral / bacterial / parasitic. Dehydration grade: none / mild-moderate / severe.',
  plan_prompt_en       = 'Oral rehydration (ORS). Zinc 20mg/day × 10 days (children). Antibiotics only if bloody diarrhea or suspected cholera (azithromycin or ciprofloxacin). No anti-diarrheal agents in children. Dietary advice. Return if unable to drink or signs of severe dehydration.'
where name_en = 'Gastroenteritis / Diarrhea';

update consultation_templates set
  subjective_prompt_en = 'Known hypertensive since [year]. Current medications and adherence? Headache, visual disturbances, chest pain, dyspnea? Home BP readings? Last labs?',
  objective_prompt_en  = 'BP: ___/___ (right arm, seated). Repeat: ___/___. HR: ___. Weight: ___kg. Retinal examination? Signs of target organ damage (heart, kidneys)?',
  assessment_prompt_en = 'Controlled hypertension / Uncontrolled hypertension (BP ≥ 140/90). Cardiovascular risk factors. Any hypertensive urgency/emergency?',
  plan_prompt_en       = 'If controlled: continue current treatment. If uncontrolled: adjust dose or add agent (amlodipine 5–10mg, or enalapril 5–10mg, or hydrochlorothiazide 25mg). Diet (salt restriction, weight management). Physical activity. Target BP < 140/90. Renal function and ECG annually.'
where name_en = 'Hypertension (follow-up)';

update consultation_templates set
  subjective_prompt_en = 'Known diabetic since [year]. Type 1 / Type 2. Current medications and adherence? HbA1c and recent blood glucose? Symptoms of hypo/hyperglycemia? Foot pain or numbness? Blurred vision?',
  objective_prompt_en  = 'Weight: ___kg. BMI: ___. BP: ___/___. Random blood glucose: ___mmol/L. Foot examination (sensation, pulses, wounds). Fundus if not done recently.',
  assessment_prompt_en = 'Type 2 diabetes: controlled (HbA1c < 7%) / uncontrolled. Complications: nephropathy / neuropathy / retinopathy / cardiovascular.',
  plan_prompt_en       = 'If controlled: continue. If uncontrolled: intensify metformin (max 2550mg/day), add sulfonylurea or insulin if indicated. Dietary counseling. Physical activity. HbA1c every 3 months. Annual: renal function, lipids, urine microalbumin, foot exam, fundus.'
where name_en = 'Type 2 diabetes (follow-up)';

update consultation_templates set
  subjective_prompt_en = 'Epigastric or upper abdominal pain? Relation to meals (better or worse)? Heartburn, nausea, vomiting? NSAID/aspirin use? Alcohol/tobacco? H. pylori treatment history?',
  objective_prompt_en  = 'Epigastric tenderness? Signs of complications (melena, hematemesis, rigidity)? Weight loss?',
  assessment_prompt_en = 'Gastritis / Peptic ulcer (gastric / duodenal). Rule out H. pylori infection. Rule out alarm signs (dysphagia, anemia, weight loss, age > 45).',
  plan_prompt_en       = 'PPI (omeprazole 20mg) × 4–8 weeks. If H. pylori: triple therapy (PPI + amoxicillin 1g + clarithromycin 500mg) BD × 14 days. Avoid NSAIDs, alcohol, spicy food. Endoscopy if no response or alarm signs.'
where name_en = 'Gastritis / Peptic ulcer';

update consultation_templates set
  subjective_prompt_en = 'Abdominal pain, bloating? Anal pruritus? Perianal worms visible? Recent stool changes? Family members affected? Nutritional status?',
  objective_prompt_en  = 'Abdominal distension? Periumbilical pain on palpation? Pallor (anemia from hookworm)? Rectal examination if indicated.',
  assessment_prompt_en = 'Intestinal parasitosis: ascariasis / hookworm / strongyloidiasis / enterobiasis / giardiasis. Stool exam if available.',
  plan_prompt_en       = 'Mebendazole 500mg single dose (or albendazole 400mg). Giardiasis: metronidazole 500mg TID × 5 days. Hygiene education (handwashing, footwear, drinking water). Treat household members. Repeat stool exam in 4 weeks.'
where name_en = 'Intestinal parasitosis';

update consultation_templates set
  subjective_prompt_en = 'Fatigue, pallor, dyspnea on exertion? Duration? Dietary history (iron, folate)? Menstrual losses? Bleeding? HIV/malaria/chronic disease? Previous anemia?',
  objective_prompt_en  = 'Conjunctival/palmar pallor? HR: ___. Murmur? Hepatosplenomegaly? Hemoglobin: ___g/dL. Blood smear: ___.',
  assessment_prompt_en = 'Anemia: microcytic (iron deficiency) / normocytic (chronic disease, hemolysis) / macrocytic (folate/B12 deficiency). Severity: mild (Hb 10–11.9) / moderate (7–9.9) / severe (< 7).',
  plan_prompt_en       = 'Iron deficiency: ferrous sulfate 200mg BD × 3 months + dietary advice. Folate: folic acid 5mg/day × 4 months. Treat underlying cause. Transfusion if Hb < 7 + symptomatic. Repeat CBC at 4 and 8 weeks.'
where name_en = 'Anemia';

update consultation_templates set
  subjective_prompt_en = 'Pain, redness, swelling, heat, purulent discharge? Duration? Skin trauma or insect bite? Fever? Immunosuppression (diabetes, HIV)?',
  objective_prompt_en  = 'Lesion type: abscess / cellulitis / impetigo / furuncle. Size (cm): ___. Fluctuation? Regional lymphadenopathy? Temperature: ___°C.',
  assessment_prompt_en = 'Bacterial skin infection (staphylococcal / streptococcal). Rule out necrotizing fasciitis (hard board-like skin, rapid spread, disproportionate pain).',
  plan_prompt_en       = 'Abscess: incision and drainage + wound care. Cellulitis: amoxicillin-clavulanate 625mg TID × 7 days (or cloxacillin). Local antisepsis (povidone-iodine or chlorhexidine). Elevate affected limb. Return in 48–72h. Hospital admission if signs of sepsis.'
where name_en = 'Skin infection';

update consultation_templates set
  subjective_prompt_en = 'Low back pain since [duration]. Acute / chronic / recurrent? Radiation to leg (sciatica)? Nocturnal pain? Trauma? Bladder/bowel changes? Occupation and posture?',
  objective_prompt_en  = 'Lumbar mobility (flexion/extension/lateral). SLR test (Lasègue): positive at ___°. Neurological deficits (strength, sensation, reflexes)? Paravertebral muscle spasm?',
  assessment_prompt_en = 'Mechanical low back pain / Sciatica (L4-L5 / L5-S1). Rule out red flags: fever, weight loss, nocturnal pain, sphincter dysfunction, age < 20 or > 50 (malignancy, infection, fracture).',
  plan_prompt_en       = 'Paracetamol 1g TID (first line). Add ibuprofen 400mg TID if insufficient (with meals). Muscle relaxant if spasm (diazepam 5mg nocte × 3 days max). Physical activity encouraged. No bed rest. Physiotherapy if > 6 weeks. MRI if neurological deficit or red flags.'
where name_en = 'Low back pain';

-- ── Annual physical ─────────────────────────────────────────────────────────

update consultation_templates set
  subjective_prompt_en = 'Updated medical/surgical/family history? Current medications? Lifestyle (tobacco, alcohol, physical activity, diet)? New symptoms? Vaccinations up to date?',
  objective_prompt_en  = 'Weight/height/BMI. BP. Systematic examination (cardiopulmonary, abdominal, ENT, skin). Age/sex-appropriate screening (glucose, cholesterol, cervical smear, PSA if applicable).',
  assessment_prompt_en = 'Annual physical exam. Active issues identified: ___. Preventive screening status.',
  plan_prompt_en       = 'Update vaccinations. Renew chronic disease prescriptions. Order screening labs as appropriate. Lifestyle counseling. Next annual review in 12 months.'
where name_en = 'Annual physical exam';

-- ── Antenatal ───────────────────────────────────────────────────────────────

update consultation_templates set
  subjective_prompt_en = 'Gestational age: ___ weeks (LMP: ___). Fetal movements felt? Danger signs: bleeding, severe headache, visual disturbance, epigastric pain, sudden edema, fever, decreased fetal movements?',
  objective_prompt_en  = 'BP: ___/___. Weight: ___kg. Symphysis-fundus height: ___cm. Fetal heart rate: ___bpm. Edema? Urine dipstick (proteinuria): ___. Hemoglobin if due.',
  assessment_prompt_en = 'Antenatal visit ___ (GA: ___ weeks). Normal / Concerns: ___. Risk classification: low / intermediate / high risk.',
  plan_prompt_en       = 'Folic acid + iron supplementation. Malaria prophylaxis (SP if indicated by protocol). TT vaccination if not complete. Next ANC visit in ___ weeks. Advise on birth preparedness and danger signs. Refer if high-risk.'
where name_en = 'Antenatal visit';

-- ── Well child ──────────────────────────────────────────────────────────────

update consultation_templates set
  subjective_prompt_en = 'Breastfeeding (frequency, latch)? Normal stools/urine? Jaundice? Umbilical cord status?',
  objective_prompt_en  = 'Weight (growth chart). Temperature. Jaundice (zone)? Umbilical cord. Primitive reflexes. Cardiopulmonary auscultation.',
  assessment_prompt_en = 'Newborn care visit. Normal growth and development / Concerns: ___.',
  plan_prompt_en       = 'Exclusive breastfeeding counseling. Vitamin K if not given at birth. BCG + HBV vaccine if not given. Cord care. Danger signs education (fever, refusal to feed, jaundice, convulsions). Next visit at 6 weeks.'
where name_en = 'Newborn care';

update consultation_templates set
  subjective_prompt_en = 'Breastfeeding / mixed feeding / formula? Introduction of complementary foods (after 6 months)? Development milestones (smiling, sitting, babbling)? Vaccinations up to date?',
  objective_prompt_en  = 'Weight/height (growth chart, z-score). Head circumference. Fontanelle. Development assessment. Signs of malnutrition (edema, wasting, stunting)?',
  assessment_prompt_en = 'Infant care visit. Normal growth and development / Concerns: ___. Nutritional status: normal / risk / moderate / severe malnutrition.',
  plan_prompt_en       = 'Growth monitoring. Vaccination catch-up if needed. Complementary feeding counseling (6 months+). Vitamin A supplementation (6 months+). MUAC screening. Next visit in ___ weeks/months.'
where name_en = 'Infant care';

update consultation_templates set
  subjective_prompt_en = 'Development (language, motor, social)? Schooling (learning difficulties)? Vaccinations up to date? Nutrition? Deworming done?',
  objective_prompt_en  = 'Weight/height (growth chart). Dental examination. Vision/hearing screening if indicated. Development assessment.',
  assessment_prompt_en = 'Early childhood visit. Normal growth and development / Concerns: ___.',
  plan_prompt_en       = 'Growth monitoring. Deworming (mebendazole 500mg × 1, every 6 months from age 1). Vitamin A every 6 months. Vaccinations per schedule. Nutrition and hygiene counseling.'
where name_en = 'Early childhood care';

update consultation_templates set
  subjective_prompt_en = 'School performance? Learning or behavioral difficulties? Vaccinations up to date? Nutrition? Dental hygiene? Physical activity? Screen time?',
  objective_prompt_en  = 'Weight/height/BMI (growth chart). BP. Puberty staging (if appropriate). Scoliosis screening. Dental check.',
  assessment_prompt_en = 'Childhood visit. Normal growth and development / Concerns: ___.',
  plan_prompt_en       = 'Vaccinations per schedule. Deworming every 6 months. Nutrition counseling. Physical activity (≥ 60 min/day). Screen time limits. Dental hygiene.'
where name_en = 'Childhood care';

update consultation_templates set
  subjective_prompt_en = 'Puberty stage and concerns? Menstruation (menarche, cycle, dysmenorrhea)? School performance? Emotional wellbeing? Substance use screening? Vaccinations up to date?',
  objective_prompt_en  = 'Weight/height/BMI. BP. Tanner staging. Confidential assessment if indicated.',
  assessment_prompt_en = 'Adolescent visit. Normal development / Concerns: ___.',
  plan_prompt_en       = 'HPV vaccine if not completed. Other vaccinations per schedule. Confidential counseling (sexual health, contraception, substance use) if appropriate. Mental health screening. Physical activity and nutrition advice.'
where name_en = 'Adolescent care';
