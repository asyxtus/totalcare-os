-- ============================================================================
-- DRUG CLASS IMPROVEMENTS
-- ============================================================================

alter table drug_classes
  add column if not exists name_en text,
  add column if not exists is_antibiotic boolean not null default false;

-- Update existing entries
update drug_classes set name_en = 'Penicillins',    is_antibiotic = true  where name = 'Penicillins';
update drug_classes set name_en = 'Cephalosporins', is_antibiotic = true  where name = 'Cephalosporins';
update drug_classes set name_en = 'Sulfonamides',   is_antibiotic = true  where name = 'Sulfonamides';
update drug_classes set name_en = 'NSAIDs',         is_antibiotic = false where name = 'NSAIDs';
update drug_classes set name_en = 'Macrolides',     is_antibiotic = true  where name = 'Macrolides';
update drug_classes set name_en = name where name_en is null;

-- Insert new classes only if they don't already exist (no unique constraint on name)
do $$
declare
  classes text[][] := array[
    -- name, name_fr, name_en, is_controlled, is_antibiotic
    array['Fluoroquinolones','Fluoroquinolones','Fluoroquinolones','false','true'],
    array['Aminoglycosides','Aminoglycosides','Aminoglycosides','false','true'],
    array['Tetracyclines','Tétracyclines','Tetracyclines','false','true'],
    array['Nitroimidazoles','Nitroimidazoles','Nitroimidazoles','false','true'],
    array['Lincosamides','Lincosamides','Lincosamides','false','true'],
    array['Glycopeptides','Glycopeptides','Glycopeptides','false','true'],
    array['Rifamycins','Rifamycines','Rifamycins','false','true'],
    array['Antimalarials','Antipaludéens','Antimalarials','false','false'],
    array['Antiretrovirals','Antirétroviraux','Antiretrovirals','false','false'],
    array['Antifungals','Antifongiques','Antifungals','false','false'],
    array['Anthelmintics','Anthelminthiques','Anthelmintics','false','false'],
    array['ACE Inhibitors','Inhibiteurs de l''ECA','ACE Inhibitors','false','false'],
    array['ARBs','ARA-II','ARBs','false','false'],
    array['Beta-blockers','Bêta-bloquants','Beta-blockers','false','false'],
    array['Calcium channel blockers','Inhibiteurs calciques','Calcium channel blockers','false','false'],
    array['Diuretics','Diurétiques','Diuretics','false','false'],
    array['Statins','Statines','Statins','false','false'],
    array['Biguanides','Biguanides','Biguanides','false','false'],
    array['Sulfonylureas','Sulfonylurées','Sulfonylureas','false','false'],
    array['Insulin','Insuline','Insulin','false','false'],
    array['Corticosteroids','Corticoïdes','Corticosteroids','false','false'],
    array['Thyroid hormones','Hormones thyroïdiennes','Thyroid hormones','false','false'],
    array['Benzodiazepines','Benzodiazépines','Benzodiazepines','true','false'],
    array['Antiepileptics','Antiépileptiques','Antiepileptics','false','false'],
    array['Antidepressants','Antidépresseurs','Antidepressants','false','false'],
    array['Antipsychotics','Antipsychotiques','Antipsychotics','false','false'],
    array['Opioids','Opioïdes','Opioids','true','false'],
    array['Paracetamol','Paracétamol','Paracetamol','false','false'],
    array['Proton pump inhibitors','Inhibiteurs de la pompe à protons','Proton pump inhibitors','false','false'],
    array['Antacids','Antiacides','Antacids','false','false'],
    array['Antiemetics','Antiémétiques','Antiemetics','false','false'],
    array['Vitamins/Supplements','Vitamines/Compléments','Vitamins/Supplements','false','false'],
    array['Oxytocics','Ocytociques','Oxytocics','false','false'],
    array['Antihistamines','Antihistaminiques','Antihistamines','false','false']
  ];
  c text[];
begin
  foreach c slice 1 in array classes loop
    if not exists (select 1 from drug_classes where name = c[1]) then
      insert into drug_classes (name, name_fr, name_en, is_controlled, is_antibiotic)
      values (c[1], c[2], c[3], c[4]::boolean, c[5]::boolean);
    end if;
  end loop;
end;
$$;
