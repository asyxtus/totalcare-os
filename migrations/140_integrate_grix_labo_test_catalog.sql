-- ============================================================================
-- MIGRATION 140: INTEGRATE GRIX LABO TEST CATALOGUE
--
-- Source: GRIX LABO price list supplied for Total Care.
--
-- This migration:
--   1. Adds the source laboratory code, specimen/container and turnaround
--      metadata to the clinic-owned laboratory test catalogue.
--   2. Seeds the 78 tests from the supplied price list.
--   3. Avoids duplicate tests by reusing an existing clinic catalogue row
--      when its French name already matches exactly.
--   4. Activates/prices the tests for the clinic that currently owns the
--      largest existing laboratory catalogue. This is deliberately NOT a
--      cross-tenant/global seed: every lab catalogue row remains clinic-owned.
--   5. Does not invent reference ranges or units where the supplied price
--      list does not provide them. Existing catalogue ranges are preserved.
--
-- Source normalisations made only where the PDF formatting is unambiguous:
--   - AGHBS "35 00" -> 3,500 FCFA
--   - GSRH "25 00" -> 2,500 FCFA
--   - The duplicated LDL line is represented once at 4,000 FCFA to prevent
--     duplicate catalogue entries.
-- ============================================================================

alter table lab_test_catalog
  add column if not exists lab_code text,
  add column if not exists collection_container text,
  add column if not exists turnaround_time text;

create unique index if not exists uq_lab_test_catalog_clinic_code
  on lab_test_catalog (clinic_id, lab_code)
  where lab_code is not null;

-- The supplied list contains no reference intervals. Keep the existing
-- catalogue intervals where a test already exists; newly created tests have
-- null ranges until the clinic validates them against its analyser/method.

do $$
declare
  v_clinic_id uuid;
  v_clinic_count int;
