-- ============================================================================
-- PROFIT MARGIN, PART 2: THE CALCULATION
--
-- Combines pharmacy dispensing (service_charges, now with product_id/
-- quantity from Part 1) and POS sales (pos_sale_items, which already had
-- the structure needed). Cost basis is the product's CURRENT
-- cost_price_xaf — not the cost at the actual time of sale, since we
-- don't track historical cost changes. This is a reasonable v1
-- approximation, not perfectly time-accurate.
--
-- Critically: reports what SHARE of revenue actually had known cost
-- data, so a clinic that never bothered entering cost_price_xaf on half
-- their products doesn't get shown a confidently-wrong margin number —
-- they get shown a margin number AND a completeness percentage.
-- ============================================================================

create or replace function profit_margin_summary(
  p_clinic_id uuid,
  p_days int default 30
)
returns table (
  total_revenue_xaf numeric,
  known_cost_revenue_xaf numeric,
  total_cost_xaf numeric,
  total_profit_xaf numeric,
  margin_pct numeric,
  data_coverage_pct numeric
)
language plpgsql
stable
as $$
declare
  v_pharmacy_revenue numeric := 0;
  v_pharmacy_known_revenue numeric := 0;
  v_pharmacy_cost numeric := 0;
  v_pos_revenue numeric := 0;
  v_pos_known_revenue numeric := 0;
  v_pos_cost numeric := 0;
  v_total_revenue numeric;
  v_known_revenue numeric;
  v_total_cost numeric;
  v_profit numeric;
begin
  select
    coalesce(sum(sc.amount_xaf), 0),
    coalesce(sum(sc.amount_xaf) filter (where p.cost_price_xaf is not null), 0),
    coalesce(sum(sc.quantity * p.cost_price_xaf) filter (where p.cost_price_xaf is not null), 0)
  into v_pharmacy_revenue, v_pharmacy_known_revenue, v_pharmacy_cost
  from service_charges sc
  left join products p on p.id = sc.product_id
  where sc.clinic_id = p_clinic_id
    and sc.category = 'pharmacy'
    and sc.status <> 'void'
    and sc.service_date >= current_date - p_days;

  select
    coalesce(sum(psi.subtotal_xaf), 0),
    coalesce(sum(psi.subtotal_xaf) filter (where p.cost_price_xaf is not null), 0),
    coalesce(sum(psi.quantity * p.cost_price_xaf) filter (where p.cost_price_xaf is not null), 0)
  into v_pos_revenue, v_pos_known_revenue, v_pos_cost
  from pos_sale_items psi
  join pos_sales ps on ps.id = psi.pos_sale_id
  left join products p on p.id = psi.product_id
  where ps.clinic_id = p_clinic_id
    and ps.status = 'completed'
    and ps.created_at >= current_date - p_days;

  v_total_revenue := v_pharmacy_revenue + v_pos_revenue;
  v_known_revenue := v_pharmacy_known_revenue + v_pos_known_revenue;
  v_total_cost := v_pharmacy_cost + v_pos_cost;
  v_profit := v_known_revenue - v_total_cost; -- profit only meaningful over the known-cost portion

  total_revenue_xaf := v_total_revenue;
  known_cost_revenue_xaf := v_known_revenue;
  total_cost_xaf := v_total_cost;
  total_profit_xaf := v_profit;
  margin_pct := case when v_known_revenue > 0 then round((v_profit / v_known_revenue) * 100, 1) else null end;
  data_coverage_pct := case when v_total_revenue > 0 then round((v_known_revenue / v_total_revenue) * 100, 1) else null end;

  return next;
end;
$$;
