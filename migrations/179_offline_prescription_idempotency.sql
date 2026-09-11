-- 179_offline_prescription_idempotency.sql
-- Atomic, retry-safe creation of a prescription and its items.
-- Ordering a prescription does NOT dispense medication or decrement stock.
-- Stock is re-validated at synchronization time; stale/insufficient stock blocks review.

create or replace function public.create_prescription_idempotent(
  p_operation_id uuid,
  p_clinic_id uuid,
  p_staff_id uuid,
  p_visit_id uuid,
  p_consultation_id uuid,
  p_items jsonb
)
returns table (
  saved boolean,
  prescription_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saved record;
  v_visit record;
  v_consultation record;
  v_item jsonb;
  v_product record;
  v_prescription_id uuid;
  v_product_id uuid;
  v_freetext text;
  v_quantity int;
  v_duration int;
  v_dose text;
  v_frequency text;
  v_instructions text;
  v_has_item boolean := false;
begin
  if p_operation_id is null then
    raise exception 'Operation ID is required';
  end if;

  if not exists (
    select 1 from public.staff s
    where s.id = p_staff_id
      and s.clinic_id = p_clinic_id
      and s.auth_user_id = auth.uid()
      and s.is_active = true
      and s.role in ('doctor', 'admin')
  ) then
    raise exception 'Staff authorization failed';
  end if;

  select * into v_saved
  from public.offline_mutation_idempotency
  where clinic_id = p_clinic_id
    and operation_id = p_operation_id
  for update;

  if found then
    if v_saved.operation_type <> 'prescription-order' then
      raise exception 'Operation ID is already used for another operation';
    end if;
    return query select true, (v_saved.response->>'prescription_id')::uuid, true;
    return;
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid prescription items data';
  end if;

  select v.* into v_visit
  from public.visits v
  where v.id = p_visit_id
    and v.clinic_id = p_clinic_id
  for update;

  if not found then
    raise exception 'Visit is invalid or belongs to another clinic';
  end if;

  select c.* into v_consultation
  from public.consultations c
  where c.id = p_consultation_id
    and c.visit_id = p_visit_id
    and c.clinic_id = p_clinic_id
  for update;

  if not found then
    raise exception 'Consultation is invalid or belongs to another clinic';
  end if;

  if v_consultation.doctor_id <> p_staff_id and not exists (
    select 1 from public.staff s where s.id = p_staff_id and s.role = 'admin'
  ) then
    raise exception 'Consultation is assigned to another doctor';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'At least one medication is required';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'productId', '')::uuid;
    v_freetext := nullif(trim(v_item->>'freetextName'), '');
    v_quantity := nullif(trim(v_item->>'quantity'), '')::int;
    v_duration := nullif(trim(v_item->>'durationDays'), '')::int;
    v_dose := nullif(trim(v_item->>'dose'), '');
    v_frequency := nullif(trim(v_item->>'frequency'), '');
    v_instructions := nullif(trim(v_item->>'instructions'), '');

    if (v_product_id is null) = (v_freetext is null) then
      raise exception 'Each medication must be either a catalog product or free-text medication';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Medication quantity must be a positive integer';
    end if;
    if v_duration is not null and v_duration <= 0 then
      raise exception 'Medication duration must be a positive integer';
    end if;

    if v_product_id is not null then
      select p.id,
             p.is_active,
             coalesce((
               select sum(batch_quantity_on_hand(b.id))
               from public.batches b
               where b.product_id = p.id and b.status = 'active'
             ), 0)::int as on_hand
        into v_product
      from public.products p
      where p.id = v_product_id
        and p.clinic_id = p_clinic_id
      for update;

      if not found or not v_product.is_active then
        raise exception 'Medication product is invalid or inactive';
      end if;
      if v_product.on_hand < v_quantity then
        raise exception 'Insufficient current stock for prescribed medication';
      end if;
    end if;

    v_has_item := true;
  end loop;

  if not v_has_item then
    raise exception 'At least one medication is required';
  end if;

  insert into public.prescriptions (
    clinic_id, visit_id, consultation_id, doctor_id
  ) values (
    p_clinic_id, p_visit_id, p_consultation_id, p_staff_id
  ) returning id into v_prescription_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'productId', '')::uuid;
    v_freetext := nullif(trim(v_item->>'freetextName'), '');
    v_quantity := nullif(trim(v_item->>'quantity'), '')::int;
    v_duration := nullif(trim(v_item->>'durationDays'), '')::int;
    v_dose := nullif(trim(v_item->>'dose'), '');
    v_frequency := nullif(trim(v_item->>'frequency'), '');
    v_instructions := nullif(trim(v_item->>'instructions'), '');

    insert into public.prescription_items (
      prescription_id,
      product_id,
      drug_name_freetext,
      dose,
      frequency,
      duration_days,
      quantity_prescribed,
      instructions
    ) values (
      v_prescription_id,
      v_product_id,
      v_freetext,
      v_dose,
      v_frequency,
      v_duration,
      v_quantity,
      v_instructions
    );
  end loop;

  insert into public.offline_mutation_idempotency (
    clinic_id, operation_id, operation_type, staff_id, status, response
  ) values (
    p_clinic_id, p_operation_id, 'prescription-order', p_staff_id, 'completed',
    jsonb_build_object('prescription_id', v_prescription_id)
  );

  return query select true, v_prescription_id, false;
end;
$$;

revoke all on function public.create_prescription_idempotent(
  uuid, uuid, uuid, uuid, uuid, jsonb
) from public;
grant execute on function public.create_prescription_idempotent(
  uuid, uuid, uuid, uuid, uuid, jsonb
) to authenticated;