begin
  select count(distinct clinic_id) into v_clinic_count
  from clinic_lab_tests
  where clinic_id is not null;

  if v_clinic_count = 0 then
    select clinic_id into v_clinic_id
    from lab_test_catalog
    where clinic_id is not null
    group by clinic_id
    order by count(*) desc
    limit 1;
  else
    select clinic_id into v_clinic_id
    from clinic_lab_tests
    group by clinic_id
    order by count(*) desc
    limit 1;
  end if;

  if v_clinic_id is null then
    raise exception 'Migration 140: no clinic could be identified for the GRIX LABO catalogue';
  end if;

  create temporary table _gr_ix_lab_seed (
    lab_code text not null,
    name_fr text not null,
    category text not null,
    specimen_type text,
    collection_container text,
    turnaround_time text,
    price_xaf numeric(10,2) not null,
    result_type text not null,
    qualitative_options text[]
  ) on commit drop;

  insert into _gr_ix_lab_seed values
    ('COPROC','Coproculture','Bactériologie','Selles','Pot à selles','3 j',10000,'qualitative',array['Positif','Négatif','À préciser']),
    ('ECBU_ATB','Examen cytobactériologique de l''urine + ATB','Bactériologie','Urine','Pot à urine','3 j',10000,'qualitative',array['Positif','Négatif','À préciser']),
    ('MYCO','Mycoplasmes urogénitaux','Bactériologie','Prélèvement','Écouvillon','3 j',12000,'qualitative',array['Positif','Négatif','À préciser']),
    ('PCV_ATB','Prélèvement cervico-vaginal + ATB','Bactériologie','Prélèvement','Écouvillon','3 j',10000,'qualitative',array['Positif','Négatif','À préciser']),
    ('PCV','Prélèvement cervico-vaginal','Bactériologie','Prélèvement','Écouvillon','1 j',4000,'qualitative',array['Positif','Négatif','À préciser']),
    ('ECBU','Examen cytobactériologique de l''urine','Bactériologie','Urine','Pot à urine','1 j',4000,'qualitative',array['Positif','Négatif','À préciser']),
    ('PU_ATB','Prélèvement urétral + ATB','Bactériologie','Prélèvement','Écouvillon','3 j',10000,'qualitative',array['Positif','Négatif','À préciser']),
    ('SUPPU_ATB','Suppurations + ATB','Bactériologie','Prélèvement','Pot stérile','3 j',10000,'qualitative',array['Positif','Négatif','À préciser']),
    ('SPERMOCULT','Spermoculture + ATB','Bactériologie','Sperme','Pot stérile','3 j',10000,'qualitative',array['Positif','Négatif','À préciser']),

    ('AU','Acide urique','Biochimie','Sang','Tube sec / héparine','1 j',3000,'numeric',null),
    ('ALAT','Alanine aminotransférase','Biochimie','Sang','Tube sec / héparine','1 j',3500,'numeric',null),
    ('ASAT','Aspartate aminotransférase','Biochimie','Sang','Tube sec / héparine','1 j',3500,'numeric',null),
    ('ALB','Albumine','Biochimie','Sang','Tube sec / héparine','1 j',4000,'numeric',null),
    ('AS','Albumine sucre','Biochimie','Urine','Pot à urine','1 j',1000,'qualitative',array['Positif','Négatif','À préciser']),
    ('AMY','Amylase','Biochimie','Sang','Tube sec / héparine','1 j',5000,'numeric',null),
    ('AMYU','Amylase urinaire','Biochimie','Urine','Pot à urine','1 j',4500,'numeric',null),
    ('BU','Bandelette urinaire','Biochimie','Urine','Pot à urine','1 j',1000,'qualitative',array['Négatif','Trace','+','++','+++']),
    ('BILIP','Bilan lipidique','Biochimie','Sang','Tube sec / héparine','1 j',12000,'qualitative',array['Normal','Anormal','À préciser']),
    ('BILIB','Bilirubine libre','Biochimie','Sang','Tube sec / héparine','1 j',5000,'numeric',null),
    ('BILT','Bilirubine totale','Biochimie','Sang','Tube sec / héparine','1 j',5000,'numeric',null),
    ('CL','Chlore','Biochimie','Sang','Tube sec / héparine','1 j',3000,'numeric',null),
    ('LDL','Cholestérol LDL','Biochimie','Sang','Tube sec / héparine','1 j',4000,'numeric',null),
    ('CA','Calcium','Biochimie','Sang','Tube sec / héparine','1 j',3000,'numeric',null),
    ('HDL','Cholestérol HDL','Biochimie','Sang','Tube sec / héparine','1 j',4000,'numeric',null),
    ('CT','Cholestérol total','Biochimie','Sang','Tube sec / héparine','1 j',4000,'numeric',null),
    ('CREA','Créatinine','Biochimie','Sang','Tube sec / héparine','1 j',3500,'numeric',null),
    ('CREAU','Créatinine urinaire','Biochimie','Urine','Pot à urine','1 j',2000,'numeric',null),
    ('FE','Fer sérique','Biochimie','Sang','Tube sec / héparine','1 j',6000,'numeric',null),
    ('FERI','Ferritine','Biochimie','Sang','Tube sec / héparine','1 j',26000,'numeric',null),
    ('G6PD','G6PD érythrocytaire','Biochimie','Sang','Tube EDTA','1 j',12000,'numeric',null),
    ('GGT','Gamma Glutamyl Transférase','Biochimie','Sang','Tube sec / héparine','1 j',5000,'numeric',null),
    ('GLY','Glycémie à jeun','Biochimie','Sang','Tube fluoré','1 j',1000,'numeric',null),
    ('GPP','Glycémie post prandiale','Biochimie','Sang','Tube fluoré','1 j',1000,'numeric',null),
    ('HB1AC','Hémoglobine glyquée','Biochimie','Sang','Tube EDTA','1 j',14000,'numeric',null),
    ('HGPO','Hyperglycémie provoquée par voie orale','Biochimie','Sang','Tube fluoré','1 j',7000,'numeric',null),
    ('IONOS','Ionogramme (Na, K, Cl)','Biochimie','Sang','Tube sec / héparine','1 j',9000,'qualitative',array['Normal','Anormal','À préciser']),
    ('IONOC','Ionogramme complet (Na, K, Cl, Mg, Ca)','Biochimie','Sang','Tube sec / héparine','1 j',12000,'qualitative',array['Normal','Anormal','À préciser']),
    ('LDH','Lactate déshydrogénase','Biochimie','Sang','Tube sec / héparine','1 j',4000,'numeric',null),
    ('LIPA','Lipase sérique','Biochimie','Sang','Tube sec / héparine','1 j',10000,'numeric',null),
    ('MG','Magnésium','Biochimie','Sang','Tube sec / héparine','1 j',3500,'numeric',null),
    ('PAL','Phosphatases alcaline','Biochimie','Sang','Tube sec / héparine','1 j',6000,'numeric',null),
    ('P','Phosphore','Biochimie','Sang','Tube sec / héparine','1 j',4000,'numeric',null),
    ('PT','Protéines totales','Biochimie','Sang','Tube sec / héparine','1 j',6000,'numeric',null),
    ('TG','Triglycéride','Biochimie','Sang','Tube sec / héparine','1 j',4000,'numeric',null),
    ('TROP','Troponine 1','Biochimie','Sang','Tube sec / héparine','1 j',20000,'numeric',null),
    ('U','Urée','Biochimie','Sang','Tube sec / héparine','1 j',3000,'numeric',null),

    ('ASLO','Antistreptolysine O','Immuno-sérologie','Sang','Tube sec','1 j',3000,'qualitative',array['Positif','Négatif','À préciser']),
    ('HCG_SANG','Beta HCG Sanguin','Immuno-sérologie','Sang','Tube sec','1 j',2000,'numeric',null),
    ('HCG_URINE','Beta HCG urinaire','Immuno-sérologie','Urine','Pot à urine','1 j',1000,'qualitative',array['Positif','Négatif']),
    ('CHLAMGM','Chlamydia RAPIDE','Immuno-sérologie','Sang','Tube sec','1 j',6000,'qualitative',array['Positif','Négatif','Indéterminé']),
    ('HPYLAC','Hélicobacter pylori Anticorps','Immuno-sérologie','Sang','Tube sec','1 j',5000,'qualitative',array['Positif','Négatif','Indéterminé']),
    ('HPYLAG','Hélicobacter pylori Antigènes','Immuno-sérologie','Selles','Pot à selles','1 j',5000,'qualitative',array['Positif','Négatif','Indéterminé']),
    ('AGHBS','Hépatite B','Immuno-sérologie','Sang','Tube sec','1 j',3500,'qualitative',array['Positif','Négatif','Indéterminé']),
    ('HCV','Hépatite C','Immuno-sérologie','Sang','Tube sec','1 j',3500,'qualitative',array['Positif','Négatif','Indéterminé']),
    ('PRF','Profil lipidique','Immuno-sérologie','Sang','Tube sec','1 j',12000,'qualitative',array['Normal','Anormal','À préciser']),
    ('CRP','Protéine C réactive CRP','Immuno-sérologie','Sang','Tube sec','1 j',3000,'numeric',null),
    ('RUBGM','Rubéole IgG IgM RAPIDE','Immuno-sérologie','Sang','Tube sec','1 j',6000,'qualitative',array['Positif','Négatif','Indéterminé']),
    ('WIDAL','Sérodiagnostic de Widal et Félix','Immuno-sérologie','Sang','Tube sec','1 j',3000,'qualitative',array['Positif','Négatif','À préciser']),
    ('TPHA-VDRL','Syphilis','Immuno-sérologie','Sang','Tube sec','1 j',4000,'qualitative',array['Positif','Négatif','Indéterminé']),
    ('FT3','T3 Libre','Immuno-sérologie','Sang','Tube sec','1 j',20000,'numeric',null),
    ('T3','T3 Total','Immuno-sérologie','Sang','Tube sec','1 j',20000,'numeric',null),
    ('FT4','T4 Libre','Immuno-sérologie','Sang','Tube sec','1 j',20000,'numeric',null),
    ('TOXGM','Toxoplasmose IgM ET IgG RAPIDE','Immuno-sérologie','Sang','Tube sec','3 j',7000,'qualitative',array['Positif','Négatif','Indéterminé']),

    ('TDA','Coombs direct (Test direct à l''antiglobuline)','Hématologie','Sang','Tube EDTA','1 j',7000,'qualitative',array['Positif','Négatif']),
    ('RAI','Coombs indirect (Recherche des antigènes irréguliers)','Hématologie','Sang','Tube EDTA','1 j',7000,'qualitative',array['Positif','Négatif']),
    ('ELHB','Electrophorèse de l''hémoglobine','Hématologie','Sang','Tube EDTA','5 j',9000,'qualitative',array['Normal','Anormal','À préciser']),
    ('GSRH','Groupes sanguin ABO Rhésus','Hématologie','Sang','Tube EDTA','1 j',2500,'qualitative',array['A+','A-','B+','B-','AB+','AB-','O+','O-']),
    ('NFS','Numération formule sanguine','Hématologie','Sang','Tube EDTA','1 j',5000,'qualitative',array['Normal','Anormal','À préciser']),
    ('TP','Taux de prothrombine','Hématologie','Sang','Tube citrate','1 j',5000,'numeric',null),
    ('TS','Temps de saignement','Hématologie','Sang','Tube citrate','1 j',2000,'numeric',null),
    ('VS','Vitesse de sédimentation','Hématologie','Sang','Tube EDTA','1 j',3000,'numeric',null),

    ('COPRO','Coprologie STOOL','Parasitologie','Selles','Pot à selles','1 j',1000,'qualitative',array['Négatif','Positif — parasite à préciser']),
    ('TDR','TDR PALU','Parasitologie','Sang','Tube EDTA','1 j',1000,'qualitative',array['Positif','Négatif']),
    ('CULOT','Culot urinaire/Cytologie urinaire','Parasitologie','Urine','Pot à urine','1 j',3000,'qualitative',array['Normal','Anormal','À préciser']),
    ('GE','Goutte épaisse','Parasitologie','Sang','Tube EDTA','1 j',1500,'qualitative',array['Positif','Négatif']),
    ('SS','Microfilaire cutanée (Skin Snip)','Parasitologie','Tissu','Tissu','1 j',3000,'qualitative',array['Positif','Négatif','À préciser']),
    ('ST','Scotch-test (oxyures)','Parasitologie','Prélèvement','—','1 j',3000,'qualitative',array['Positif','Négatif']),
    ('SPERMO','Spermocytogramme/spermogramme','Parasitologie','Sperme','Pot stérile','4 j',15000,'qualitative',array['Normal','Anormal','À préciser']);

  -- Reuse exact-name catalogue rows where possible. This prevents the
  -- common situation where the same clinical test exists twice merely
  -- because an earlier catalogue used a slightly different code.
  update lab_test_catalog cat
  set lab_code = s.lab_code,
      collection_container = s.collection_container,
      turnaround_time = s.turnaround_time,
      category = s.category,
      name_en = case when cat.name_en is null or trim(cat.name_en) = '' then s.name_fr else cat.name_en end
  from _gr_ix_lab_seed s
  where cat.clinic_id = v_clinic_id
    and lower(trim(cat.name_fr)) = lower(trim(s.name_fr))
    and cat.lab_code is null;

  insert into lab_test_catalog (
    clinic_id, lab_code, name_fr, name_en, category, specimen_type,
    collection_container, turnaround_time, result_type, qualitative_options
  )
  select
    v_clinic_id, s.lab_code, s.name_fr, s.name_fr, s.category, s.specimen_type,
    s.collection_container, s.turnaround_time, s.result_type, s.qualitative_options
  from _gr_ix_lab_seed s
  where not exists (
    select 1 from lab_test_catalog cat
    where cat.clinic_id = v_clinic_id
      and (
        cat.lab_code = s.lab_code
        or lower(trim(cat.name_fr)) = lower(trim(s.name_fr))
      )
  );

  -- Activate and price every seeded test. Existing prices are deliberately
  -- replaced by the supplied GRIX LABO price list because this migration is
  -- an explicit catalogue/pricing integration.
  insert into clinic_lab_tests (clinic_id, lab_test_catalog_id, price_xaf, is_active)
  select v_clinic_id, cat.id, s.price_xaf, true
  from _gr_ix_lab_seed s
  join lab_test_catalog cat
    on cat.clinic_id = v_clinic_id
   and cat.lab_code = s.lab_code
  on conflict (clinic_id, lab_test_catalog_id)
  do update set price_xaf = excluded.price_xaf, is_active = true;

  -- If an exact-name row was reused and received the source code above,
  -- the activation query has already handled it. The block is intentionally
  -- idempotent: running migration 140 twice will not create duplicates.
end $$;

comment on column lab_test_catalog.lab_code is
  'Source laboratory test code from the clinic price catalogue (e.g. NFS, CREA, TDR).';
comment on column lab_test_catalog.collection_container is
  'Collection container/material as specified by the clinic laboratory catalogue.';
comment on column lab_test_catalog.turnaround_time is
  'Expected laboratory turnaround time as supplied by the clinic catalogue.';
