-- ============================================================================
-- SCHEMA SNAPSHOT — generated 2026-07-21T12:55:55.334Z
--
-- This is the CURRENT state of the database, dumped from the live DB.
-- It is the single source of truth for what functions/triggers/tables
-- actually exist right now — not the migration history.
--
-- Regenerate with: npm run snapshot  (after applying migrations)
-- Do NOT edit by hand. Do NOT run this file against a database.
-- ============================================================================

-- ─────────────────────────── ENUM TYPES ───────────────────────────

-- enum admission_status: 'awaiting_bed', 'admitted', 'discharged', 'cancelled'
-- enum bed_status: 'available', 'occupied', 'reserved', 'maintenance'
-- enum discount_status: 'approved', 'pending_approval', 'rejected'
-- enum invoice_status: 'unpaid', 'partial', 'paid', 'cancelled'
-- enum lab_order_item_status: 'pending', 'sample_collected', 'completed', 'cancelled'
-- enum lab_order_item_type: 'panel', 'individual_test', 'external'
-- enum payment_category: 'cash', 'employer_scheme', 'cnps', 'private_insurance'
-- enum payment_method: 'cash', 'momo', 'orange_money', 'mixed', 'deposit', 'insurance'
-- enum po_status: 'draft', 'sent', 'partially_received', 'received', 'cancelled'
-- enum pos_sale_status: 'completed', 'refunded', 'voided'
-- enum prescription_status: 'pending', 'partially_dispensed', 'dispensed', 'cancelled'
-- enum recall_status: 'active', 'resolved'
-- enum service_charge_status: 'pending', 'paid', 'partial', 'void'
-- enum shift_status: 'open', 'closed'
-- enum staff_role: 'admin', 'doctor', 'nurse', 'pharmacist', 'lab_technician', 'receptionist', 'billing_clerk', 'auditor'
-- enum stock_movement_type: 'receipt', 'dispense', 'sale', 'adjustment', 'return_to_supplier', 'quarantine', 'release_from_quarantine', 'adjustment_increase'
-- enum subscription_plan: 'starter', 'standard', 'pro'
-- enum subscription_status: 'trial', 'active', 'past_due', 'suspended', 'cancelled'
-- enum supplier_invoice_status: 'unpaid', 'partial', 'paid'
-- enum template_category: 'illness', 'annual_physical', 'antenatal', 'well_child'
-- enum visit_status: 'registered', 'triage', 'waiting_consultation', 'in_consultation', 'waiting_lab', 'waiting_pharmacy', 'billing', 'discharged', 'admitted', 'cancelled'

-- ─────────────────────────── TABLES ───────────────────────────

-- TABLE admission_transfers
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   admission_id uuid NOT NULL
--   from_ward_id uuid
--   from_bed_id uuid
--   to_ward_id uuid NOT NULL
--   to_bed_id uuid NOT NULL
--   reason text NOT NULL
--   transferred_by uuid
--   transferred_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE admissions
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   admission_number text
--   patient_id uuid NOT NULL
--   visit_id uuid NOT NULL
--   source text NOT NULL DEFAULT 'doctor'::text
--   status USER-DEFINED NOT NULL DEFAULT 'awaiting_bed'::admission_status
--   admission_reason text
--   recommended_by uuid
--   recommended_at timestamp with time zone NOT NULL DEFAULT now()
--   ward_id uuid
--   bed_id uuid
--   bed_assigned_by uuid
--   bed_assigned_at timestamp with time zone
--   discharge_summary text
--   discharged_by uuid
--   discharged_at timestamp with time zone
--   discharge_type text
--   discharge_outcome text

-- TABLE app_settings
--   clinic_id uuid NOT NULL
--   discount_auto_approve_max_xaf numeric NOT NULL DEFAULT 5000
--   updated_at timestamp with time zone NOT NULL DEFAULT now()
--   shift_variance_review_threshold_xaf numeric NOT NULL DEFAULT 2000

-- TABLE appointments
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   patient_id uuid NOT NULL
--   doctor_id uuid
--   service_price_id uuid
--   scheduled_at timestamp with time zone NOT NULL
--   duration_minutes integer NOT NULL DEFAULT 30
--   reason text
--   status text NOT NULL DEFAULT 'scheduled'::text
--   visit_id uuid
--   cancelled_reason text
--   created_by uuid NOT NULL
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   reminder_called_at timestamp with time zone
--   reminder_called_by uuid
--   reminder_outcome text

-- TABLE audit_log
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   staff_id uuid
--   action text NOT NULL
--   entity_type text NOT NULL
--   entity_id uuid
--   details jsonb
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE batch_recalls
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   batch_id uuid NOT NULL
--   initiated_by uuid
--   reason text NOT NULL
--   status USER-DEFINED NOT NULL DEFAULT 'active'::recall_status
--   initiated_at timestamp with time zone NOT NULL DEFAULT now()
--   resolved_by uuid
--   resolved_at timestamp with time zone
--   resolution_notes text

-- TABLE batches
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   product_id uuid NOT NULL
--   batch_number text NOT NULL
--   expiry_date date NOT NULL
--   quantity_received integer NOT NULL
--   unit_cost_xaf numeric
--   supplier_id uuid
--   status text NOT NULL DEFAULT 'active'::text
--   received_at timestamp with time zone NOT NULL DEFAULT now()
--   received_by uuid

-- TABLE beds
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   ward_id uuid NOT NULL
--   bed_number text NOT NULL
--   status USER-DEFINED NOT NULL DEFAULT 'available'::bed_status
--   is_active boolean NOT NULL DEFAULT true
--   bed_type text

-- TABLE care_tasks
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   admission_id uuid NOT NULL
--   task_description text NOT NULL
--   completed_by uuid
--   completed_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE cashier_shifts
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   staff_id uuid NOT NULL
--   opening_cash_xaf numeric NOT NULL
--   closing_cash_xaf numeric
--   expected_cash_xaf numeric
--   variance_xaf numeric
--   status USER-DEFINED NOT NULL DEFAULT 'open'::shift_status
--   notes text
--   opened_at timestamp with time zone NOT NULL DEFAULT now()
--   closed_at timestamp with time zone
--   requires_review boolean NOT NULL DEFAULT false
--   reviewed_by uuid
--   reviewed_at timestamp with time zone
--   review_notes text

-- TABLE clinic_lab_panels
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   lab_panel_id uuid NOT NULL
--   price_xaf numeric NOT NULL
--   is_active boolean NOT NULL DEFAULT true

-- TABLE clinic_lab_tests
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   lab_test_catalog_id uuid NOT NULL
--   price_xaf numeric NOT NULL
--   is_active boolean NOT NULL DEFAULT true
--   override_reference_range_low numeric
--   override_reference_range_high numeric
--   override_critical_low numeric
--   override_critical_high numeric
--   override_abnormal_qualitative_values ARRAY
--   override_critical_qualitative_values ARRAY

-- TABLE clinical_thresholds
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid
--   vital_key text NOT NULL
--   comparator text NOT NULL
--   threshold_value numeric NOT NULL
--   severity text NOT NULL
--   flag_message_fr text NOT NULL
--   flag_message_en text NOT NULL
--   is_active boolean NOT NULL DEFAULT true

-- TABLE clinics
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   name text NOT NULL
--   name_fr text
--   slug text NOT NULL
--   city text NOT NULL
--   quartier text
--   region text
--   phone text
--   whatsapp_number text
--   momo_number text
--   orange_money_number text
--   default_language text NOT NULL DEFAULT 'fr'::text
--   moh_facility_code text
--   subscription_plan USER-DEFINED NOT NULL DEFAULT 'starter'::subscription_plan
--   subscription_status USER-DEFINED NOT NULL DEFAULT 'trial'::subscription_status
--   trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval)
--   monthly_fee_xaf integer NOT NULL DEFAULT 25000
--   billing_notes text
--   onboarded_by uuid
--   suspended_reason text
--   is_active boolean NOT NULL DEFAULT true
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   nursing_daily_rate_xaf numeric

-- TABLE consultation_templates
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid
--   category USER-DEFINED NOT NULL
--   name_fr text NOT NULL
--   name_en text NOT NULL
--   age_group_label text
--   subjective_prompt text
--   objective_prompt text
--   assessment_prompt text
--   plan_prompt text
--   suggested_icd10_code text
--   is_active boolean NOT NULL DEFAULT true
--   subjective_prompt_en text
--   objective_prompt_en text
--   assessment_prompt_en text
--   plan_prompt_en text

-- TABLE consultations
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   visit_id uuid NOT NULL
--   doctor_id uuid
--   chief_complaint text
--   examination_notes text
--   diagnosis text
--   diagnosis_code text
--   treatment_plan text
--   requires_lab boolean NOT NULL DEFAULT false
--   requires_prescription boolean NOT NULL DEFAULT false
--   started_at timestamp with time zone NOT NULL DEFAULT now()
--   completed_at timestamp with time zone
--   subjective_notes text

-- TABLE controlled_drug_review_thresholds
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid
--   drug_class_id uuid NOT NULL
--   review_threshold_quantity integer NOT NULL
--   is_active boolean NOT NULL DEFAULT true

-- TABLE discounts
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   service_charge_id uuid NOT NULL
--   requested_by uuid
--   discount_amount_xaf numeric NOT NULL
--   reason text NOT NULL
--   status USER-DEFINED NOT NULL DEFAULT 'pending_approval'::discount_status
--   approved_by uuid
--   approved_at timestamp with time zone
--   rejected_reason text
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE dispensing_records
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   prescription_item_id uuid NOT NULL
--   quantity_dispensed integer NOT NULL
--   dispensed_by uuid
--   witness_id uuid
--   batch_allocations jsonb
--   dispensed_at timestamp with time zone NOT NULL DEFAULT now()
--   service_charge_id uuid
--   prescription_id uuid
--   unit_price_xaf numeric
--   total_price_xaf numeric
--   product_id uuid

-- TABLE drug_classes
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   name text NOT NULL
--   name_fr text
--   is_controlled boolean NOT NULL DEFAULT false
--   name_en text
--   is_antibiotic boolean NOT NULL DEFAULT false

-- TABLE external_referrals
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   visit_id uuid NOT NULL
--   consultation_id uuid
--   patient_id uuid NOT NULL
--   referred_by uuid NOT NULL
--   specialist_name text
--   specialty text NOT NULL
--   facility_name text
--   facility_address text
--   urgency text NOT NULL DEFAULT 'routine'::text
--   reason text NOT NULL
--   clinical_summary text
--   specific_request text
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE goods_receipt_items
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   goods_receipt_id uuid NOT NULL
--   product_id uuid NOT NULL
--   batch_id uuid NOT NULL
--   quantity integer NOT NULL
--   unit_cost_xaf numeric

-- TABLE goods_receipts
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   supplier_id uuid
--   received_by uuid
--   received_at timestamp with time zone NOT NULL DEFAULT now()
--   invoice_reference text
--   notes text
--   purchase_order_id uuid

-- TABLE icd10_codes
--   code text NOT NULL
--   description_fr text NOT NULL
--   description_en text NOT NULL
--   category text NOT NULL

-- TABLE inpatient_daily_accruals
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   admission_id uuid NOT NULL
--   clinic_id uuid NOT NULL
--   accrual_date date NOT NULL
--   room_charge_id uuid
--   nursing_charge_id uuid
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE inpatient_notes
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   admission_id uuid NOT NULL
--   recorded_by uuid
--   note text NOT NULL
--   recorded_at timestamp with time zone NOT NULL DEFAULT now()
--   round_type text DEFAULT 'doctor_round'::text

-- TABLE insurance_claim_items
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   claim_id uuid NOT NULL
--   service_charge_id uuid NOT NULL
--   amount_xaf numeric NOT NULL

-- TABLE insurance_claims
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   insurer_id uuid NOT NULL
--   claim_number text
--   status text NOT NULL DEFAULT 'draft'::text
--   total_claimed_xaf numeric NOT NULL DEFAULT 0
--   total_approved_xaf numeric
--   submitted_at timestamp with time zone
--   submitted_by uuid
--   notes text
--   created_by uuid
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE insurers
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   name text NOT NULL
--   payer_type text NOT NULL
--   coverage_percentage numeric NOT NULL
--   contact_name text
--   phone text
--   email text
--   address text
--   is_active boolean NOT NULL DEFAULT true

-- TABLE invoice_items
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   invoice_id uuid NOT NULL
--   service_charge_id uuid NOT NULL
--   amount_xaf numeric NOT NULL

-- TABLE invoices
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   patient_id uuid NOT NULL
--   visit_id uuid
--   invoice_number text NOT NULL
--   total_amount_xaf numeric NOT NULL DEFAULT 0
--   amount_paid_xaf numeric NOT NULL DEFAULT 0
--   status USER-DEFINED NOT NULL DEFAULT 'unpaid'::invoice_status
--   created_by uuid
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE lab_order_items
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   lab_order_id uuid NOT NULL
--   clinic_id uuid NOT NULL
--   item_type USER-DEFINED NOT NULL
--   lab_panel_id uuid
--   lab_test_catalog_id uuid
--   external_test_name text
--   service_charge_id uuid
--   status USER-DEFINED NOT NULL DEFAULT 'pending'::lab_order_item_status
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE lab_orders
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   visit_id uuid NOT NULL
--   ordered_by uuid
--   ordered_at timestamp with time zone NOT NULL DEFAULT now()
--   notes text

-- TABLE lab_panel_items
--   panel_id uuid NOT NULL
--   lab_test_catalog_id uuid NOT NULL

-- TABLE lab_panels
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   name_fr text NOT NULL
--   name_en text NOT NULL
--   category text NOT NULL
--   clinic_id uuid NOT NULL

-- TABLE lab_result_attachments
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   lab_order_item_id uuid NOT NULL
--   file_path text NOT NULL
--   file_type text
--   uploaded_by uuid
--   uploaded_at timestamp with time zone NOT NULL DEFAULT now()
--   caption text

-- TABLE lab_results
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   lab_order_item_id uuid NOT NULL
--   lab_test_catalog_id uuid NOT NULL
--   numeric_value numeric
--   qualitative_value text
--   reference_range_low numeric
--   reference_range_high numeric
--   critical_low numeric
--   critical_high numeric
--   is_abnormal boolean NOT NULL DEFAULT false
--   is_critical boolean NOT NULL DEFAULT false
--   recorded_by uuid
--   recorded_at timestamp with time zone NOT NULL DEFAULT now()
--   verified_by uuid
--   verified_at timestamp with time zone
--   notes text
--   acknowledged_by uuid
--   acknowledged_at timestamp with time zone

-- TABLE lab_test_catalog
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   name_fr text NOT NULL
--   name_en text NOT NULL
--   category text NOT NULL
--   specimen_type text
--   unit text
--   result_type text NOT NULL
--   reference_range_low numeric
--   reference_range_high numeric
--   critical_low numeric
--   critical_high numeric
--   qualitative_options ARRAY
--   abnormal_qualitative_values ARRAY
--   critical_qualitative_values ARRAY
--   clinic_id uuid NOT NULL

-- TABLE medication_administrations
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   prescription_item_id uuid NOT NULL
--   admission_id uuid NOT NULL
--   administered_by uuid
--   administered_at timestamp with time zone NOT NULL DEFAULT now()
--   status text NOT NULL DEFAULT 'administered'::text
--   notes text

-- TABLE patient_deposit_ledger
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   patient_id uuid NOT NULL
--   entry_type text NOT NULL
--   amount_xaf numeric NOT NULL
--   invoice_id uuid
--   payment_id uuid
--   method text
--   staff_id uuid
--   notes text
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE patient_insurance
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   patient_id uuid NOT NULL
--   insurer_id uuid NOT NULL
--   policy_number text NOT NULL
--   policyholder_name text
--   relationship text NOT NULL DEFAULT 'self'::text
--   coverage_start_date date NOT NULL DEFAULT CURRENT_DATE
--   coverage_end_date date
--   is_active boolean NOT NULL DEFAULT true
--   created_by uuid
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE patients
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   patient_code text NOT NULL
--   full_name text NOT NULL
--   date_of_birth date
--   estimated_age integer
--   sex text
--   national_id_number text
--   phone text
--   phone_secondary text
--   quartier text
--   city text
--   region text
--   next_of_kin_name text
--   next_of_kin_phone text
--   next_of_kin_relationship text
--   payment_category USER-DEFINED NOT NULL DEFAULT 'cash'::payment_category
--   insurance_provider_id uuid
--   allergies text
--   chronic_conditions text
--   blood_group text
--   status text NOT NULL DEFAULT 'active'::text
--   created_by uuid
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   updated_at timestamp with time zone NOT NULL DEFAULT now()
--   estimated_age_recorded_at date NOT NULL DEFAULT CURRENT_DATE

-- TABLE payment_allocations
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   payment_id uuid NOT NULL
--   service_charge_id uuid NOT NULL
--   amount_xaf numeric NOT NULL

-- TABLE payment_splits
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   payment_id uuid NOT NULL
--   method USER-DEFINED NOT NULL
--   amount_xaf numeric NOT NULL
--   provider_transaction_ref text

-- TABLE payments
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   invoice_id uuid
--   patient_id uuid NOT NULL
--   total_amount_xaf numeric NOT NULL
--   received_by uuid
--   status text NOT NULL DEFAULT 'completed'::text
--   reversed_reason text
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   cashier_shift_id uuid

-- TABLE platform_admins
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   auth_user_id uuid NOT NULL
--   full_name text NOT NULL
--   access_level text NOT NULL DEFAULT 'support'::text
--   is_active boolean NOT NULL DEFAULT true
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE pos_sale_items
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   pos_sale_id uuid NOT NULL
--   product_id uuid NOT NULL
--   quantity integer NOT NULL
--   unit_price_xaf numeric NOT NULL
--   subtotal_xaf numeric NOT NULL

-- TABLE pos_sales
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   patient_id uuid
--   sold_by uuid
--   payment_method USER-DEFINED NOT NULL
--   total_amount_xaf numeric NOT NULL
--   status USER-DEFINED NOT NULL DEFAULT 'completed'::pos_sale_status
--   voided_reason text
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE prescription_items
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   prescription_id uuid NOT NULL
--   product_id uuid
--   drug_name_freetext text
--   strength text
--   dose text
--   frequency text
--   route text
--   duration_days integer
--   quantity_prescribed integer NOT NULL
--   quantity_dispensed integer NOT NULL DEFAULT 0
--   instructions text
--   dispensing_notes text

-- TABLE prescriptions
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   visit_id uuid NOT NULL
--   consultation_id uuid
--   doctor_id uuid
--   status USER-DEFINED NOT NULL DEFAULT 'pending'::prescription_status
--   notes text
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   requires_review boolean NOT NULL DEFAULT false
--   reviewed_by uuid
--   reviewed_at timestamp with time zone
--   review_notes text

-- TABLE product_templates
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   name text NOT NULL
--   name_fr text
--   dosage_form text
--   unit text
--   drug_class_id uuid
--   requires_review boolean NOT NULL DEFAULT false
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE products
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   name text NOT NULL
--   name_fr text
--   drug_class_id uuid
--   form text
--   strength text
--   unit text NOT NULL DEFAULT 'unit'::text
--   reorder_threshold integer NOT NULL DEFAULT 10
--   cost_price_xaf numeric
--   sale_price_xaf numeric NOT NULL
--   is_active boolean NOT NULL DEFAULT true
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   barcode text
--   sku text
--   dosage_form text

-- TABLE purchase_order_items
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   purchase_order_id uuid NOT NULL
--   product_id uuid NOT NULL
--   quantity_ordered integer NOT NULL
--   unit_cost_xaf numeric
--   quantity_received integer NOT NULL DEFAULT 0

-- TABLE purchase_orders
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   supplier_id uuid NOT NULL
--   created_by uuid
--   status USER-DEFINED NOT NULL DEFAULT 'draft'::po_status
--   order_date timestamp with time zone NOT NULL DEFAULT now()
--   expected_delivery_date date
--   notes text

-- TABLE schema_migrations
--   filename text NOT NULL
--   applied_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE service_charges
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   patient_id uuid NOT NULL
--   visit_id uuid
--   service_price_id uuid
--   category text NOT NULL
--   description text NOT NULL
--   amount_xaf numeric NOT NULL
--   amount_paid_xaf numeric NOT NULL DEFAULT 0
--   status USER-DEFINED NOT NULL DEFAULT 'pending'::service_charge_status
--   service_date date NOT NULL DEFAULT (timezone('Africa/Douala'::text, now()))::date
--   created_by uuid
--   voided_reason text
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   product_id uuid
--   quantity integer
--   insurer_id uuid
--   insurer_portion_xaf numeric
--   patient_portion_xaf numeric
--   updated_at timestamp with time zone DEFAULT now()

-- TABLE service_prices
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   service_code text NOT NULL
--   service_name text NOT NULL
--   service_name_fr text
--   category text NOT NULL
--   price_xaf numeric NOT NULL
--   is_active boolean NOT NULL DEFAULT true

-- TABLE staff
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   auth_user_id uuid NOT NULL
--   full_name text NOT NULL
--   role USER-DEFINED NOT NULL
--   phone text
--   license_number text
--   preferred_language text NOT NULL DEFAULT 'fr'::text
--   is_active boolean NOT NULL DEFAULT true
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE stock_movements
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   batch_id uuid NOT NULL
--   movement_type USER-DEFINED NOT NULL
--   quantity integer NOT NULL
--   reference_type text
--   reference_id uuid
--   reason text
--   performed_by uuid
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   dispensing_record_id uuid
--   notes text
--   created_by uuid

-- TABLE supplier_invoices
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   supplier_id uuid NOT NULL
--   purchase_order_id uuid
--   invoice_number text
--   invoice_date date NOT NULL DEFAULT CURRENT_DATE
--   due_date date
--   total_amount_xaf numeric NOT NULL
--   amount_paid_xaf numeric NOT NULL DEFAULT 0
--   status USER-DEFINED NOT NULL DEFAULT 'unpaid'::supplier_invoice_status
--   created_by uuid
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE supplier_payments
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   supplier_invoice_id uuid NOT NULL
--   amount_xaf numeric NOT NULL
--   payment_method text
--   reference text
--   paid_by uuid
--   paid_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE supplier_returns
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   supplier_id uuid NOT NULL
--   batch_id uuid NOT NULL
--   quantity integer NOT NULL
--   reason text NOT NULL
--   created_by uuid
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE suppliers
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   name text NOT NULL
--   contact_name text
--   phone text
--   email text
--   address text
--   payment_terms_days integer DEFAULT 0
--   is_active boolean NOT NULL DEFAULT true
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE support_access_grants
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   platform_admin_id uuid NOT NULL
--   reason text NOT NULL
--   granted_at timestamp with time zone NOT NULL DEFAULT now()
--   expires_at timestamp with time zone NOT NULL DEFAULT (now() + '04:00:00'::interval)
--   revoked_at timestamp with time zone

-- TABLE triage_assessments
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   visit_id uuid NOT NULL
--   recorded_by uuid
--   chief_complaint text
--   medical_history text
--   social_history text
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE visit_status_events
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   visit_id uuid NOT NULL
--   from_status text
--   to_status text NOT NULL
--   changed_at timestamp with time zone NOT NULL DEFAULT now()
--   assigned_doctor_id uuid

-- TABLE visits
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   patient_id uuid NOT NULL
--   visit_reason text
--   status USER-DEFINED NOT NULL DEFAULT 'registered'::visit_status
--   registered_by uuid
--   assigned_doctor_id uuid
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   updated_at timestamp with time zone NOT NULL DEFAULT now()
--   is_emergency boolean NOT NULL DEFAULT false
--   emergency_reason text
--   emergency_flagged_by uuid
--   emergency_flagged_at timestamp with time zone
--   triage_priority text NOT NULL DEFAULT 'routine'::text
--   priority_note text
--   priority_flagged_by uuid
--   priority_flagged_at timestamp with time zone

-- TABLE vital_signs
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   admission_id uuid NOT NULL
--   recorded_by uuid
--   recorded_at timestamp with time zone NOT NULL DEFAULT now()
--   blood_pressure_systolic integer
--   blood_pressure_diastolic integer
--   heart_rate integer
--   temperature_celsius numeric
--   respiratory_rate integer
--   oxygen_saturation integer
--   notes text

-- TABLE vitals
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   visit_id uuid NOT NULL
--   recorded_by uuid
--   systolic_bp integer
--   diastolic_bp integer
--   pulse integer
--   temperature numeric
--   spo2 integer
--   respiratory_rate integer
--   weight_kg numeric
--   height_cm numeric
--   flags jsonb NOT NULL DEFAULT '[]'::jsonb
--   recorded_at timestamp with time zone NOT NULL DEFAULT now()

-- TABLE wards
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   clinic_id uuid NOT NULL
--   name text NOT NULL
--   is_active boolean NOT NULL DEFAULT true
--   code text
--   ward_type text
--   capacity integer
--   daily_rate_xaf numeric

-- ─────────────────────── FUNCTIONS (CURRENT) ───────────────────────
-- These are the LIVE definitions. If a function was redefined across
-- several migrations, only the current version appears here.

-- FUNCTION: accrue_nightly_inpatient_charges
CREATE OR REPLACE FUNCTION public.accrue_nightly_inpatient_charges(p_run_by uuid DEFAULT NULL::uuid)
 RETURNS TABLE(admission_id uuid, clinic_id uuid, room_charge_id uuid, nursing_charge_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admission record;
  v_ward record;
  v_clinic record;
  v_accrual_id uuid;
  v_room_charge_id uuid;
  v_nursing_charge_id uuid;
  v_run_by uuid;
  v_today date := current_date;
begin
  for v_admission in
    select * from admissions where status = 'admitted'
  loop
    v_room_charge_id := null;
    v_nursing_charge_id := null;

    -- Idempotency: the unique constraint is the real guard (safe even
    -- against a concurrent/retried run); the ON CONFLICT just makes
    -- "already accrued today" a cheap no-op instead of an error.
    insert into inpatient_daily_accruals (admission_id, clinic_id, accrual_date)
    values (v_admission.id, v_admission.clinic_id, v_today)
    on conflict (admission_id, accrual_date) do nothing
    returning id into v_accrual_id;

    if v_accrual_id is null then
      continue; -- already billed for tonight
    end if;

    v_run_by := p_run_by;
    if v_run_by is null then
      select id into v_run_by from staff
        where staff.clinic_id = v_admission.clinic_id and role = 'admin' and is_active = true
        order by created_at asc limit 1;
    end if;

    if v_run_by is null then
      -- No active admin to attribute the charge to (shouldn't happen —
      -- the Admin module blocks deactivating a clinic's last admin —
      -- but skip rather than fail the whole run for every other clinic).
      raise warning 'No active admin found for clinic % — skipping nightly accrual for admission %', v_admission.clinic_id, v_admission.id;
      continue;
    end if;

    if v_admission.ward_id is not null then
      select * into v_ward from wards where id = v_admission.ward_id;
      if v_ward.daily_rate_xaf is not null and v_ward.daily_rate_xaf > 0 then
        v_room_charge_id := create_service_charge(
          v_admission.clinic_id, v_admission.patient_id, v_admission.visit_id, null, 'admission',
          'Frais de chambre — ' || v_ward.name || ' (' || to_char(v_today, 'DD/MM/YYYY') || ')',
          v_ward.daily_rate_xaf, v_run_by
        );
        perform open_invoice_for_charge(v_room_charge_id, v_run_by);
      end if;
    end if;

    select * into v_clinic from clinics where id = v_admission.clinic_id;
    if v_clinic.nursing_daily_rate_xaf is not null and v_clinic.nursing_daily_rate_xaf > 0 then
      v_nursing_charge_id := create_service_charge(
        v_admission.clinic_id, v_admission.patient_id, v_admission.visit_id, null, 'admission',
        'Soins infirmiers — forfait journalier (' || to_char(v_today, 'DD/MM/YYYY') || ')',
        v_clinic.nursing_daily_rate_xaf, v_run_by
      );
      perform open_invoice_for_charge(v_nursing_charge_id, v_run_by);
    end if;

    update inpatient_daily_accruals
      set room_charge_id = v_room_charge_id, nursing_charge_id = v_nursing_charge_id
      where id = v_accrual_id;

    admission_id := v_admission.id;
    clinic_id := v_admission.clinic_id;
    room_charge_id := v_room_charge_id;
    nursing_charge_id := v_nursing_charge_id;
    return next;
  end loop;
end;
$function$
;

-- FUNCTION: acknowledge_critical_result
CREATE OR REPLACE FUNCTION public.acknowledge_critical_result(p_clinic_id uuid, p_result_id uuid, p_acknowledged_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if not exists (select 1 from lab_results where id = p_result_id and clinic_id = p_clinic_id) then
    raise exception 'Result does not belong to this clinic';
  end if;

  update lab_results set acknowledged_by = p_acknowledged_by, acknowledged_at = now()
  where id = p_result_id;
end;
$function$
;

-- FUNCTION: add_manual_charge
CREATE OR REPLACE FUNCTION public.add_manual_charge(p_clinic_id uuid, p_patient_id uuid, p_description text, p_amount_xaf numeric, p_created_by uuid, p_visit_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_charge_id uuid;
  v_invoice_id uuid;
  v_creator_role staff_role;
begin
  select role into v_creator_role from staff
    where id = p_created_by and clinic_id = p_clinic_id and is_active = true;
  if v_creator_role is null then
    raise exception 'Staff member not found or inactive in this clinic';
  end if;
  if v_creator_role not in ('admin', 'receptionist', 'billing_clerk') then
    raise exception 'Only admin, receptionist, or billing staff can add a manual charge, got %', v_creator_role;
  end if;

  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  if p_description is null or trim(p_description) = '' then
    raise exception 'A description is required for a manual charge';
  end if;
  if p_amount_xaf is null or p_amount_xaf <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if p_visit_id is not null and not exists (
    select 1 from visits where id = p_visit_id and clinic_id = p_clinic_id and patient_id = p_patient_id
  ) then
    raise exception 'Visit does not belong to this patient in this clinic';
  end if;

  v_charge_id := create_service_charge(
    p_clinic_id, p_patient_id, p_visit_id, null, 'other', p_description, p_amount_xaf, p_created_by
  );

  v_invoice_id := open_invoice_for_charge(v_charge_id, p_created_by);

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_created_by, 'billing.manual_charge_added', 'service_charge', v_charge_id,
    jsonb_build_object('description', p_description, 'amount_xaf', p_amount_xaf, 'visit_id', p_visit_id));

  return v_charge_id;
end;
$function$
;

-- FUNCTION: admission_reports_summary
CREATE OR REPLACE FUNCTION public.admission_reports_summary(p_clinic_id uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(total_admissions bigint, avg_length_of_stay_days numeric, routine_discharges bigint, transfer_out_discharges bigint, ama_discharges bigint, deceased_discharges bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select
    count(*) filter (where recommended_at >= current_date - p_days),
    round(avg(extract(epoch from (discharged_at - bed_assigned_at)) / 86400) filter (
      where discharged_at is not null and bed_assigned_at is not null and discharged_at >= current_date - p_days
    ), 1),
    count(*) filter (where discharge_type = 'routine' and discharged_at >= current_date - p_days),
    count(*) filter (where discharge_type = 'transfer_out' and discharged_at >= current_date - p_days),
    count(*) filter (where discharge_type = 'against_medical_advice' and discharged_at >= current_date - p_days),
    count(*) filter (where discharge_type = 'deceased' and discharged_at >= current_date - p_days)
  from admissions
  where clinic_id = p_clinic_id
$function$
;

-- FUNCTION: admissions_daily_count
CREATE OR REPLACE FUNCTION public.admissions_daily_count(p_clinic_id uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(report_date date, admission_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select
    d.report_date,
    coalesce(a.cnt, 0)
  from (
    select generate_series(current_date - (p_days - 1), current_date, '1 day')::date as report_date
  ) d
  left join (
    select date(timezone('Africa/Douala', recommended_at)) as day, count(*) as cnt
    from admissions
    where clinic_id = p_clinic_id
    group by date(timezone('Africa/Douala', recommended_at))
  ) a on a.day = d.report_date
  order by d.report_date desc
$function$
;

-- FUNCTION: advance_past_reception
CREATE OR REPLACE FUNCTION public.advance_past_reception(p_visit_id uuid, p_staff_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_visit record;
  v_charge record;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'registered' then
    raise exception 'Visit is not in registered status (currently: %)', v_visit.status;
  end if;

  if not v_visit.is_emergency then
    select * into v_charge from service_charges
      where visit_id = p_visit_id and category = 'consultation' and status <> 'void'
      order by created_at desc limit 1;

    if v_charge.id is null then
      raise exception 'No consultation charge found for this visit — cannot proceed without one';
    end if;
    if v_charge.status <> 'paid' then
      raise exception 'Consultation charge is not fully paid (status: %). Collect payment, or flag this visit as emergency.', v_charge.status;
    end if;
  end if;

  update visits set status = 'triage' where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_visit.clinic_id, p_staff_id, 'visit.advanced_past_reception', 'visit', p_visit_id,
    jsonb_build_object('was_emergency', v_visit.is_emergency));
end;
$function$
;

-- FUNCTION: apply_deposit_to_invoice
CREATE OR REPLACE FUNCTION public.apply_deposit_to_invoice(p_clinic_id uuid, p_patient_id uuid, p_invoice_id uuid, p_amount_xaf numeric, p_applied_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_available numeric;
  v_payment_id uuid;
begin
  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;
  if not exists (select 1 from invoices where id = p_invoice_id and clinic_id = p_clinic_id and patient_id = p_patient_id) then
    raise exception 'Invoice does not belong to this patient in this clinic';
  end if;
  if p_amount_xaf <= 0 then
    raise exception 'Amount must be positive';
  end if;

  v_available := get_patient_deposit_balance(p_clinic_id, p_patient_id);
  if p_amount_xaf > v_available then
    raise exception 'Cannot apply % FCFA — only % FCFA available in deposit', p_amount_xaf, v_available;
  end if;

  v_payment_id := create_payment(
    p_invoice_id, p_amount_xaf, p_applied_by,
    jsonb_build_array(jsonb_build_object('method', 'deposit', 'amount', p_amount_xaf, 'provider_transaction_ref', null))
  );

  insert into patient_deposit_ledger (clinic_id, patient_id, entry_type, amount_xaf, invoice_id, payment_id, staff_id)
  values (p_clinic_id, p_patient_id, 'application', p_amount_xaf, p_invoice_id, v_payment_id, p_applied_by);

  return v_payment_id;
end;
$function$
;

-- FUNCTION: apply_insurance_split
CREATE OR REPLACE FUNCTION public.apply_insurance_split()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_coverage record;
begin
  select pi.insurer_id, i.coverage_percentage
    into v_coverage
  from patient_insurance pi
  join insurers i on i.id = pi.insurer_id and i.is_active
  where pi.patient_id = NEW.patient_id
    and pi.is_active
    and pi.coverage_start_date <= coalesce(NEW.service_date, current_date)
    and (pi.coverage_end_date is null or pi.coverage_end_date >= coalesce(NEW.service_date, current_date))
  limit 1;

  if v_coverage.insurer_id is not null then
    NEW.insurer_id := v_coverage.insurer_id;
    NEW.insurer_portion_xaf := round(NEW.amount_xaf * v_coverage.coverage_percentage / 100, 2);
    NEW.patient_portion_xaf := NEW.amount_xaf - NEW.insurer_portion_xaf;
  end if;

  return NEW;
end;
$function$
;

-- FUNCTION: appointment_reminder_list
CREATE OR REPLACE FUNCTION public.appointment_reminder_list(p_clinic_id uuid, p_date date DEFAULT NULL::date)
 RETURNS TABLE(appointment_id uuid, scheduled_at timestamp with time zone, patient_id uuid, patient_name text, patient_phone text, doctor_name text, reason text, reminder_called_at timestamp with time zone, reminder_outcome text)
 LANGUAGE sql
 STABLE
AS $function$
  with target as (
    select coalesce(
      p_date,
      (timezone('Africa/Douala', now()))::date + 1   -- tomorrow by default
    ) as d
  )
  select
    a.id,
    a.scheduled_at,
    p.id,
    p.full_name,
    p.phone,
    s.full_name,
    a.reason,
    a.reminder_called_at,
    a.reminder_outcome
  from appointments a
  join patients p on p.id = a.patient_id
  left join staff s on s.id = a.doctor_id, target
  where a.clinic_id = p_clinic_id
    and a.status = 'scheduled'
    and date(timezone('Africa/Douala', a.scheduled_at)) = target.d
  order by a.scheduled_at asc
$function$
;

-- FUNCTION: approve_discount
CREATE OR REPLACE FUNCTION public.approve_discount(p_discount_id uuid, p_approved_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_discount record;
  v_approver_role staff_role;
begin
  select * into v_discount from discounts where id = p_discount_id for update;
  if v_discount.id is null then
    raise exception 'Discount request % not found', p_discount_id;
  end if;
  if v_discount.status <> 'pending_approval' then
    raise exception 'Discount request % is not pending (status: %)', p_discount_id, v_discount.status;
  end if;
  if v_discount.requested_by = p_approved_by then
    raise exception 'The requester cannot approve their own discount';
  end if;

  select role into v_approver_role from staff
    where id = p_approved_by and clinic_id = v_discount.clinic_id and is_active = true;
  if v_approver_role is null then
    raise exception 'Approver not found or inactive in this clinic';
  end if;
  if v_approver_role <> 'admin' then
    raise exception 'Only an admin can approve a discount above the auto-approval threshold, got %', v_approver_role;
  end if;

  -- Re-check the unpaid balance at approval time — it may have changed
  -- (e.g. a partial payment landed) since the request was made.
  if v_discount.discount_amount_xaf > (
    select amount_xaf - amount_paid_xaf from service_charges where id = v_discount.service_charge_id
  ) then
    raise exception 'This discount no longer fits within the charge''s remaining unpaid balance — the charge may have been partially paid since the request was made';
  end if;

  update service_charges set amount_xaf = amount_xaf - v_discount.discount_amount_xaf
    where id = v_discount.service_charge_id;

  update discounts set status = 'approved', approved_by = p_approved_by, approved_at = now()
    where id = p_discount_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_discount.clinic_id, p_approved_by, 'billing.discount_approved', 'service_charge', v_discount.service_charge_id,
    jsonb_build_object('amount', v_discount.discount_amount_xaf, 'requested_by', v_discount.requested_by));
end;
$function$
;

-- FUNCTION: approve_prescription_review
CREATE OR REPLACE FUNCTION public.approve_prescription_review(p_prescription_id uuid, p_reviewed_by uuid, p_review_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_clinic_id uuid;
  v_reviewer_role staff_role;
  v_prescribing_doctor uuid;
begin
  select clinic_id, doctor_id into v_clinic_id, v_prescribing_doctor
  from prescriptions where id = p_prescription_id;

  if v_clinic_id is null then
    raise exception 'Prescription % not found', p_prescription_id;
  end if;

  select role into v_reviewer_role from staff
    where id = p_reviewed_by and clinic_id = v_clinic_id and is_active = true;

  if v_reviewer_role is null then
    raise exception 'Reviewer not found or inactive in this clinic';
  end if;
  if v_reviewer_role <> 'admin' then
    raise exception 'Only an admin can approve a controlled-substance prescription, got %', v_reviewer_role;
  end if;
  if p_reviewed_by = v_prescribing_doctor then
    raise exception 'The prescribing doctor cannot approve their own controlled-substance prescription';
  end if;

  update prescriptions set
    requires_review = false,
    reviewed_by = p_reviewed_by,
    reviewed_at = now(),
    review_notes = p_review_notes
  where id = p_prescription_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    v_clinic_id, p_reviewed_by, 'prescription.controlled_substance_reviewed', 'prescription', p_prescription_id,
    jsonb_build_object('notes', p_review_notes, 'prescribing_doctor', v_prescribing_doctor)
  );
end;
$function$
;

-- FUNCTION: assign_bed
CREATE OR REPLACE FUNCTION public.assign_bed(p_clinic_id uuid, p_admission_id uuid, p_ward_id uuid, p_bed_id uuid, p_assigned_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_bed_status bed_status;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id) then
    raise exception 'Admission does not belong to this clinic';
  end if;

  select status into v_bed_status from beds
    where id = p_bed_id and ward_id = p_ward_id and clinic_id = p_clinic_id
    for update;

  if v_bed_status is null then
    raise exception 'Bed not found in this ward for this clinic';
  end if;
  if v_bed_status <> 'available' then
    raise exception 'Bed is not available (current status: %)', v_bed_status;
  end if;

  update beds set status = 'occupied' where id = p_bed_id;

  update admissions set
    status = 'admitted',
    ward_id = p_ward_id,
    bed_id = p_bed_id,
    bed_assigned_by = p_assigned_by,
    bed_assigned_at = now()
  where id = p_admission_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_assigned_by, 'admission.bed_assigned', 'admission', p_admission_id,
    jsonb_build_object('ward_id', p_ward_id, 'bed_id', p_bed_id));
end;
$function$
;

-- FUNCTION: auto_close_service_charge
CREATE OR REPLACE FUNCTION public.auto_close_service_charge()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_patient_owes numeric;
begin
  v_patient_owes := coalesce(NEW.patient_portion_xaf, NEW.amount_xaf);

  if NEW.amount_paid_xaf >= v_patient_owes
     and NEW.status not in ('paid', 'void')
  then
    NEW.status := 'paid';
  end if;

  if NEW.amount_paid_xaf = 0 and NEW.status = 'partial' then
    NEW.status := 'pending';
  end if;

  return NEW;
end;
$function$
;

-- FUNCTION: batch_quantity_on_hand
CREATE OR REPLACE FUNCTION public.batch_quantity_on_hand(p_batch_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(sum(
    case
      when movement_type in ('receipt','release_from_quarantine','adjustment_increase') then quantity
      when movement_type in ('dispense','sale','adjustment','quarantine','return_to_supplier') then -quantity
      else 0
    end
  ), 0)
  from stock_movements
  where batch_id = p_batch_id;
$function$
;

-- FUNCTION: bed_occupancy_summary
CREATE OR REPLACE FUNCTION public.bed_occupancy_summary(p_clinic_id uuid)
 RETURNS TABLE(total_beds bigint, available_beds bigint, occupied_beds bigint, reserved_beds bigint, occupancy_pct numeric)
 LANGUAGE sql
 STABLE
AS $function$
  select
    count(*) filter (where is_active),
    count(*) filter (where status = 'available' and is_active),
    count(*) filter (where status = 'occupied' and is_active),
    count(*) filter (where status = 'reserved' and is_active),
    case when count(*) filter (where is_active) > 0
      then round(100.0 * count(*) filter (where status = 'occupied' and is_active) / count(*) filter (where is_active), 0)
      else 0
    end
  from beds
  where clinic_id = p_clinic_id
$function$
;

-- FUNCTION: cashier_queue_summary
CREATE OR REPLACE FUNCTION public.cashier_queue_summary(p_clinic_id uuid)
 RETURNS TABLE(patient_id uuid, patient_name text, patient_code text, item_count bigint, total_xaf numeric, paid_xaf numeric, balance_xaf numeric, has_emergency boolean, invoice_ids uuid[], charges_json jsonb)
 LANGUAGE sql
 STABLE
AS $function$
  select
    p.id,
    p.full_name,
    p.patient_code,
    count(sc.id),
    sum(coalesce(sc.patient_portion_xaf, sc.amount_xaf)),
    sum(sc.amount_paid_xaf),
    sum(coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf),
    bool_or(coalesce(v.is_emergency, false)),
    array_agg(distinct ii.invoice_id) filter (where ii.invoice_id is not null),
    jsonb_agg(
      jsonb_build_object(
        'id',          sc.id,
        'invoice_id',  ii.invoice_id,
        'description', sc.description,
        'category',    sc.category,
        'amount',      coalesce(sc.patient_portion_xaf, sc.amount_xaf),
        'paid',        sc.amount_paid_xaf,
        'balance',     coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf,
        'invoiced',    (ii.invoice_id is not null),
        'visit_date',  v.created_at,
        'visit_status',v.status,
        'insurer_owes',coalesce(sc.insurer_portion_xaf, 0)
      )
      order by sc.created_at asc
    )
  from service_charges sc
  join patients p on p.id = sc.patient_id
  left join visits v on v.id = sc.visit_id
  left join invoice_items ii on ii.service_charge_id = sc.id
  where sc.clinic_id = p_clinic_id
    and sc.status in ('pending', 'partial')
    and coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf > 0
  group by p.id, p.full_name, p.patient_code
  having sum(coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf) > 0
  order by sum(coalesce(sc.patient_portion_xaf, sc.amount_xaf) - sc.amount_paid_xaf) desc
$function$
;

-- FUNCTION: check_clinic_lab_panel_ownership
CREATE OR REPLACE FUNCTION public.check_clinic_lab_panel_ownership()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if not exists (
    select 1 from lab_panels where id = NEW.lab_panel_id and clinic_id = NEW.clinic_id
  ) then
    raise exception 'This panel does not belong to this clinic — cannot activate it here.';
  end if;
  return NEW;
end;
$function$
;

-- FUNCTION: check_clinic_lab_test_ownership
CREATE OR REPLACE FUNCTION public.check_clinic_lab_test_ownership()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if not exists (
    select 1 from lab_test_catalog where id = NEW.lab_test_catalog_id and clinic_id = NEW.clinic_id
  ) then
    raise exception 'This test does not belong to this clinic — cannot activate it here.';
  end if;
  return NEW;
end;
$function$
;

-- FUNCTION: check_lab_panel_item_same_clinic
CREATE OR REPLACE FUNCTION public.check_lab_panel_item_same_clinic()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_panel_clinic uuid;
  v_test_clinic uuid;
begin
  select clinic_id into v_panel_clinic from lab_panels where id = NEW.panel_id;
  select clinic_id into v_test_clinic from lab_test_catalog where id = NEW.lab_test_catalog_id;
  if v_panel_clinic is distinct from v_test_clinic then
    raise exception 'Cannot add a test from a different clinic''s catalog to this panel.';
  end if;
  return NEW;
end;
$function$
;

-- FUNCTION: clinic_daily_revenue
CREATE OR REPLACE FUNCTION public.clinic_daily_revenue(p_clinic_id uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(report_date date, revenue_xaf numeric, transaction_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select
    d.report_date,
    coalesce(rev.revenue, 0) as revenue_xaf,
    coalesce(rev.txns, 0) as transaction_count
  from (
    select generate_series(current_date - (p_days - 1), current_date, '1 day')::date as report_date
  ) d
  left join (
    select day, sum(amount) as revenue, count(*) as txns
    from (
      select date(timezone('Africa/Douala', p.created_at)) as day, p.total_amount_xaf as amount
      from payments p
      where p.clinic_id = p_clinic_id and p.status = 'completed'

      union all

      select date(timezone('Africa/Douala', pos.created_at)) as day, pos.total_amount_xaf as amount
      from pos_sales pos
      where pos.clinic_id = p_clinic_id and pos.status = 'completed'
    ) combined
    group by day
  ) rev on rev.day = d.report_date
  order by d.report_date desc
$function$
;

-- FUNCTION: close_cashier_shift
CREATE OR REPLACE FUNCTION public.close_cashier_shift(p_shift_id uuid, p_closing_cash_xaf numeric, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_shift record;
  v_cash_received numeric(10,2);
  v_expected numeric(10,2);
  v_variance numeric(10,2);
  v_threshold numeric(10,2);
  v_requires_review boolean;
begin
  select * into v_shift from cashier_shifts where id = p_shift_id for update;
  if v_shift.id is null then
    raise exception 'Shift % not found', p_shift_id;
  end if;
  if v_shift.status = 'closed' then
    raise exception 'Shift % is already closed', p_shift_id;
  end if;

  select coalesce(sum(ps.amount_xaf), 0) into v_cash_received
  from payment_splits ps
  join payments p on p.id = ps.payment_id
  where p.cashier_shift_id = p_shift_id and ps.method = 'cash' and p.status = 'completed';

  v_expected := v_shift.opening_cash_xaf + v_cash_received;
  v_variance := p_closing_cash_xaf - v_expected;

  select coalesce(shift_variance_review_threshold_xaf, 2000) into v_threshold
  from app_settings where clinic_id = v_shift.clinic_id;
  if v_threshold is null then
    v_threshold := 2000;
  end if;

  v_requires_review := abs(v_variance) > v_threshold;

  update cashier_shifts set
    closing_cash_xaf = p_closing_cash_xaf,
    expected_cash_xaf = v_expected,
    variance_xaf = v_variance,
    status = 'closed',
    closed_at = now(),
    notes = p_notes,
    requires_review = v_requires_review
  where id = p_shift_id;

  if v_requires_review then
    insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
    values (v_shift.clinic_id, v_shift.staff_id, 'billing.shift_variance_flagged', 'cashier_shift', p_shift_id,
      jsonb_build_object('variance', v_variance, 'threshold', v_threshold));
  end if;

  return jsonb_build_object(
    'opening_cash_xaf', v_shift.opening_cash_xaf,
    'cash_received', v_cash_received,
    'expected_cash_xaf', v_expected,
    'closing_cash_xaf', p_closing_cash_xaf,
    'variance_xaf', v_variance,
    'requires_review', v_requires_review
  );
end;
$function$
;

-- FUNCTION: complete_consultation
CREATE OR REPLACE FUNCTION public.complete_consultation(p_visit_id uuid, p_consultation_id uuid, p_staff_id uuid, p_has_prescription boolean, p_has_lab_order boolean DEFAULT false, p_has_admission boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_visit record;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'in_consultation' then
    raise exception 'Visit is not currently in consultation (status: %)', v_visit.status;
  end if;

  update consultations set completed_at = now() where id = p_consultation_id;

  -- Admission is handled by recommend_admission() separately (it needs
  -- its own reason text and admission-number generation) — this
  -- function just needs to NOT override that status once it's been set.
  -- If p_has_admission is true, recommend_admission() has already run
  -- and set status = 'admitted', so skip the routing logic entirely.
  if not p_has_admission then
    update visits set status = case
      when p_has_lab_order then 'waiting_lab'
      when p_has_prescription then 'waiting_pharmacy'
      else 'discharged'
    end::visit_status
    where id = p_visit_id;
  end if;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_visit.clinic_id, p_staff_id, 'visit.consultation_completed', 'visit', p_visit_id,
    jsonb_build_object('has_prescription', p_has_prescription, 'has_lab_order', p_has_lab_order, 'has_admission', p_has_admission));
end;
$function$
;

-- FUNCTION: complete_lab_order_item
CREATE OR REPLACE FUNCTION public.complete_lab_order_item(p_lab_order_item_id uuid, p_staff_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_has_result boolean;
  v_has_attachment boolean;
  v_visit_id uuid;
  v_clinic_id uuid;
  v_visit_status visit_status;
  v_remaining_in_house_items int;
begin
  select exists(select 1 from lab_results where lab_order_item_id = p_lab_order_item_id) into v_has_result;
  select exists(select 1 from lab_result_attachments where lab_order_item_id = p_lab_order_item_id) into v_has_attachment;

  if not v_has_result and not v_has_attachment then
    raise exception 'Cannot complete: no result value or attachment has been recorded for this item';
  end if;

  update lab_order_items set status = 'completed' where id = p_lab_order_item_id;

  -- Find the visit this item belongs to, and check whether ANY other
  -- in-house item on that same visit (across all its lab orders) is
  -- still unresolved. External items are excluded from this count on
  -- purpose — see the header comment.
  select lo.visit_id, lo.clinic_id into v_visit_id, v_clinic_id
  from lab_order_items loi
  join lab_orders lo on lo.id = loi.lab_order_id
  where loi.id = p_lab_order_item_id;

  select status into v_visit_status from visits where id = v_visit_id;

  if v_visit_status = 'waiting_lab' then
    select count(*) into v_remaining_in_house_items
    from lab_order_items loi
    join lab_orders lo on lo.id = loi.lab_order_id
    where lo.visit_id = v_visit_id
      and loi.item_type <> 'external'
      and loi.status not in ('completed', 'cancelled');

    if v_remaining_in_house_items = 0 then
      update visits set status = 'waiting_consultation' where id = v_visit_id;

      insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
      values (v_clinic_id, p_staff_id, 'visit.returned_to_doctor_after_lab', 'visit', v_visit_id, '{}'::jsonb);
    end if;
  end if;
end;
$function$
;

-- FUNCTION: complete_triage
CREATE OR REPLACE FUNCTION public.complete_triage(p_visit_id uuid, p_staff_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_visit record;
  v_has_vitals boolean;
  v_has_assessment boolean;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'triage' then
    raise exception 'Visit is not in triage status (currently: %)', v_visit.status;
  end if;

  select exists(select 1 from vitals where visit_id = p_visit_id) into v_has_vitals;
  select exists(select 1 from triage_assessments where visit_id = p_visit_id) into v_has_assessment;

  if not v_has_vitals then
    raise exception 'Cannot complete triage: no vitals have been recorded for this visit';
  end if;
  if not v_has_assessment then
    raise exception 'Cannot complete triage: no assessment (chief complaint/history) has been recorded';
  end if;

  update visits set status = 'waiting_consultation' where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_visit.clinic_id, p_staff_id, 'visit.triage_completed', 'visit', p_visit_id, '{}'::jsonb);
end;
$function$
;

-- FUNCTION: compliance_pending_summary
CREATE OR REPLACE FUNCTION public.compliance_pending_summary(p_clinic_id uuid)
 RETURNS TABLE(pending_prescription_reviews bigint, pending_shift_variance_reviews bigint, pending_discount_approvals bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select
    (select count(*) from prescriptions where clinic_id = p_clinic_id and requires_review = true),
    (select count(*) from cashier_shifts where clinic_id = p_clinic_id and requires_review = true),
    (select count(*) from discounts where clinic_id = p_clinic_id and status = 'pending_approval')
$function$
;

-- FUNCTION: create_direct_admission
CREATE OR REPLACE FUNCTION public.create_direct_admission(p_clinic_id uuid, p_patient_id uuid, p_admission_reason text, p_created_by uuid, p_source text DEFAULT 'reception'::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_visit_id uuid;
  v_admission_id uuid;
  v_admission_number text;
begin
  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  select id into v_visit_id from visits
    where patient_id = p_patient_id and clinic_id = p_clinic_id
      and status not in ('discharged', 'cancelled', 'admitted')
    order by created_at desc limit 1;

  if v_visit_id is null then
    insert into visits (clinic_id, patient_id, visit_reason, status, registered_by)
    values (p_clinic_id, p_patient_id, p_admission_reason, 'admitted', p_created_by)
    returning id into v_visit_id;
  else
    update visits set status = 'admitted' where id = v_visit_id;
  end if;

  v_admission_number := generate_next_admission_number(p_clinic_id);

  insert into admissions (
    clinic_id, admission_number, patient_id, visit_id, source, recommended_by, admission_reason
  ) values (
    p_clinic_id, v_admission_number, p_patient_id, v_visit_id, p_source, p_created_by, p_admission_reason
  )
  returning id into v_admission_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_created_by, 'admission.recommended', 'admission', v_admission_id,
    jsonb_build_object('admission_number', v_admission_number, 'reason', p_admission_reason, 'source', p_source));

  return v_admission_id;
end;
$function$
;

-- FUNCTION: create_inpatient_prescription
CREATE OR REPLACE FUNCTION public.create_inpatient_prescription(p_clinic_id uuid, p_admission_id uuid, p_prescribed_by uuid, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_admission record;
  v_consultation_id uuid;
  v_prescription_id uuid;
  v_item jsonb;
begin
  select * into v_admission from admissions
    where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted';
  if v_admission.id is null then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;

  select id into v_consultation_id from consultations
    where visit_id = v_admission.visit_id
    order by started_at desc limit 1;

  insert into prescriptions (clinic_id, visit_id, consultation_id, doctor_id)
  values (p_clinic_id, v_admission.visit_id, v_consultation_id, p_prescribed_by)
  returning id into v_prescription_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into prescription_items (
      prescription_id, product_id, drug_name_freetext, dose, route, frequency, duration_days, instructions, quantity_prescribed
    ) values (
      v_prescription_id,
      nullif(v_item->>'product_id', '')::uuid,
      nullif(v_item->>'freetext_name', ''),
      v_item->>'dose',
      v_item->>'route',
      v_item->>'frequency',
      nullif(v_item->>'duration_days', '')::int,
      v_item->>'instructions',
      (v_item->>'quantity')::int
    );
  end loop;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_prescribed_by, 'admission.prescription_ordered', 'admission', p_admission_id,
    jsonb_build_object('prescription_id', v_prescription_id));

  return v_prescription_id;
end;
$function$
;

-- FUNCTION: create_insurance_claim
CREATE OR REPLACE FUNCTION public.create_insurance_claim(p_clinic_id uuid, p_insurer_id uuid, p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_claim_id uuid;
  v_claim_number text;
  v_total numeric(10,2);
begin
  if not exists (select 1 from insurers where id = p_insurer_id and clinic_id = p_clinic_id) then
    raise exception 'Insurer does not belong to this clinic';
  end if;

  select coalesce(sum(sc.insurer_portion_xaf), 0) into v_total
  from service_charges sc
  where sc.clinic_id = p_clinic_id
    and sc.insurer_id = p_insurer_id
    and sc.status <> 'void'
    and sc.id not in (select service_charge_id from insurance_claim_items);

  if v_total = 0 then
    raise exception 'No unclaimed charges found for this insurer';
  end if;

  v_claim_number := generate_next_claim_number(p_clinic_id);

  insert into insurance_claims (clinic_id, insurer_id, claim_number, total_claimed_xaf, created_by)
  values (p_clinic_id, p_insurer_id, v_claim_number, v_total, p_created_by)
  returning id into v_claim_id;

  insert into insurance_claim_items (claim_id, service_charge_id, amount_xaf)
  select v_claim_id, sc.id, sc.insurer_portion_xaf
  from service_charges sc
  where sc.clinic_id = p_clinic_id
    and sc.insurer_id = p_insurer_id
    and sc.status <> 'void'
    and sc.id not in (select service_charge_id from insurance_claim_items where claim_id <> v_claim_id);

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_created_by, 'insurance.claim_created', 'insurance_claim', v_claim_id,
    jsonb_build_object('claim_number', v_claim_number, 'total_xaf', v_total));

  return v_claim_id;
end;
$function$
;

-- FUNCTION: create_lab_order
CREATE OR REPLACE FUNCTION public.create_lab_order(p_clinic_id uuid, p_visit_id uuid, p_ordered_by uuid, p_items jsonb)
 RETURNS TABLE(lab_order_id uuid, service_charge_ids uuid[])
 LANGUAGE plpgsql
AS $function$
declare
  v_patient_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_item_type text;
  v_charge_ids uuid[] := ARRAY[]::uuid[];
  v_charge_id uuid;
  v_price numeric(10,2);
  v_name text;
begin
  -- THE FIX: the visit lookup now also checks clinic_id, so a mismatched
  -- p_clinic_id / p_visit_id pair fails cleanly here instead of silently
  -- creating a lab order tagged with the wrong clinic.
  select patient_id into v_patient_id from visits where id = p_visit_id and clinic_id = p_clinic_id;
  if v_patient_id is null then
    raise exception 'Visit % not found for this clinic', p_visit_id;
  end if;

  insert into lab_orders (clinic_id, visit_id, ordered_by)
  values (p_clinic_id, p_visit_id, p_ordered_by)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_type := v_item->>'type';

    if v_item_type = 'panel' then
      select clp.price_xaf, lp.name_fr into v_price, v_name
      from clinic_lab_panels clp
      join lab_panels lp on lp.id = clp.lab_panel_id
      where clp.clinic_id = p_clinic_id and clp.lab_panel_id = (v_item->>'panel_id')::uuid and clp.is_active;

      if v_price is null then
        raise exception 'Panel % is not available for this clinic', v_item->>'panel_id';
      end if;

      v_charge_id := create_service_charge(
        p_clinic_id, v_patient_id, p_visit_id, null, 'lab', v_name, v_price, p_ordered_by
      );
      v_charge_ids := array_append(v_charge_ids, v_charge_id);

      insert into lab_order_items (lab_order_id, clinic_id, item_type, lab_panel_id, service_charge_id)
      values (v_order_id, p_clinic_id, 'panel', (v_item->>'panel_id')::uuid, v_charge_id);

    elsif v_item_type = 'individual_test' then
      select clt.price_xaf, cat.name_fr into v_price, v_name
      from clinic_lab_tests clt
      join lab_test_catalog cat on cat.id = clt.lab_test_catalog_id
      where clt.clinic_id = p_clinic_id and clt.lab_test_catalog_id = (v_item->>'catalog_id')::uuid and clt.is_active;

      if v_price is null then
        raise exception 'Test % is not available for this clinic', v_item->>'catalog_id';
      end if;

      v_charge_id := create_service_charge(
        p_clinic_id, v_patient_id, p_visit_id, null, 'lab', v_name, v_price, p_ordered_by
      );
      v_charge_ids := array_append(v_charge_ids, v_charge_id);

      insert into lab_order_items (lab_order_id, clinic_id, item_type, lab_test_catalog_id, service_charge_id)
      values (v_order_id, p_clinic_id, 'individual_test', (v_item->>'catalog_id')::uuid, v_charge_id);

    elsif v_item_type = 'external' then
      insert into lab_order_items (lab_order_id, clinic_id, item_type, external_test_name)
      values (v_order_id, p_clinic_id, 'external', v_item->>'name');

    else
      raise exception 'Unknown lab order item type: %', v_item_type;
    end if;
  end loop;

  return query select v_order_id, v_charge_ids;
end;
$function$
;

-- FUNCTION: create_payment
CREATE OR REPLACE FUNCTION public.create_payment(p_invoice_id uuid, p_total_amount_xaf numeric, p_received_by uuid, p_splits jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_clinic_id uuid;
  v_patient_id uuid;
  v_payment_id uuid;
  v_split jsonb;
  v_splits_total numeric(10,2) := 0;
  v_remaining numeric(10,2);
  v_charge record;
  v_pay_amount numeric(10,2);
  v_invoice_total numeric(10,2);
  v_invoice_paid numeric(10,2);
  v_open_shift_id uuid;
begin
  select clinic_id, patient_id, total_amount_xaf, amount_paid_xaf
    into v_clinic_id, v_patient_id, v_invoice_total, v_invoice_paid
  from invoices where id = p_invoice_id for update;

  if v_clinic_id is null then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;

  for v_split in select * from jsonb_array_elements(p_splits)
  loop
    v_splits_total := v_splits_total + (v_split->>'amount')::numeric;
  end loop;

  if v_splits_total <> p_total_amount_xaf then
    raise exception 'Payment splits (%) do not sum to the stated total (%)', v_splits_total, p_total_amount_xaf;
  end if;

  if v_invoice_paid + p_total_amount_xaf > v_invoice_total then
    raise exception 'Payment of % would exceed the invoice total (% already paid of %)', p_total_amount_xaf, v_invoice_paid, v_invoice_total;
  end if;

  select id into v_open_shift_id from cashier_shifts
    where staff_id = p_received_by and status = 'open';

  insert into payments (clinic_id, invoice_id, patient_id, total_amount_xaf, received_by, cashier_shift_id)
  values (v_clinic_id, p_invoice_id, v_patient_id, p_total_amount_xaf, p_received_by, v_open_shift_id)
  returning id into v_payment_id;

  for v_split in select * from jsonb_array_elements(p_splits)
  loop
    insert into payment_splits (payment_id, method, amount_xaf, provider_transaction_ref)
    values (
      v_payment_id,
      (v_split->>'method')::payment_method,
      (v_split->>'amount')::numeric,
      v_split->>'provider_transaction_ref'
    );
  end loop;

  v_remaining := p_total_amount_xaf;
  for v_charge in
    select sc.id, sc.amount_xaf, sc.amount_paid_xaf
    from service_charges sc
    join invoice_items ii on ii.service_charge_id = sc.id
    where ii.invoice_id = p_invoice_id and sc.status in ('pending','partial')
    order by sc.created_at asc
    for update of sc
  loop
    exit when v_remaining <= 0;
    v_pay_amount := least(v_charge.amount_xaf - v_charge.amount_paid_xaf, v_remaining);

    update service_charges
      set amount_paid_xaf = amount_paid_xaf + v_pay_amount,
          status = case
            when amount_paid_xaf + v_pay_amount >= amount_xaf then 'paid'
            else 'partial'
          end::service_charge_status
      where id = v_charge.id;

    insert into payment_allocations (payment_id, service_charge_id, amount_xaf)
    values (v_payment_id, v_charge.id, v_pay_amount);

    v_remaining := v_remaining - v_pay_amount;
  end loop;

  update invoices set
    amount_paid_xaf = amount_paid_xaf + p_total_amount_xaf,
    status = case
      when amount_paid_xaf + p_total_amount_xaf >= total_amount_xaf then 'paid'
      else 'partial'
    end::invoice_status
  where id = p_invoice_id;

  return v_payment_id;
end;
$function$
;

-- FUNCTION: create_purchase_order
CREATE OR REPLACE FUNCTION public.create_purchase_order(p_clinic_id uuid, p_supplier_id uuid, p_created_by uuid, p_expected_delivery_date date, p_notes text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_po_id uuid;
  v_item jsonb;
begin
  insert into purchase_orders (clinic_id, supplier_id, created_by, expected_delivery_date, notes)
  values (p_clinic_id, p_supplier_id, p_created_by, p_expected_delivery_date, p_notes)
  returning id into v_po_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into purchase_order_items (purchase_order_id, product_id, quantity_ordered, unit_cost_xaf)
    values (
      v_po_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_cost_xaf')::numeric
    );
  end loop;

  return v_po_id;
end;
$function$
;

-- FUNCTION: create_service_charge
CREATE OR REPLACE FUNCTION public.create_service_charge(p_clinic_id uuid, p_patient_id uuid, p_visit_id uuid, p_service_price_id uuid, p_category text, p_description text, p_amount_xaf numeric, p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_existing record;
  v_charge_id uuid;
begin
  if p_category = 'consultation' then
    if p_service_price_id is null then
      raise exception 'A specific service type is required for consultation charges';
    end if;

    select id, status into v_existing
    from service_charges
    where clinic_id = p_clinic_id
      and patient_id = p_patient_id
      and category = 'consultation'
      and service_price_id = p_service_price_id
      and status <> 'void'
      and service_date = (timezone('Africa/Douala', now()))::date;

    if v_existing.id is not null then
      raise exception 'This patient already has a charge for this exact consultation type today (status: %). If this is a referral to a different specialty, use that specialty''s service type instead.', v_existing.status;
    end if;
  end if;

  begin
    insert into service_charges (
      clinic_id, patient_id, visit_id, service_price_id, category, description, amount_xaf, created_by
    ) values (
      p_clinic_id, p_patient_id, p_visit_id, p_service_price_id, p_category, p_description, p_amount_xaf, p_created_by
    )
    returning id into v_charge_id;
  exception
    when unique_violation then
      raise exception 'This patient already has a charge for this exact consultation type today. If this is a referral to a different specialty, use that specialty''s service type instead.';
  end;

  return v_charge_id;
end;
$function$
;

-- FUNCTION: critical_results_pending_review
CREATE OR REPLACE FUNCTION public.critical_results_pending_review(p_clinic_id uuid)
 RETURNS TABLE(result_id uuid, patient_id uuid, patient_name text, test_name text, result_display text, verified_at timestamp with time zone, is_admitted boolean, admission_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  select
    lr.id,
    p.id,
    p.full_name,
    coalesce(lp.name_fr, ltc.name_fr, loi.external_test_name, 'Test'),
    coalesce(lr.numeric_value::text, lr.qualitative_value),
    lr.verified_at,
    (a.id is not null),
    a.id
  from lab_results lr
  join lab_order_items loi on loi.id = lr.lab_order_item_id
  join lab_orders lo on lo.id = loi.lab_order_id
  join visits v on v.id = lo.visit_id
  join patients p on p.id = v.patient_id
  left join lab_panels lp on lp.id = loi.lab_panel_id
  left join lab_test_catalog ltc on ltc.id = loi.lab_test_catalog_id
  left join admissions a on a.visit_id = v.id and a.status = 'admitted'
  where lr.clinic_id = p_clinic_id
    and lr.is_critical = true
    and lr.acknowledged_at is null
    and lr.verified_at is not null
  order by lr.verified_at asc
$function$
;

-- FUNCTION: current_staff_clinic_id
CREATE OR REPLACE FUNCTION public.current_staff_clinic_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select clinic_id from staff
  where auth_user_id = auth.uid() and is_active = true
  limit 1
$function$
;

-- FUNCTION: current_staff_role
CREATE OR REPLACE FUNCTION public.current_staff_role()
 RETURNS staff_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select role from staff
  where auth_user_id = auth.uid() and is_active = true
  limit 1
$function$
;

-- FUNCTION: dead_stock_report
CREATE OR REPLACE FUNCTION public.dead_stock_report(p_clinic_id uuid, p_days integer DEFAULT 60)
 RETURNS TABLE(product_id uuid, product_name text, on_hand integer, stock_value_xaf numeric)
 LANGUAGE sql
 STABLE
AS $function$
  select
    p.id as product_id,
    p.name as product_name,
    coalesce((select sum(batch_quantity_on_hand(b.id)) from batches b where b.product_id = p.id and b.status = 'active'), 0) as on_hand,
    coalesce((select sum(batch_quantity_on_hand(b.id)) from batches b where b.product_id = p.id and b.status = 'active'), 0)
      * coalesce(p.cost_price_xaf, 0) as stock_value_xaf
  from products p
  where p.clinic_id = p_clinic_id and p.is_active = true
    and coalesce((select sum(batch_quantity_on_hand(b.id)) from batches b where b.product_id = p.id and b.status = 'active'), 0) > 0
    and p.id not in (
      select psi.product_id from pos_sale_items psi
      join pos_sales ps on ps.id = psi.pos_sale_id
      where ps.clinic_id = p_clinic_id and ps.created_at >= current_date - p_days
      union
      select sc.product_id from service_charges sc
      where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and sc.product_id is not null
        and sc.service_date >= current_date - p_days
    )
  order by stock_value_xaf desc
$function$
;

-- FUNCTION: discharge_patient
CREATE OR REPLACE FUNCTION public.discharge_patient(p_clinic_id uuid, p_admission_id uuid, p_discharged_by uuid, p_discharge_summary text, p_discharge_type text DEFAULT 'routine'::text, p_outcome text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_admission record;
  v_ward record;
  v_clinic record;
  v_already_accrued boolean;
  v_room_charge_id uuid;
  v_nursing_charge_id uuid;
begin
  select * into v_admission from admissions
    where id = p_admission_id and clinic_id = p_clinic_id
    for update;

  if v_admission.id is null then
    raise exception 'Admission does not belong to this clinic';
  end if;
  if v_admission.status <> 'admitted' then
    raise exception 'Only an admitted patient can be discharged (current status: %)', v_admission.status;
  end if;
  if p_discharge_summary is null or trim(p_discharge_summary) = '' then
    raise exception 'A discharge summary is required';
  end if;
  if p_discharge_type not in ('routine', 'transfer_out', 'against_medical_advice', 'deceased') then
    raise exception 'Invalid discharge type: %', p_discharge_type;
  end if;

  if v_admission.bed_id is not null then
    update beds set status = 'available' where id = v_admission.bed_id;
  end if;

  -- Nightly accrual (accrue_nightly_inpatient_charges) already bills
  -- room + nursing for every night this admission was open at the time
  -- the cron ran. This only needs to cover the gap: an admission that
  -- never saw a single nightly run (admitted and discharged same day,
  -- before the next scheduled run) still owes a minimum one night —
  -- matching the floor the old lump-sum logic used — rather than being
  -- billed nothing for a real bed-day.
  select exists(select 1 from inpatient_daily_accruals where admission_id = p_admission_id)
    into v_already_accrued;

  if not v_already_accrued then
    if v_admission.ward_id is not null then
      select * into v_ward from wards where id = v_admission.ward_id;
      if v_ward.daily_rate_xaf is not null and v_ward.daily_rate_xaf > 0 then
        v_room_charge_id := create_service_charge(
          p_clinic_id, v_admission.patient_id, v_admission.visit_id, null, 'admission',
          'Frais de chambre — ' || v_ward.name || ' (séjour < 1 nuit, minimum facturé)',
          v_ward.daily_rate_xaf, p_discharged_by
        );
        perform open_invoice_for_charge(v_room_charge_id, p_discharged_by);
      end if;
    end if;

    select * into v_clinic from clinics where id = p_clinic_id;
    if v_clinic.nursing_daily_rate_xaf is not null and v_clinic.nursing_daily_rate_xaf > 0 then
      v_nursing_charge_id := create_service_charge(
        p_clinic_id, v_admission.patient_id, v_admission.visit_id, null, 'admission',
        'Soins infirmiers — forfait journalier (séjour < 1 nuit, minimum facturé)',
        v_clinic.nursing_daily_rate_xaf, p_discharged_by
      );
      perform open_invoice_for_charge(v_nursing_charge_id, p_discharged_by);
    end if;

    insert into inpatient_daily_accruals (admission_id, clinic_id, accrual_date, room_charge_id, nursing_charge_id)
    values (p_admission_id, p_clinic_id, current_date, v_room_charge_id, v_nursing_charge_id)
    on conflict (admission_id, accrual_date) do nothing;
  end if;

  update admissions set
    status = 'discharged',
    discharge_summary = p_discharge_summary,
    discharge_type = p_discharge_type,
    discharge_outcome = p_outcome,
    discharged_by = p_discharged_by,
    discharged_at = now()
  where id = p_admission_id;

  update visits set status = 'discharged' where id = v_admission.visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_discharged_by, 'admission.discharged', 'admission', p_admission_id,
    jsonb_build_object('discharge_summary', p_discharge_summary, 'discharge_type', p_discharge_type, 'outcome', p_outcome));
end;
$function$
;

-- FUNCTION: dispense_fefo
CREATE OR REPLACE FUNCTION public.dispense_fefo(p_clinic_id uuid, p_product_id uuid, p_quantity_needed integer, p_reference_type text, p_reference_id uuid, p_performed_by uuid, p_allow_expired_override boolean DEFAULT false, p_override_reason text DEFAULT NULL::text, p_approved_by uuid DEFAULT NULL::uuid, p_dispensing_record_id uuid DEFAULT NULL::uuid, p_movement_type stock_movement_type DEFAULT 'dispense'::stock_movement_type)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_remaining int := p_quantity_needed;
  v_batch record;
  v_take int;
  v_movements jsonb := '[]'::jsonb;
  v_approver_role staff_role;
begin
  if p_allow_expired_override then
    if p_override_reason is null or trim(p_override_reason) = '' then
      raise exception 'An override reason is required to dispense expired stock';
    end if;
    if p_approved_by is null then
      raise exception 'Expired-batch dispensing requires a second person''s approval';
    end if;
    if p_approved_by = p_performed_by then
      raise exception 'The approver must be a different person from whoever is dispensing';
    end if;
    select role into v_approver_role from staff
      where id = p_approved_by and clinic_id = p_clinic_id and is_active = true;
    if v_approver_role is null then
      raise exception 'Approver not found or inactive in this clinic';
    end if;
    if v_approver_role not in ('admin','doctor') then
      raise exception 'Approver must be an admin or doctor, got %', v_approver_role;
    end if;
  end if;

  for v_batch in
    select b.id, b.batch_number, b.expiry_date, batch_quantity_on_hand(b.id) as qty
    from batches b
    where b.product_id = p_product_id
      and b.status = 'active'
      and (p_allow_expired_override or b.expiry_date >= current_date)
    order by b.expiry_date asc
    for update
  loop
    exit when v_remaining <= 0;
    if v_batch.qty <= 0 then
      continue;
    end if;

    v_take := least(v_batch.qty, v_remaining);

    perform record_stock_movement(
      v_batch.id, p_movement_type, v_take, p_reference_type, p_reference_id,
      case when v_batch.expiry_date < current_date then 'EXPIRED OVERRIDE: ' || p_override_reason else null end,
      p_performed_by, p_dispensing_record_id
    );

    v_movements := v_movements || jsonb_build_object(
      'batch_id', v_batch.id,
      'batch_number', v_batch.batch_number,
      'expiry_date', v_batch.expiry_date,
      'quantity', v_take,
      'was_expired', v_batch.expiry_date < current_date
    );

    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'Insufficient total stock: % units short', v_remaining;
  end if;

  if p_allow_expired_override and exists (
    select 1 from jsonb_array_elements(v_movements) m where (m->>'was_expired')::boolean
  ) then
    insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
    values (
      p_clinic_id, p_performed_by, 'pharmacy.expired_batch_override', 'product', p_product_id,
      jsonb_build_object('reason', p_override_reason, 'approved_by', p_approved_by, 'movements', v_movements)
    );
  end if;

  return v_movements;
end;
$function$
;

-- FUNCTION: dispense_prescription_item
CREATE OR REPLACE FUNCTION public.dispense_prescription_item(p_prescription_item_id uuid, p_quantity integer, p_dispensed_by uuid, p_witness_id uuid DEFAULT NULL::uuid, p_allow_expired_override boolean DEFAULT false, p_override_reason text DEFAULT NULL::text, p_override_approved_by uuid DEFAULT NULL::uuid, p_manual_unit_price_xaf numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_item record;
  v_clinic_id uuid;
  v_patient_id uuid;
  v_visit_id uuid;
  v_is_controlled boolean;
  v_remaining_on_item int;
  v_allocations jsonb;
  v_prescription_requires_review boolean;
  v_dispensing_record_id uuid;
  v_unit_price numeric(10,2);
  v_charge_amount numeric(10,2);
  v_charge_id uuid;
  v_product_name text;
  v_invoice_id uuid;
begin
  select pi.* into v_item
  from prescription_items pi
  where pi.id = p_prescription_item_id
  for update of pi;

  if v_item.id is null then
    raise exception 'Prescription item % not found', p_prescription_item_id;
  end if;

  select p.clinic_id, p.requires_review, p.visit_id into v_clinic_id, v_prescription_requires_review, v_visit_id
  from prescriptions p
  where p.id = v_item.prescription_id;

  select patient_id into v_patient_id from visits where id = v_visit_id;

  if v_prescription_requires_review then
    raise exception 'This prescription contains a controlled substance and has not yet been reviewed by an admin — nothing on it can be dispensed until approve_prescription_review() has run';
  end if;

  v_remaining_on_item := v_item.quantity_prescribed - v_item.quantity_dispensed;
  if p_quantity > v_remaining_on_item then
    raise exception 'Cannot dispense % — only % remaining on this prescription item', p_quantity, v_remaining_on_item;
  end if;

  if v_item.product_id is not null then
    select dc.is_controlled, pr.sale_price_xaf, pr.name
      into v_is_controlled, v_unit_price, v_product_name
    from products pr
    left join drug_classes dc on dc.id = pr.drug_class_id
    where pr.id = v_item.product_id;
  end if;

  if v_unit_price is null then
    if p_manual_unit_price_xaf is null then
      raise exception 'Cannot dispense: no catalog price available for this item and no manual price was provided. A price is required before dispensing can proceed.';
    end if;
    v_unit_price := p_manual_unit_price_xaf;
    v_product_name := coalesce(v_item.drug_name_freetext, 'Article non catalogué');
  end if;

  v_charge_amount := v_unit_price * p_quantity;

  if v_is_controlled then
    if p_witness_id is null then
      raise exception 'A witness is required to dispense a controlled substance';
    end if;
    if p_witness_id = p_dispensed_by then
      raise exception 'The witness must be a different person from whoever is dispensing';
    end if;
    if not exists (
      select 1 from staff where id = p_witness_id and clinic_id = v_clinic_id and is_active = true
    ) then
      raise exception 'Witness not found or inactive in this clinic';
    end if;
  end if;

  insert into dispensing_records (
    clinic_id, prescription_item_id, quantity_dispensed, dispensed_by, witness_id
  ) values (
    v_clinic_id, p_prescription_item_id, p_quantity, p_dispensed_by, p_witness_id
  )
  returning id into v_dispensing_record_id;

  if v_item.product_id is null then
    v_allocations := jsonb_build_object('note', 'no catalog product linked — stock not tracked, manual price billed');
  else
    v_allocations := dispense_fefo(
      v_clinic_id, v_item.product_id, p_quantity,
      'prescription_item', p_prescription_item_id, p_dispensed_by,
      p_allow_expired_override, p_override_reason, p_override_approved_by,
      v_dispensing_record_id
    );
  end if;

  update dispensing_records set batch_allocations = v_allocations where id = v_dispensing_record_id;

  v_charge_id := create_service_charge(
    v_clinic_id, v_patient_id, v_visit_id, null, 'pharmacy',
    v_product_name || ' x' || p_quantity, v_charge_amount, p_dispensed_by
  );

  if v_item.product_id is not null then
    update service_charges set product_id = v_item.product_id, quantity = p_quantity where id = v_charge_id;
  end if;

  -- THE FIX: wrap this charge in a payable invoice immediately, same as
  -- every other charge-generating event in the system. Without this,
  -- the charge exists but can never actually be paid.
  v_invoice_id := open_invoice_for_charge(v_charge_id, p_dispensed_by);

  update dispensing_records set service_charge_id = v_charge_id where id = v_dispensing_record_id;

  update prescription_items
    set quantity_dispensed = quantity_dispensed + p_quantity
    where id = p_prescription_item_id;

  update prescriptions set status = (
    select case
      when bool_and(quantity_dispensed = 0) then 'pending'
      when bool_and(quantity_dispensed >= quantity_prescribed) then 'dispensed'
      else 'partially_dispensed'
    end::prescription_status
    from prescription_items where prescription_id = v_item.prescription_id
  )
  where id = v_item.prescription_id;

  return v_allocations || jsonb_build_object(
    'service_charge_id', v_charge_id, 'charge_amount', v_charge_amount, 'invoice_id', v_invoice_id
  );
end;
$function$
;

-- FUNCTION: dispense_prescription_item
CREATE OR REPLACE FUNCTION public.dispense_prescription_item(p_prescription_item_id uuid, p_quantity integer, p_dispensed_by uuid, p_witness_id uuid DEFAULT NULL::uuid, p_allow_expired_override boolean DEFAULT false, p_override_reason text DEFAULT NULL::text, p_override_approved_by uuid DEFAULT NULL::uuid, p_manual_unit_price_xaf numeric DEFAULT NULL::numeric, p_product_id_override uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_item                       record;
  v_clinic_id                  uuid;
  v_patient_id                 uuid;
  v_visit_id                   uuid;
  v_prescription_requires_review boolean;
  v_remaining_on_item          int;
  v_allocations                jsonb;
  v_dispensing_record_id       uuid;
  v_unit_price                 numeric(10,2);
  v_charge_amount              numeric(10,2);
  v_charge_id                  uuid;
  v_product_name               text;
  v_effective_product_id       uuid;
begin
  select pi.* into v_item
  from prescription_items pi
  where pi.id = p_prescription_item_id
  for update of pi;

  if v_item.id is null then
    raise exception 'Prescription item % not found', p_prescription_item_id;
  end if;

  select p.clinic_id, p.requires_review, p.visit_id
    into v_clinic_id, v_prescription_requires_review, v_visit_id
  from prescriptions p
  where p.id = v_item.prescription_id;

  select patient_id into v_patient_id from visits where id = v_visit_id;

  if v_prescription_requires_review then
    raise exception 'This prescription has not yet been reviewed — approve it before dispensing';
  end if;

  v_remaining_on_item := v_item.quantity_prescribed - v_item.quantity_dispensed;
  if v_remaining_on_item <= 0 then
    raise exception 'This item has already been fully dispensed';
  end if;
  if p_quantity > v_remaining_on_item then
    raise exception 'Cannot dispense % units — only % remaining', p_quantity, v_remaining_on_item;
  end if;

  v_effective_product_id := coalesce(p_product_id_override, v_item.product_id);

  if v_effective_product_id is null and p_manual_unit_price_xaf is null then
    raise exception 'Cannot dispense a freetext item without a manual price';
  end if;

  -- FEFO batch allocation
  if v_effective_product_id is not null then
    select jsonb_agg(
      jsonb_build_object('batch_id', b.id, 'qty', least(batch_quantity_on_hand(b.id), p_quantity))
      order by b.expiry_date asc nulls last
    )
    into v_allocations
    from batches b
    where b.product_id = v_effective_product_id
      and b.status = 'active'
      and (p_allow_expired_override or b.expiry_date is null or b.expiry_date >= current_date)
      and batch_quantity_on_hand(b.id) > 0;

    if v_allocations is null or jsonb_array_length(v_allocations) = 0 then
      raise exception 'No stock available for this product';
    end if;
  end if;

  if v_effective_product_id is not null then
    select name, sale_price_xaf into v_product_name, v_unit_price
    from products where id = v_effective_product_id;
  else
    v_product_name := v_item.drug_name_freetext;
    v_unit_price := p_manual_unit_price_xaf;
  end if;

  if p_manual_unit_price_xaf is not null then
    v_unit_price := p_manual_unit_price_xaf;
  end if;

  v_charge_amount := v_unit_price * p_quantity;

  insert into dispensing_records (
    clinic_id, prescription_id, prescription_item_id,
    product_id, dispensed_by, witness_id,
    quantity_dispensed, unit_price_xaf, total_price_xaf,
    dispensed_at
  ) values (
    v_clinic_id, v_item.prescription_id, p_prescription_item_id,
    v_effective_product_id, p_dispensed_by, p_witness_id,
    p_quantity, v_unit_price, v_charge_amount,
    now()
  ) returning id into v_dispensing_record_id;

  -- Move stock
  if v_effective_product_id is not null then
    for i in 0..jsonb_array_length(v_allocations)-1 loop
      declare
        v_batch_id uuid := (v_allocations->i->>'batch_id')::uuid;
        v_batch_qty int  := (v_allocations->i->>'qty')::int;
      begin
        if v_batch_qty <= 0 then continue; end if;
        perform record_stock_movement(
          v_batch_id, 'dispense', v_batch_qty,
          'dispensing', v_dispensing_record_id,
          null, p_dispensed_by, v_dispensing_record_id
        );
      end;
    end loop;
  end if;

  -- Create billing charge — null for service_price_id (pharmacy charges don't use service_prices)
  v_charge_id := create_service_charge(
    v_clinic_id, v_patient_id, v_visit_id,
    null, 'pharmacy',
    v_product_name || ' x' || p_quantity,
    v_charge_amount, p_dispensed_by
  );

  -- Stamp the product on the charge for profit margin tracking
  if v_effective_product_id is not null then
    update service_charges set product_id = v_effective_product_id where id = v_charge_id;
  end if;

  update dispensing_records set service_charge_id = v_charge_id where id = v_dispensing_record_id;

  update prescription_items
  set quantity_dispensed = quantity_dispensed + p_quantity
  where id = p_prescription_item_id;

  return jsonb_build_object('service_charge_id', v_charge_id);
end;
$function$
;

-- FUNCTION: effective_lab_test_range
CREATE OR REPLACE FUNCTION public.effective_lab_test_range(p_clinic_id uuid, p_lab_test_catalog_id uuid)
 RETURNS TABLE(reference_range_low numeric, reference_range_high numeric, critical_low numeric, critical_high numeric, abnormal_qualitative_values text[], critical_qualitative_values text[])
 LANGUAGE sql
 STABLE
AS $function$
  select
    coalesce(clt.override_reference_range_low, cat.reference_range_low),
    coalesce(clt.override_reference_range_high, cat.reference_range_high),
    coalesce(clt.override_critical_low, cat.critical_low),
    coalesce(clt.override_critical_high, cat.critical_high),
    coalesce(clt.override_abnormal_qualitative_values, cat.abnormal_qualitative_values),
    coalesce(clt.override_critical_qualitative_values, cat.critical_qualitative_values)
  from lab_test_catalog cat
  left join clinic_lab_tests clt
    on clt.lab_test_catalog_id = cat.id and clt.clinic_id = p_clinic_id
  where cat.id = p_lab_test_catalog_id
$function$
;

-- FUNCTION: eod_revenue_by_cashier
CREATE OR REPLACE FUNCTION public.eod_revenue_by_cashier(p_clinic_id uuid, p_date date DEFAULT NULL::date)
 RETURNS TABLE(staff_id uuid, staff_name text, total_xaf numeric, cash_xaf numeric, transaction_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with target as (select coalesce(p_date, (timezone('Africa/Douala', now()))::date) as d)
  select
    s.id,
    s.full_name,
    sum(c.amount) as total_xaf,
    sum(c.amount) filter (where c.method = 'cash') as cash_xaf,
    count(*) as transaction_count
  from (
    select p.received_by as staff_id, ps.method::text, ps.amount_xaf as amount
    from payments p
    join payment_splits ps on ps.payment_id = p.id, target
    where p.clinic_id = p_clinic_id
      and p.status = 'completed'
      and date(timezone('Africa/Douala', p.created_at)) = target.d

    union all

    select pos.sold_by, pos.payment_method::text, pos.total_amount_xaf
    from pos_sales pos, target
    where pos.clinic_id = p_clinic_id
      and pos.status = 'completed'
      and date(timezone('Africa/Douala', pos.created_at)) = target.d
  ) c
  join staff s on s.id = c.staff_id
  group by s.id, s.full_name
  order by total_xaf desc
$function$
;

-- FUNCTION: eod_revenue_by_category
CREATE OR REPLACE FUNCTION public.eod_revenue_by_category(p_clinic_id uuid, p_date date DEFAULT NULL::date)
 RETURNS TABLE(category text, total_xaf numeric)
 LANGUAGE sql
 STABLE
AS $function$
  with target as (select coalesce(p_date, (timezone('Africa/Douala', now()))::date) as d)
  select category, sum(amount) as total_xaf
  from (
    select sc.category::text, coalesce(sc.patient_portion_xaf, sc.amount_xaf) as amount
    from service_charges sc, target
    where sc.clinic_id = p_clinic_id
      and sc.status = 'paid'
      and date(timezone('Africa/Douala', sc.updated_at)) = target.d

    union all

    select 'pos'::text, pos.total_amount_xaf
    from pos_sales pos, target
    where pos.clinic_id = p_clinic_id
      and pos.status = 'completed'
      and date(timezone('Africa/Douala', pos.created_at)) = target.d
  ) combined
  group by category
  order by total_xaf desc
$function$
;

-- FUNCTION: eod_revenue_by_method
CREATE OR REPLACE FUNCTION public.eod_revenue_by_method(p_clinic_id uuid, p_date date DEFAULT NULL::date)
 RETURNS TABLE(method text, total_xaf numeric, transaction_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with target as (select coalesce(p_date, (timezone('Africa/Douala', now()))::date) as d)
  select method, sum(amount) as total_xaf, count(*) as transaction_count
  from (
    select ps.method::text, ps.amount_xaf as amount
    from payments p
    join payment_splits ps on ps.payment_id = p.id, target
    where p.clinic_id = p_clinic_id
      and p.status = 'completed'
      and date(timezone('Africa/Douala', p.created_at)) = target.d

    union all

    select pos.payment_method::text, pos.total_amount_xaf
    from pos_sales pos, target
    where pos.clinic_id = p_clinic_id
      and pos.status = 'completed'
      and date(timezone('Africa/Douala', pos.created_at)) = target.d
  ) combined
  group by method
  order by total_xaf desc
$function$
;

-- FUNCTION: evaluate_lab_result_flag
CREATE OR REPLACE FUNCTION public.evaluate_lab_result_flag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_range record;
begin
  select * into v_range from effective_lab_test_range(new.clinic_id, new.lab_test_catalog_id);

  new.reference_range_low := v_range.reference_range_low;
  new.reference_range_high := v_range.reference_range_high;
  new.critical_low := v_range.critical_low;
  new.critical_high := v_range.critical_high;

  if new.numeric_value is not null then
    new.is_abnormal := (v_range.reference_range_low is not null and new.numeric_value < v_range.reference_range_low)
                     or (v_range.reference_range_high is not null and new.numeric_value > v_range.reference_range_high);
    new.is_critical := (v_range.critical_low is not null and new.numeric_value < v_range.critical_low)
                     or (v_range.critical_high is not null and new.numeric_value > v_range.critical_high);
  elsif new.qualitative_value is not null then
    new.is_abnormal := v_range.abnormal_qualitative_values is not null
                     and new.qualitative_value = any(v_range.abnormal_qualitative_values);
    new.is_critical := v_range.critical_qualitative_values is not null
                     and new.qualitative_value = any(v_range.critical_qualitative_values);
  end if;

  return new;
end;
$function$
;

-- FUNCTION: evaluate_vitals_flags
CREATE OR REPLACE FUNCTION public.evaluate_vitals_flags()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_flags jsonb := '[]'::jsonb;
  v_rule record;
  v_value numeric;
begin
  for v_rule in
    select * from clinical_thresholds
    where is_active = true and (clinic_id = new.clinic_id or clinic_id is null)
  loop
    v_value := case v_rule.vital_key
      when 'systolic_bp' then new.systolic_bp
      when 'diastolic_bp' then new.diastolic_bp
      when 'spo2' then new.spo2
      when 'temperature' then new.temperature
      when 'pulse' then new.pulse
      else null
    end;

    if v_value is not null then
      if (v_rule.comparator = 'gte' and v_value >= v_rule.threshold_value)
         or (v_rule.comparator = 'lte' and v_value <= v_rule.threshold_value) then
        v_flags := v_flags || jsonb_build_object(
          'vital_key', v_rule.vital_key,
          'severity', v_rule.severity,
          'message_fr', v_rule.flag_message_fr,
          'message_en', v_rule.flag_message_en,
          'value', v_value,
          'threshold', v_rule.threshold_value
        );
      end if;
    end if;
  end loop;

  new.flags := v_flags;
  return new;
end;
$function$
;

-- FUNCTION: flag_prescription_for_review
CREATE OR REPLACE FUNCTION public.flag_prescription_for_review()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_drug_class_id uuid;
  v_is_controlled boolean;
  v_clinic_id uuid;
  v_threshold int;
begin
  if new.product_id is null then
    return new;
  end if;

  select pr.drug_class_id, dc.is_controlled into v_drug_class_id, v_is_controlled
  from products pr
  left join drug_classes dc on dc.id = pr.drug_class_id
  where pr.id = new.product_id;

  if not coalesce(v_is_controlled, false) then
    return new;
  end if;

  select clinic_id into v_clinic_id from prescriptions where id = new.prescription_id;

  -- Clinic-specific override takes priority; fall back to platform default
  -- (clinic_id is null); if neither exists, v_threshold stays null.
  select review_threshold_quantity into v_threshold
  from controlled_drug_review_thresholds
  where drug_class_id = v_drug_class_id
    and is_active = true
    and (clinic_id = v_clinic_id or clinic_id is null)
  order by clinic_id nulls last
  limit 1;

  -- No configured threshold at all = treat as zero tolerance (always review).
  -- This only happens if a drug class is marked controlled but nobody has
  -- set a threshold for it yet — the safe direction to fail in.
  if v_threshold is null then
    v_threshold := 0;
  end if;

  if new.quantity_prescribed >= v_threshold then
    update prescriptions
      set requires_review = true
      where id = new.prescription_id and requires_review = false;
  end if;

  return new;
end;
$function$
;

-- FUNCTION: flag_visit_emergency
CREATE OR REPLACE FUNCTION public.flag_visit_emergency(p_visit_id uuid, p_flagged_by uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_clinic_id uuid;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to flag a visit as emergency';
  end if;

  select clinic_id into v_clinic_id from visits where id = p_visit_id;
  if v_clinic_id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;

  update visits set
    is_emergency = true,
    emergency_reason = p_reason,
    emergency_flagged_by = p_flagged_by,
    emergency_flagged_at = now()
  where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_clinic_id, p_flagged_by, 'visit.emergency_flagged', 'visit', p_visit_id,
    jsonb_build_object('reason', p_reason));
end;
$function$
;

-- FUNCTION: generate_invoice_number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_prefix text;
  v_year text;
  v_next int;
begin
  select upper(left(slug, 3)) into v_prefix from clinics where id = new.clinic_id;
  v_year := to_char(now(), 'YYYY');
  select count(*) + 1 into v_next from invoices
    where clinic_id = new.clinic_id and invoice_number like v_prefix || '-INV-' || v_year || '-%';
  new.invoice_number := v_prefix || '-INV-' || v_year || '-' || lpad(v_next::text, 5, '0');
  return new;
end;
$function$
;

-- FUNCTION: generate_next_admission_number
CREATE OR REPLACE FUNCTION public.generate_next_admission_number(p_clinic_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_next_number int;
begin
  perform pg_advisory_xact_lock(hashtext(p_clinic_id::text || '_admission'));

  select coalesce(max(substring(admission_number from 5)::int), 0) + 1 into v_next_number
  from admissions
  where clinic_id = p_clinic_id and admission_number ~ '^ADM-[0-9]+$';

  return 'ADM-' || lpad(v_next_number::text, 5, '0');
end;
$function$
;

-- FUNCTION: generate_next_claim_number
CREATE OR REPLACE FUNCTION public.generate_next_claim_number(p_clinic_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_next_number int;
begin
  perform pg_advisory_xact_lock(hashtext(p_clinic_id::text || '_claim'));

  select coalesce(max(substring(claim_number from 6)::int), 0) + 1 into v_next_number
  from insurance_claims
  where clinic_id = p_clinic_id and claim_number ~ '^CLM-[0-9]+$';

  return 'CLM-' || lpad(v_next_number::text, 5, '0');
end;
$function$
;

-- FUNCTION: generate_next_sku
CREATE OR REPLACE FUNCTION public.generate_next_sku(p_clinic_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_next_number int;
begin
  perform pg_advisory_xact_lock(hashtext(p_clinic_id::text));

  select coalesce(max(substring(sku from 5)::int), 0) + 1 into v_next_number
  from products
  where clinic_id = p_clinic_id and sku ~ '^MED-[0-9]+$';

  return 'MED-' || lpad(v_next_number::text, 3, '0');
end;
$function$
;

-- FUNCTION: generate_patient_code
CREATE OR REPLACE FUNCTION public.generate_patient_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  clinic_prefix text;
  year_str text;
  next_num int;
begin
  select upper(left(slug, 3)) into clinic_prefix from clinics where id = new.clinic_id;
  year_str := to_char(now(), 'YYYY');
  select count(*) + 1 into next_num from patients
    where clinic_id = new.clinic_id and patient_code like clinic_prefix || '-' || year_str || '-%';
  new.patient_code := clinic_prefix || '-' || year_str || '-' || lpad(next_num::text, 4, '0');
  return new;
end;
$function$
;

-- FUNCTION: get_active_batches_with_stock
CREATE OR REPLACE FUNCTION public.get_active_batches_with_stock(p_clinic_id uuid)
 RETURNS TABLE(batch_id uuid, product_name text, batch_number text, on_hand integer)
 LANGUAGE sql
 STABLE
AS $function$
  select
    b.id,
    p.name,
    b.batch_number,
    batch_quantity_on_hand(b.id)
  from batches b
  join products p on p.id = b.product_id
  where b.clinic_id = p_clinic_id and b.status = 'active'
  order by p.name
$function$
;

-- FUNCTION: get_patient_deposit_balance
CREATE OR REPLACE FUNCTION public.get_patient_deposit_balance(p_clinic_id uuid, p_patient_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(
    sum(case when entry_type = 'deposit' then amount_xaf else -amount_xaf end), 0
  )
  from patient_deposit_ledger
  where clinic_id = p_clinic_id and patient_id = p_patient_id
$function$
;

-- FUNCTION: get_product_batches
CREATE OR REPLACE FUNCTION public.get_product_batches(p_product_id uuid)
 RETURNS TABLE(batch_id uuid, batch_number text, expiry_date date, on_hand integer)
 LANGUAGE sql
 STABLE
AS $function$
  select id, batch_number, expiry_date, batch_quantity_on_hand(id)
  from batches
  where product_id = p_product_id and status = 'active'
  order by expiry_date asc
$function$
;

-- FUNCTION: get_products_with_stock
CREATE OR REPLACE FUNCTION public.get_products_with_stock(p_clinic_id uuid)
 RETURNS TABLE(product_id uuid, sku text, name text, dosage_form text, drug_class_name text, is_antibiotic boolean, barcode text, sale_price_xaf numeric, cost_price_xaf numeric, reorder_threshold integer, is_active boolean, on_hand integer)
 LANGUAGE sql
 STABLE
AS $function$
  select
    p.id,
    p.sku,
    p.name,
    p.dosage_form,
    dc.name_fr,
    coalesce(dc.is_antibiotic, false),
    p.barcode,
    p.sale_price_xaf,
    p.cost_price_xaf,
    p.reorder_threshold,
    p.is_active,
    coalesce((
      select sum(batch_quantity_on_hand(b.id))
      from batches b
      where b.product_id = p.id and b.status = 'active'
    ), 0)::int
  from products p
  left join drug_classes dc on dc.id = p.drug_class_id
  where p.clinic_id = p_clinic_id
  order by p.name
$function$
;

-- FUNCTION: get_recall_patient_impact
CREATE OR REPLACE FUNCTION public.get_recall_patient_impact(p_batch_id uuid)
 RETURNS TABLE(source text, patient_id uuid, patient_name text, patient_phone text, quantity integer, dispensed_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  -- Prescription-based: full traceback via dispensing_records.
  select
    'prescription'::text as source,
    pt.id as patient_id,
    pt.full_name as patient_name,
    pt.phone as patient_phone,
    sm.quantity,
    sm.created_at as dispensed_at
  from stock_movements sm
  join dispensing_records dr on dr.id = sm.dispensing_record_id
  join prescription_items pi on pi.id = dr.prescription_item_id
  join prescriptions p on p.id = pi.prescription_id
  join visits v on v.id = p.visit_id
  join patients pt on pt.id = v.patient_id
  where sm.batch_id = p_batch_id and sm.movement_type = 'dispense'

  union all

  -- POS-based, ONLY when a patient happened to be linked (rare, given
  -- current POS checkout never collects one).
  select
    'pos_linked'::text as source,
    pt.id as patient_id,
    pt.full_name as patient_name,
    pt.phone as patient_phone,
    sm.quantity,
    sm.created_at as dispensed_at
  from stock_movements sm
  join pos_sales ps on ps.id = sm.reference_id and sm.reference_type = 'pos_sale'
  join patients pt on pt.id = ps.patient_id
  where sm.batch_id = p_batch_id and sm.movement_type = 'sale' and ps.patient_id is not null

  order by dispensed_at desc
$function$
;

-- FUNCTION: get_recall_unidentified_pos_count
CREATE OR REPLACE FUNCTION public.get_recall_unidentified_pos_count(p_batch_id uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE
AS $function$
  select count(*)
  from stock_movements sm
  join pos_sales ps on ps.id = sm.reference_id and sm.reference_type = 'pos_sale'
  where sm.batch_id = p_batch_id and sm.movement_type = 'sale' and ps.patient_id is null
$function$
;

-- FUNCTION: has_active_support_grant
CREATE OR REPLACE FUNCTION public.has_active_support_grant(target_clinic_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from support_access_grants
    where clinic_id = target_clinic_id
      and platform_admin_id = (select id from platform_admins where auth_user_id = auth.uid())
      and expires_at > now()
      and revoked_at is null
  )
$function$
;

-- FUNCTION: initiate_batch_recall
CREATE OR REPLACE FUNCTION public.initiate_batch_recall(p_clinic_id uuid, p_batch_id uuid, p_initiated_by uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_recall_id uuid;
  v_initiator_role staff_role;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to initiate a batch recall';
  end if;

  select role into v_initiator_role from staff
    where id = p_initiated_by and clinic_id = p_clinic_id and is_active = true;
  if v_initiator_role not in ('admin', 'pharmacist') then
    raise exception 'Only an admin or pharmacist can initiate a batch recall, got %', v_initiator_role;
  end if;

  -- THE QUARANTINE: this status change alone removes the batch from
  -- every future FEFO pick, immediately.
  update batches set status = 'recalled' where id = p_batch_id and clinic_id = p_clinic_id;

  insert into batch_recalls (clinic_id, batch_id, initiated_by, reason)
  values (p_clinic_id, p_batch_id, p_initiated_by, p_reason)
  returning id into v_recall_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_initiated_by, 'pharmacy.batch_recalled', 'batch', p_batch_id,
    jsonb_build_object('reason', p_reason, 'recall_id', v_recall_id));

  return v_recall_id;
end;
$function$
;

-- FUNCTION: insurance_aging_detail
CREATE OR REPLACE FUNCTION public.insurance_aging_detail(p_clinic_id uuid, p_insurer_id uuid)
 RETURNS TABLE(service_charge_id uuid, patient_name text, patient_code text, description text, category text, insurer_owes_xaf numeric, kind text, claim_number text, claim_status text, age_days integer, charge_date timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  -- CLAIMED
  select
    sc.id,
    p.full_name,
    p.patient_code,
    sc.description,
    sc.category::text,
    sc.insurer_portion_xaf,
    'claimed'::text,
    claim.claim_number,
    claim.status,
    greatest(0, (current_date - date(timezone('Africa/Douala', coalesce(claim.submitted_at, claim.created_at))))),
    sc.created_at
  from insurance_claim_items ic
  join insurance_claims claim on claim.id = ic.claim_id
  join service_charges sc on sc.id = ic.service_charge_id
  join patients p on p.id = sc.patient_id
  where claim.clinic_id = p_clinic_id
    and claim.insurer_id = p_insurer_id
    and claim.status in ('submitted', 'under_review', 'approved', 'partially_approved')
    and coalesce(sc.insurer_portion_xaf, 0) > 0

  union all

  -- UNCLAIMED
  select
    sc.id,
    p.full_name,
    p.patient_code,
    sc.description,
    sc.category::text,
    sc.insurer_portion_xaf,
    'unclaimed'::text,
    null,
    null,
    greatest(0, (current_date - date(timezone('Africa/Douala', sc.created_at)))),
    sc.created_at
  from service_charges sc
  join patient_insurance pi on pi.patient_id = sc.patient_id and pi.is_active = true
  join patients p on p.id = sc.patient_id
  where sc.clinic_id = p_clinic_id
    and pi.insurer_id = p_insurer_id
    and coalesce(sc.insurer_portion_xaf, 0) > 0
    and not exists (
      select 1 from insurance_claim_items ici where ici.service_charge_id = sc.id
    )

  order by 10 desc  -- age_days descending: oldest first
$function$
;

-- FUNCTION: insurance_aging_summary
CREATE OR REPLACE FUNCTION public.insurance_aging_summary(p_clinic_id uuid)
 RETURNS TABLE(insurer_id uuid, insurer_name text, claimed_xaf numeric, unclaimed_xaf numeric, total_owed_xaf numeric, bucket_0_30 numeric, bucket_31_60 numeric, bucket_61_90 numeric, bucket_90_plus numeric, oldest_days integer)
 LANGUAGE sql
 STABLE
AS $function$
  with receivables as (
    -- CLAIMED: charges in a submitted-but-unpaid claim
    select
      claim.insurer_id,
      sc.insurer_portion_xaf as amount,
      'claimed'::text as kind,
      greatest(0, (current_date - date(timezone('Africa/Douala', coalesce(claim.submitted_at, claim.created_at))))) as age_days
    from insurance_claim_items ic
    join insurance_claims claim on claim.id = ic.claim_id
    join service_charges sc on sc.id = ic.service_charge_id
    where claim.clinic_id = p_clinic_id
      and claim.status in ('submitted', 'under_review', 'approved', 'partially_approved')
      and coalesce(sc.insurer_portion_xaf, 0) > 0

    union all

    -- UNCLAIMED: insured charges not in any claim
    select
      pi.insurer_id,
      sc.insurer_portion_xaf as amount,
      'unclaimed'::text as kind,
      greatest(0, (current_date - date(timezone('Africa/Douala', sc.created_at)))) as age_days
    from service_charges sc
    join patient_insurance pi on pi.patient_id = sc.patient_id and pi.is_active = true
    where sc.clinic_id = p_clinic_id
      and coalesce(sc.insurer_portion_xaf, 0) > 0
      and not exists (
        select 1 from insurance_claim_items ici where ici.service_charge_id = sc.id
      )
  )
  select
    i.id,
    i.name,
    coalesce(sum(r.amount) filter (where r.kind = 'claimed'), 0),
    coalesce(sum(r.amount) filter (where r.kind = 'unclaimed'), 0),
    coalesce(sum(r.amount), 0),
    coalesce(sum(r.amount) filter (where r.age_days <= 30), 0),
    coalesce(sum(r.amount) filter (where r.age_days between 31 and 60), 0),
    coalesce(sum(r.amount) filter (where r.age_days between 61 and 90), 0),
    coalesce(sum(r.amount) filter (where r.age_days > 90), 0),
    coalesce(max(r.age_days), 0)
  from insurers i
  join receivables r on r.insurer_id = i.id
  where i.clinic_id = p_clinic_id
  group by i.id, i.name
  having coalesce(sum(r.amount), 0) > 0
  order by coalesce(sum(r.amount), 0) desc
$function$
;

-- FUNCTION: inventory_alert_summary
CREATE OR REPLACE FUNCTION public.inventory_alert_summary(p_clinic_id uuid)
 RETURNS TABLE(expiring_soon_count bigint, low_stock_product_count bigint, expired_count bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_expiring_soon bigint;
  v_low_stock bigint;
  v_expired bigint;
begin
  select count(*) into v_expiring_soon
  from batches
  where clinic_id = p_clinic_id
    and status = 'active'
    and expiry_date between current_date and current_date + interval '30 days';

  select count(*) into v_low_stock
  from products p
  where p.clinic_id = p_clinic_id
    and p.is_active = true
    and (
      select coalesce(sum(batch_quantity_on_hand(b.id)), 0)
      from batches b where b.product_id = p.id and b.status = 'active'
    ) < p.reorder_threshold;

  select count(*) into v_expired
  from batches
  where clinic_id = p_clinic_id
    and status = 'active'
    and expiry_date < current_date;

  expiring_soon_count := v_expiring_soon;
  low_stock_product_count := v_low_stock;
  expired_count := v_expired;
  return next;
end;
$function$
;

-- FUNCTION: inventory_summary
CREATE OR REPLACE FUNCTION public.inventory_summary(p_clinic_id uuid)
 RETURNS TABLE(total_products bigint, stock_value_xaf numeric, low_stock_count bigint, category_count bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_total_products bigint;
  v_stock_value numeric;
  v_low_stock bigint;
  v_category_count bigint;
begin
  select count(*) into v_total_products from products where clinic_id = p_clinic_id and is_active = true;

  select coalesce(sum(batch_quantity_on_hand(b.id) * coalesce(p.cost_price_xaf, 0)), 0) into v_stock_value
  from batches b
  join products p on p.id = b.product_id
  where b.clinic_id = p_clinic_id and b.status = 'active';

  select count(*) into v_low_stock
  from products p
  where p.clinic_id = p_clinic_id and p.is_active = true
    and (
      select coalesce(sum(batch_quantity_on_hand(b.id)), 0)
      from batches b where b.product_id = p.id and b.status = 'active'
    ) < p.reorder_threshold;

  select count(distinct drug_class_id) into v_category_count
  from products where clinic_id = p_clinic_id and is_active = true and drug_class_id is not null;

  total_products := v_total_products;
  stock_value_xaf := v_stock_value;
  low_stock_count := v_low_stock;
  category_count := v_category_count;
  return next;
end;
$function$
;

-- FUNCTION: is_assigned_doctor_for_visit
CREATE OR REPLACE FUNCTION public.is_assigned_doctor_for_visit(p_visit_id uuid, p_staff_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(
    (select assigned_doctor_id = p_staff_id from visits where id = p_visit_id),
    false
  )
$function$
;

-- FUNCTION: is_platform_admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from platform_admins
    where auth_user_id = auth.uid() and is_active = true
  )
$function$
;

-- FUNCTION: is_platform_owner
CREATE OR REPLACE FUNCTION public.is_platform_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from platform_admins
    where auth_user_id = auth.uid() and is_active = true and access_level = 'owner'
  )
$function$
;

-- FUNCTION: log_visit_status_change
CREATE OR REPLACE FUNCTION public.log_visit_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  -- On INSERT: log the initial status
  if TG_OP = 'INSERT' then
    insert into visit_status_events (clinic_id, visit_id, from_status, to_status, assigned_doctor_id)
    values (NEW.clinic_id, NEW.id, null, NEW.status::text, NEW.assigned_doctor_id);
    return NEW;
  end if;

  -- On UPDATE: only log if status actually changed
  if TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
    insert into visit_status_events (clinic_id, visit_id, from_status, to_status, assigned_doctor_id)
    values (NEW.clinic_id, NEW.id, OLD.status::text, NEW.status::text, NEW.assigned_doctor_id);
  end if;

  return NEW;
end;
$function$
;

-- FUNCTION: mark_appointment_reminded
CREATE OR REPLACE FUNCTION public.mark_appointment_reminded(p_appointment_id uuid, p_called_by uuid, p_outcome text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update appointments
  set reminder_called_at = now(),
      reminder_called_by = p_called_by,
      reminder_outcome   = p_outcome
  where id = p_appointment_id;

  -- If the patient cancelled during the reminder call, reflect it on the appointment
  if p_outcome = 'cancelled' then
    update appointments set status = 'cancelled', cancelled_reason = 'Annulé lors de l''appel de rappel'
    where id = p_appointment_id;
  end if;
end;
$function$
;

-- FUNCTION: mark_po_sent
CREATE OR REPLACE FUNCTION public.mark_po_sent(p_po_id uuid, p_staff_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update purchase_orders set status = 'sent' where id = p_po_id and status = 'draft';
  if not found then
    raise exception 'Purchase order not found or not in draft status';
  end if;
end;
$function$
;

-- FUNCTION: mark_sample_collected
CREATE OR REPLACE FUNCTION public.mark_sample_collected(p_lab_order_item_id uuid, p_staff_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update lab_order_items set status = 'sample_collected'
  where id = p_lab_order_item_id and status = 'pending';

  if not found then
    raise exception 'Item not found or not in pending status';
  end if;
end;
$function$
;

-- FUNCTION: onboard_clinic_with_admin
CREATE OR REPLACE FUNCTION public.onboard_clinic_with_admin(p_clinic_name text, p_clinic_name_fr text, p_slug text, p_city text, p_quartier text, p_region text, p_phone text, p_whatsapp_number text, p_default_language text, p_admin_auth_user_id uuid, p_admin_full_name text, p_admin_phone text, p_platform_admin_id uuid)
 RETURNS TABLE(clinic_id uuid, staff_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_clinic_id uuid;
  v_staff_id uuid;
begin
  -- Guard: only platform admins may call this. is_platform_admin() checks
  -- auth.uid(), but this function runs as the calling user via RPC, so the
  -- check still applies correctly.
  if not is_platform_admin() then
    raise exception 'Only platform admins can onboard clinics';
  end if;

  insert into clinics (
    name, name_fr, slug, city, quartier, region, phone, whatsapp_number,
    default_language, onboarded_by, subscription_status
  ) values (
    p_clinic_name, p_clinic_name_fr, p_slug, p_city, p_quartier, p_region,
    p_phone, p_whatsapp_number, p_default_language, p_platform_admin_id, 'trial'
  )
  returning id into v_clinic_id;

  insert into staff (
    clinic_id, auth_user_id, full_name, role, phone, preferred_language
  ) values (
    v_clinic_id, p_admin_auth_user_id, p_admin_full_name, 'admin', p_admin_phone, p_default_language
  )
  returning id into v_staff_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (
    v_clinic_id, v_staff_id, 'clinic.onboarded', 'clinic', v_clinic_id,
    jsonb_build_object('onboarded_by', p_platform_admin_id)
  );

  return query select v_clinic_id, v_staff_id;
end;
$function$
;

-- FUNCTION: open_cashier_shift
CREATE OR REPLACE FUNCTION public.open_cashier_shift(p_clinic_id uuid, p_staff_id uuid, p_opening_cash_xaf numeric)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_shift_id uuid;
begin
  if exists (select 1 from cashier_shifts where staff_id = p_staff_id and status = 'open') then
    raise exception 'This staff member already has an open shift — close it before opening a new one';
  end if;

  insert into cashier_shifts (clinic_id, staff_id, opening_cash_xaf)
  values (p_clinic_id, p_staff_id, p_opening_cash_xaf)
  returning id into v_shift_id;

  return v_shift_id;
end;
$function$
;

-- FUNCTION: open_invoice_for_charge
CREATE OR REPLACE FUNCTION public.open_invoice_for_charge(p_service_charge_id uuid, p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_charge record;
  v_invoice_id uuid;
begin
  select * into v_charge from service_charges where id = p_service_charge_id;
  if v_charge.id is null then
    raise exception 'Service charge % not found', p_service_charge_id;
  end if;

  insert into invoices (clinic_id, patient_id, visit_id, total_amount_xaf, created_by)
  values (v_charge.clinic_id, v_charge.patient_id, v_charge.visit_id, v_charge.amount_xaf, p_created_by)
  returning id into v_invoice_id;

  insert into invoice_items (invoice_id, service_charge_id, amount_xaf)
  values (v_invoice_id, p_service_charge_id, v_charge.amount_xaf);

  return v_invoice_id;
end;
$function$
;

-- FUNCTION: open_invoice_for_charges
CREATE OR REPLACE FUNCTION public.open_invoice_for_charges(p_service_charge_ids uuid[], p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_clinic_id uuid;
  v_patient_id uuid;
  v_visit_id uuid;
  v_total numeric(10,2) := 0;
  v_invoice_id uuid;
  v_charge record;
begin
  if array_length(p_service_charge_ids, 1) is null then
    raise exception 'No charges provided';
  end if;

  for v_charge in select * from service_charges where id = any(p_service_charge_ids)
  loop
    v_clinic_id := v_charge.clinic_id;
    v_patient_id := v_charge.patient_id;
    v_visit_id := v_charge.visit_id;
    v_total := v_total + v_charge.amount_xaf;
  end loop;

  insert into invoices (clinic_id, patient_id, visit_id, total_amount_xaf, created_by)
  values (v_clinic_id, v_patient_id, v_visit_id, v_total, p_created_by)
  returning id into v_invoice_id;

  insert into invoice_items (invoice_id, service_charge_id, amount_xaf)
  select v_invoice_id, sc.id, sc.amount_xaf
  from service_charges sc where sc.id = any(p_service_charge_ids);

  return v_invoice_id;
end;
$function$
;

-- FUNCTION: outstanding_balance_summary
CREATE OR REPLACE FUNCTION public.outstanding_balance_summary(p_clinic_id uuid)
 RETURNS TABLE(total_outstanding_xaf numeric, unpaid_charge_count bigint, emergency_unpaid_count bigint, overdue_outstanding_xaf numeric, overdue_charge_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select
    coalesce(sum(sc.amount_xaf - sc.amount_paid_xaf) filter (where sc.status in ('pending','partial')), 0),
    count(*) filter (where sc.status in ('pending','partial')),
    count(distinct v.id) filter (where v.is_emergency and sc.status in ('pending','partial')),
    coalesce(sum(sc.amount_xaf - sc.amount_paid_xaf) filter (
      where sc.status in ('pending','partial') and sc.service_date < current_date - interval '3 days'
    ), 0),
    count(*) filter (
      where sc.status in ('pending','partial') and sc.service_date < current_date - interval '3 days'
    )
  from service_charges sc
  join visits v on v.id = sc.visit_id
  where sc.clinic_id = p_clinic_id and sc.status <> 'void'
$function$
;

-- FUNCTION: pharmacy_daily_revenue
CREATE OR REPLACE FUNCTION public.pharmacy_daily_revenue(p_clinic_id uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(report_date date, revenue_xaf numeric, transaction_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select
    d.report_date,
    coalesce(pos.revenue, 0) + coalesce(disp.revenue, 0) as revenue_xaf,
    coalesce(pos.txns, 0) + coalesce(disp.txns, 0) as transaction_count
  from (
    select generate_series(current_date - (p_days - 1), current_date, '1 day')::date as report_date
  ) d
  left join (
    select date(timezone('Africa/Douala', created_at)) as day, sum(total_amount_xaf) as revenue, count(*) as txns
    from pos_sales
    where clinic_id = p_clinic_id and status = 'completed'
    group by date(timezone('Africa/Douala', created_at))
  ) pos on pos.day = d.report_date
  left join (
    select date(timezone('Africa/Douala', pay.created_at)) as day,
           sum(psp.amount_xaf) as revenue, count(distinct pay.id) as txns
    from payment_splits psp
    join payments pay on pay.id = psp.payment_id
    join invoice_items ii on ii.invoice_id = pay.invoice_id
    join service_charges sc on sc.id = ii.service_charge_id
    where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and pay.status = 'completed'
    group by date(timezone('Africa/Douala', pay.created_at))
  ) disp on disp.day = d.report_date
  order by d.report_date desc
$function$
;

-- FUNCTION: pharmacy_items_sold
CREATE OR REPLACE FUNCTION public.pharmacy_items_sold(p_clinic_id uuid, p_days integer DEFAULT 30)
 RETURNS bigint
 LANGUAGE sql
 STABLE
AS $function$
  select
    coalesce((
      select sum(psi.quantity) from pos_sale_items psi
      join pos_sales ps on ps.id = psi.pos_sale_id
      where ps.clinic_id = p_clinic_id and ps.status = 'completed'
        and ps.created_at >= current_date - p_days
    ), 0)
    +
    coalesce((
      select sum(sc.quantity) from service_charges sc
      where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and sc.product_id is not null
        and sc.status <> 'void' and sc.service_date >= current_date - p_days
    ), 0)
$function$
;

-- FUNCTION: pharmacy_today_sales
CREATE OR REPLACE FUNCTION public.pharmacy_today_sales(p_clinic_id uuid)
 RETURNS TABLE(pos_sales_xaf numeric, dispensing_payments_xaf numeric, total_xaf numeric)
 LANGUAGE sql
 STABLE
AS $function$
  select
    coalesce((
      select sum(total_amount_xaf) from pos_sales
      where clinic_id = p_clinic_id and status = 'completed'
        and date(timezone('Africa/Douala', created_at)) = date(timezone('Africa/Douala', now()))
    ), 0),
    coalesce((
      select sum(psp.amount_xaf)
      from payment_splits psp
      join payments pay on pay.id = psp.payment_id
      join invoice_items ii on ii.invoice_id = pay.invoice_id
      join service_charges sc on sc.id = ii.service_charge_id
      where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and pay.status = 'completed'
        and date(timezone('Africa/Douala', pay.created_at)) = date(timezone('Africa/Douala', now()))
    ), 0),
    coalesce((
      select sum(total_amount_xaf) from pos_sales
      where clinic_id = p_clinic_id and status = 'completed'
        and date(timezone('Africa/Douala', created_at)) = date(timezone('Africa/Douala', now()))
    ), 0)
    +
    coalesce((
      select sum(psp.amount_xaf)
      from payment_splits psp
      join payments pay on pay.id = psp.payment_id
      join invoice_items ii on ii.invoice_id = pay.invoice_id
      join service_charges sc on sc.id = ii.service_charge_id
      where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and pay.status = 'completed'
        and date(timezone('Africa/Douala', pay.created_at)) = date(timezone('Africa/Douala', now()))
    ), 0)
$function$
;

-- FUNCTION: preview_fefo_pick
CREATE OR REPLACE FUNCTION public.preview_fefo_pick(p_product_id uuid, p_quantity_needed integer)
 RETURNS TABLE(batch_id uuid, batch_number text, expiry_date date, available_quantity integer, quantity_to_take integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_remaining int := p_quantity_needed;
  v_batch record;
  v_take int;
begin
  for v_batch in
    select b.id, b.batch_number, b.expiry_date, batch_quantity_on_hand(b.id) as qty
    from batches b
    where b.product_id = p_product_id
      and b.status = 'active'
      and b.expiry_date >= current_date   -- expired batches never appear in the normal pick
    order by b.expiry_date asc            -- FEFO: earliest expiry first
  loop
    exit when v_remaining <= 0;
    if v_batch.qty <= 0 then
      continue;
    end if;

    v_take := least(v_batch.qty, v_remaining);
    batch_id := v_batch.id;
    batch_number := v_batch.batch_number;
    expiry_date := v_batch.expiry_date;
    available_quantity := v_batch.qty;
    quantity_to_take := v_take;
    return next;

    v_remaining := v_remaining - v_take;
  end loop;

  -- Not raising an exception here even if v_remaining > 0 at the end —
  -- the caller (dispensing screen) needs to see a partial plan and show
  -- "only 8 of 10 available" rather than get a hard failure mid-preview.
end;
$function$
;

-- FUNCTION: profit_margin_summary
CREATE OR REPLACE FUNCTION public.profit_margin_summary(p_clinic_id uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(total_revenue_xaf numeric, known_cost_revenue_xaf numeric, total_cost_xaf numeric, total_profit_xaf numeric, margin_pct numeric, data_coverage_pct numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

-- FUNCTION: provision_clinic
CREATE OR REPLACE FUNCTION public.provision_clinic(p_clinic_name text, p_template_clinic_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinic_id uuid;
  v_test record;
  v_new_test_id uuid;
  v_clt record;
  v_panel record;
  v_new_panel_id uuid;
  v_item record;
begin
  select id into v_clinic_id from clinics where name = p_clinic_name;
  if found then
    return v_clinic_id; -- idempotent retry — see header comment
  end if;

  insert into clinics (name) values (p_clinic_name) returning id into v_clinic_id;

  if p_template_clinic_id is not null then
    -- Services: no cross-referencing needed, straight copy.
    insert into service_prices (clinic_id, service_name, category, price_xaf, service_code, is_active)
    select v_clinic_id, service_name, category, price_xaf, service_code, is_active
    from service_prices where clinic_id = p_template_clinic_id;

    -- Wards: same, no cross-referencing.
    insert into wards (clinic_id, name, code, ward_type, capacity, daily_rate_xaf, is_active)
    select v_clinic_id, name, code, ward_type, capacity, daily_rate_xaf, is_active
    from wards where clinic_id = p_template_clinic_id;

    -- Lab tests: each cloned catalog row gets a NEW id (lab_test_catalog
    -- is clinic-owned as of migration 95 — this clinic gets its own
    -- rows, not a link back to the template's). A plain loop, not a
    -- clever bulk INSERT...SELECT...RETURNING, because the old→new id
    -- mapping is needed afterward for clinic_lab_tests and panel items,
    -- and Postgres can't carry an untracked "old_id" column through a
    -- writable CTE's RETURNING — a loop is the correct tool here, not
    -- a shortcut around one.
    create temp table test_id_map (old_id uuid primary key, new_id uuid not null) on commit drop;

    for v_test in select * from lab_test_catalog where clinic_id = p_template_clinic_id loop
      insert into lab_test_catalog (
        clinic_id, name_fr, name_en, category, specimen_type, unit, result_type,
        reference_range_low, reference_range_high, critical_low, critical_high,
        qualitative_options, abnormal_qualitative_values, critical_qualitative_values
      ) values (
        v_clinic_id, v_test.name_fr, v_test.name_en, v_test.category, v_test.specimen_type, v_test.unit, v_test.result_type,
        v_test.reference_range_low, v_test.reference_range_high, v_test.critical_low, v_test.critical_high,
        v_test.qualitative_options, v_test.abnormal_qualitative_values, v_test.critical_qualitative_values
      ) returning id into v_new_test_id;

      insert into test_id_map (old_id, new_id) values (v_test.id, v_new_test_id);

      select * into v_clt from clinic_lab_tests
        where clinic_id = p_template_clinic_id and lab_test_catalog_id = v_test.id;
      if found then
        insert into clinic_lab_tests (
          clinic_id, lab_test_catalog_id, price_xaf, is_active,
          override_reference_range_low, override_reference_range_high,
          override_critical_low, override_critical_high,
          override_abnormal_qualitative_values, override_critical_qualitative_values
        ) values (
          v_clinic_id, v_new_test_id, v_clt.price_xaf, v_clt.is_active,
          v_clt.override_reference_range_low, v_clt.override_reference_range_high,
          v_clt.override_critical_low, v_clt.override_critical_high,
          v_clt.override_abnormal_qualitative_values, v_clt.override_critical_qualitative_values
        );
      end if;
    end loop;

    -- Lab panels: same new-id-per-clinic reasoning, plus their item
    -- links have to be rebuilt against the NEW test ids via the map
    -- just built above.
    create temp table panel_id_map (old_id uuid primary key, new_id uuid not null) on commit drop;

    for v_panel in select * from lab_panels where clinic_id = p_template_clinic_id loop
      insert into lab_panels (clinic_id, name_fr, name_en, category)
      values (v_clinic_id, v_panel.name_fr, v_panel.name_en, v_panel.category)
      returning id into v_new_panel_id;

      insert into panel_id_map (old_id, new_id) values (v_panel.id, v_new_panel_id);

      for v_item in select * from lab_panel_items where panel_id = v_panel.id loop
        insert into lab_panel_items (panel_id, lab_test_catalog_id)
        select v_new_panel_id, tm.new_id
        from test_id_map tm where tm.old_id = v_item.lab_test_catalog_id;
      end loop;

      insert into clinic_lab_panels (clinic_id, lab_panel_id, price_xaf, is_active)
      select v_clinic_id, v_new_panel_id, cp.price_xaf, cp.is_active
      from clinic_lab_panels cp
      where cp.clinic_id = p_template_clinic_id and cp.lab_panel_id = v_panel.id;
    end loop;
  end if;

  return v_clinic_id;
end;
$function$
;

-- FUNCTION: recommend_admission
CREATE OR REPLACE FUNCTION public.recommend_admission(p_clinic_id uuid, p_visit_id uuid, p_recommended_by uuid, p_admission_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_patient_id uuid;
  v_admission_id uuid;
  v_admission_number text;
begin
  select patient_id into v_patient_id from visits where id = p_visit_id and clinic_id = p_clinic_id;
  if v_patient_id is null then
    raise exception 'Visit % not found for this clinic', p_visit_id;
  end if;

  v_admission_number := generate_next_admission_number(p_clinic_id);

  insert into admissions (
    clinic_id, admission_number, patient_id, visit_id, source, recommended_by, admission_reason
  ) values (
    p_clinic_id, v_admission_number, v_patient_id, p_visit_id, 'doctor', p_recommended_by, p_admission_reason
  )
  returning id into v_admission_id;

  update visits set status = 'admitted' where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_recommended_by, 'admission.recommended', 'admission', v_admission_id,
    jsonb_build_object('admission_number', v_admission_number, 'reason', p_admission_reason));

  return v_admission_id;
end;
$function$
;

-- FUNCTION: record_care_task
CREATE OR REPLACE FUNCTION public.record_care_task(p_clinic_id uuid, p_admission_id uuid, p_completed_by uuid, p_task_description text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_id uuid;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted') then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;
  if p_task_description is null or trim(p_task_description) = '' then
    raise exception 'Task description cannot be empty';
  end if;

  insert into care_tasks (clinic_id, admission_id, completed_by, task_description)
  values (p_clinic_id, p_admission_id, p_completed_by, p_task_description)
  returning id into v_id;

  return v_id;
end;
$function$
;

-- FUNCTION: record_claim_payment
CREATE OR REPLACE FUNCTION public.record_claim_payment(p_clinic_id uuid, p_claim_id uuid, p_amount_received_xaf numeric, p_received_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_claim record;
  v_item record;
  v_ratio numeric;
  v_item_payment numeric(10,2);
  v_invoice_id uuid;
begin
  select * into v_claim from insurance_claims where id = p_claim_id and clinic_id = p_clinic_id;
  if v_claim.id is null then
    raise exception 'Claim not found in this clinic';
  end if;
  if p_amount_received_xaf <= 0 or p_amount_received_xaf > v_claim.total_claimed_xaf then
    raise exception 'Amount received must be positive and cannot exceed the claimed total of %', v_claim.total_claimed_xaf;
  end if;

  v_ratio := p_amount_received_xaf / v_claim.total_claimed_xaf;

  for v_item in
    select ici.service_charge_id, ici.amount_xaf, sc.status as charge_status
    from insurance_claim_items ici
    join service_charges sc on sc.id = ici.service_charge_id
    where ici.claim_id = p_claim_id
  loop
    if v_item.charge_status = 'void' then
      continue;
    end if;

    v_item_payment := round(v_item.amount_xaf * v_ratio, 2);
    if v_item_payment <= 0 then
      continue;
    end if;

    select ii.invoice_id into v_invoice_id
    from invoice_items ii
    where ii.service_charge_id = v_item.service_charge_id
    limit 1;

    if v_invoice_id is not null then
      perform create_payment(
        v_invoice_id, v_item_payment, p_received_by,
        jsonb_build_array(jsonb_build_object('method', 'insurance', 'amount', v_item_payment, 'provider_transaction_ref', v_claim.claim_number))
      );
    end if;
  end loop;

  update insurance_claims set status = 'paid', total_approved_xaf = p_amount_received_xaf
  where id = p_claim_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_received_by, 'insurance.claim_paid', 'insurance_claim', p_claim_id,
    jsonb_build_object('amount_received_xaf', p_amount_received_xaf));
end;
$function$
;

-- FUNCTION: record_goods_receipt
CREATE OR REPLACE FUNCTION public.record_goods_receipt(p_clinic_id uuid, p_supplier_id uuid, p_received_by uuid, p_invoice_reference text, p_notes text, p_items jsonb, p_purchase_order_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_receipt_id uuid;
  v_item jsonb;
  v_batch_id uuid;
  v_product_id uuid;
  v_batch_number text;
  v_expiry_date date;
  v_quantity int;
  v_unit_cost numeric(10,2);
  v_po_fully_received boolean;
begin
  insert into goods_receipts (clinic_id, supplier_id, received_by, invoice_reference, notes, purchase_order_id)
  values (p_clinic_id, p_supplier_id, p_received_by, p_invoice_reference, p_notes, p_purchase_order_id)
  returning id into v_receipt_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_batch_number := v_item->>'batch_number';
    v_expiry_date := (v_item->>'expiry_date')::date;
    v_quantity := (v_item->>'quantity')::int;
    v_unit_cost := (v_item->>'unit_cost_xaf')::numeric;

    select id into v_batch_id from batches
      where clinic_id = p_clinic_id and product_id = v_product_id and batch_number = v_batch_number;

    if v_batch_id is null then
      insert into batches (
        clinic_id, product_id, batch_number, expiry_date, quantity_received, unit_cost_xaf, received_by
      ) values (
        p_clinic_id, v_product_id, v_batch_number, v_expiry_date, v_quantity, v_unit_cost, p_received_by
      )
      returning id into v_batch_id;
    end if;

    perform record_stock_movement(
      v_batch_id, 'receipt', v_quantity, 'goods_receipt', v_receipt_id,
      null, p_received_by
    );

    insert into goods_receipt_items (goods_receipt_id, product_id, batch_id, quantity, unit_cost_xaf)
    values (v_receipt_id, v_product_id, v_batch_id, v_quantity, v_unit_cost);

    -- PO matching: apply received quantity to the corresponding PO item.
    if p_purchase_order_id is not null then
      update purchase_order_items
        set quantity_received = quantity_received + v_quantity
        where purchase_order_id = p_purchase_order_id and product_id = v_product_id;
    end if;
  end loop;

  -- Recompute PO status once, after all items processed.
  if p_purchase_order_id is not null then
    select bool_and(quantity_received >= quantity_ordered) into v_po_fully_received
    from purchase_order_items where purchase_order_id = p_purchase_order_id;

    update purchase_orders set status = case
      when v_po_fully_received then 'received'
      else 'partially_received'
    end::po_status
    where id = p_purchase_order_id and status in ('sent', 'partially_received');
  end if;

  return v_receipt_id;
end;
$function$
;

-- FUNCTION: record_inpatient_note
CREATE OR REPLACE FUNCTION public.record_inpatient_note(p_clinic_id uuid, p_admission_id uuid, p_recorded_by uuid, p_note text, p_round_type text DEFAULT 'doctor_round'::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_note_id uuid;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted') then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;
  if p_note is null or trim(p_note) = '' then
    raise exception 'Note cannot be empty';
  end if;

  insert into inpatient_notes (clinic_id, admission_id, recorded_by, note, round_type)
  values (p_clinic_id, p_admission_id, p_recorded_by, p_note, p_round_type)
  returning id into v_note_id;

  return v_note_id;
end;
$function$
;

-- FUNCTION: record_inpatient_note
CREATE OR REPLACE FUNCTION public.record_inpatient_note(p_clinic_id uuid, p_admission_id uuid, p_recorded_by uuid, p_note text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_note_id uuid;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted') then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;
  if p_note is null or trim(p_note) = '' then
    raise exception 'Note cannot be empty';
  end if;

  insert into inpatient_notes (clinic_id, admission_id, recorded_by, note)
  values (p_clinic_id, p_admission_id, p_recorded_by, p_note)
  returning id into v_note_id;

  return v_note_id;
end;
$function$
;

-- FUNCTION: record_medication_administration
CREATE OR REPLACE FUNCTION public.record_medication_administration(p_clinic_id uuid, p_prescription_item_id uuid, p_admission_id uuid, p_administered_by uuid, p_status text, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_id uuid;
  v_dispensed_total int;
  v_administered_count int;
  v_drug_name text;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted') then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;
  if p_status not in ('administered', 'refused', 'missed') then
    raise exception 'Invalid administration status: %', p_status;
  end if;

  if p_status = 'administered' then
    select coalesce(sum(dr.quantity_dispensed), 0) into v_dispensed_total
    from dispensing_records dr
    where dr.prescription_item_id = p_prescription_item_id;

    select count(*) into v_administered_count
    from medication_administrations ma
    where ma.prescription_item_id = p_prescription_item_id
      and ma.status = 'administered';

    if v_administered_count >= v_dispensed_total then
      select coalesce(pi.drug_name_freetext, pr.name, 'This medication')
        into v_drug_name
      from prescription_items pi
      left join products pr on pr.id = pi.product_id
      where pi.id = p_prescription_item_id;

      raise exception '% has not been dispensed by the pharmacy yet — % of % dispensed doses already logged as administered. Send the prescription to Dispensing before charting this dose.',
        v_drug_name, v_administered_count, v_dispensed_total;
    end if;
  end if;

  insert into medication_administrations (
    clinic_id, prescription_item_id, admission_id, administered_by, status, notes
  ) values (
    p_clinic_id, p_prescription_item_id, p_admission_id, p_administered_by, p_status, p_notes
  )
  returning id into v_id;

  return v_id;
end;
$function$
;

-- FUNCTION: record_patient_deposit
CREATE OR REPLACE FUNCTION public.record_patient_deposit(p_clinic_id uuid, p_patient_id uuid, p_amount_xaf numeric, p_method text, p_received_by uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_ledger_id uuid;
begin
  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;
  if p_amount_xaf <= 0 then
    raise exception 'Deposit amount must be positive';
  end if;
  if p_method not in ('cash', 'momo', 'orange_money') then
    raise exception 'Invalid deposit funding method: %', p_method;
  end if;

  insert into patient_deposit_ledger (clinic_id, patient_id, entry_type, amount_xaf, method, staff_id, notes)
  values (p_clinic_id, p_patient_id, 'deposit', p_amount_xaf, p_method, p_received_by, p_notes)
  returning id into v_ledger_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_received_by, 'billing.deposit_recorded', 'patient', p_patient_id,
    jsonb_build_object('amount_xaf', p_amount_xaf, 'method', p_method));

  return v_ledger_id;
end;
$function$
;

-- FUNCTION: record_pos_sale
CREATE OR REPLACE FUNCTION public.record_pos_sale(p_clinic_id uuid, p_patient_id uuid, p_sold_by uuid, p_payment_method payment_method, p_cart jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_sale_id uuid;
  v_cart_item jsonb;
  v_product record;
  v_total numeric(10,2) := 0;
  v_subtotal numeric(10,2);
begin
  -- Pass 1: validate the whole cart BEFORE committing to anything — refuse
  -- the entire sale if any single line is a controlled substance, rather
  -- than partially selling the cart and rejecting one line.
  for v_cart_item in select * from jsonb_array_elements(p_cart)
  loop
    select pr.id, pr.sale_price_xaf, coalesce(dc.is_controlled, false) as is_controlled
      into v_product
    from products pr
    left join drug_classes dc on dc.id = pr.drug_class_id
    where pr.id = (v_cart_item->>'product_id')::uuid
      and pr.clinic_id = p_clinic_id;

    if v_product.id is null then
      raise exception 'Product % not found in this clinic', v_cart_item->>'product_id';
    end if;

    if v_product.is_controlled then
      raise exception 'Controlled substances cannot be sold via POS — this must go through a prescription with a witness';
    end if;
  end loop;

  insert into pos_sales (clinic_id, patient_id, sold_by, payment_method, total_amount_xaf)
  values (p_clinic_id, p_patient_id, p_sold_by, p_payment_method, 0)
  returning id into v_sale_id;

  -- Pass 2: now actually take stock and record line items
  for v_cart_item in select * from jsonb_array_elements(p_cart)
  loop
    select pr.id, pr.sale_price_xaf into v_product
    from products pr where pr.id = (v_cart_item->>'product_id')::uuid;

    v_subtotal := v_product.sale_price_xaf * (v_cart_item->>'quantity')::int;
    v_total := v_total + v_subtotal;

    perform dispense_fefo(
      p_clinic_id, v_product.id, (v_cart_item->>'quantity')::int,
      'pos_sale', v_sale_id, p_sold_by,
      false, null, null, null, 'sale'
    );

    insert into pos_sale_items (pos_sale_id, product_id, quantity, unit_price_xaf, subtotal_xaf)
    values (v_sale_id, v_product.id, (v_cart_item->>'quantity')::int, v_product.sale_price_xaf, v_subtotal);
  end loop;

  update pos_sales set total_amount_xaf = v_total where id = v_sale_id;

  return v_sale_id;
end;
$function$
;

-- FUNCTION: record_stock_adjustment
CREATE OR REPLACE FUNCTION public.record_stock_adjustment(p_clinic_id uuid, p_batch_id uuid, p_quantity integer, p_direction text, p_reason text, p_staff_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to adjust stock';
  end if;
  if p_direction not in ('increase', 'decrease') then
    raise exception 'Direction must be increase or decrease';
  end if;

  perform record_stock_movement(
    p_batch_id,
    case when p_direction = 'increase' then 'adjustment_increase' else 'adjustment' end,
    p_quantity, 'manual_adjustment', null, p_reason, p_staff_id
  );

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_staff_id, 'pharmacy.stock_adjusted', 'batch', p_batch_id,
    jsonb_build_object('direction', p_direction, 'quantity', p_quantity, 'reason', p_reason));
end;
$function$
;

-- FUNCTION: record_stock_movement
CREATE OR REPLACE FUNCTION public.record_stock_movement(p_batch_id uuid, p_movement_type stock_movement_type, p_quantity integer, p_reference_type text, p_reference_id uuid, p_notes text, p_staff_id uuid, p_dispensing_record_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_clinic_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive (got %)', p_quantity;
  end if;

  select p.clinic_id into v_clinic_id
  from batches b join products p on p.id = b.product_id
  where b.id = p_batch_id;

  if v_clinic_id is null then
    raise exception 'Batch % not found or has no clinic', p_batch_id;
  end if;

  insert into stock_movements (
    clinic_id, batch_id, movement_type, quantity,
    reference_type, reference_id, notes, created_by, dispensing_record_id
  ) values (
    v_clinic_id, p_batch_id, p_movement_type, p_quantity,
    p_reference_type, p_reference_id, p_notes, p_staff_id, p_dispensing_record_id
  );
end;
$function$
;

-- FUNCTION: record_supplier_invoice
CREATE OR REPLACE FUNCTION public.record_supplier_invoice(p_clinic_id uuid, p_supplier_id uuid, p_purchase_order_id uuid, p_invoice_number text, p_invoice_date date, p_total_amount_xaf numeric, p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_invoice_id uuid;
  v_terms_days int;
  v_due_date date;
begin
  select payment_terms_days into v_terms_days from suppliers where id = p_supplier_id;
  v_due_date := coalesce(p_invoice_date, current_date) + coalesce(v_terms_days, 0);

  insert into supplier_invoices (
    clinic_id, supplier_id, purchase_order_id, invoice_number, invoice_date, due_date, total_amount_xaf, created_by
  ) values (
    p_clinic_id, p_supplier_id, p_purchase_order_id, p_invoice_number,
    coalesce(p_invoice_date, current_date), v_due_date, p_total_amount_xaf, p_created_by
  )
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$function$
;

-- FUNCTION: record_supplier_payment
CREATE OR REPLACE FUNCTION public.record_supplier_payment(p_supplier_invoice_id uuid, p_amount_xaf numeric, p_payment_method text, p_reference text, p_paid_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_invoice record;
begin
  select * into v_invoice from supplier_invoices where id = p_supplier_invoice_id for update;
  if v_invoice.id is null then
    raise exception 'Supplier invoice % not found', p_supplier_invoice_id;
  end if;

  if v_invoice.amount_paid_xaf + p_amount_xaf > v_invoice.total_amount_xaf then
    raise exception 'Payment of % would exceed the invoice total (% already paid of %)',
      p_amount_xaf, v_invoice.amount_paid_xaf, v_invoice.total_amount_xaf;
  end if;

  insert into supplier_payments (clinic_id, supplier_invoice_id, amount_xaf, payment_method, reference, paid_by)
  values (v_invoice.clinic_id, p_supplier_invoice_id, p_amount_xaf, p_payment_method, p_reference, p_paid_by);

  update supplier_invoices set
    amount_paid_xaf = amount_paid_xaf + p_amount_xaf,
    status = case
      when amount_paid_xaf + p_amount_xaf >= total_amount_xaf then 'paid'
      else 'partial'
    end::supplier_invoice_status
  where id = p_supplier_invoice_id;
end;
$function$
;

-- FUNCTION: record_supplier_return
CREATE OR REPLACE FUNCTION public.record_supplier_return(p_clinic_id uuid, p_supplier_id uuid, p_batch_id uuid, p_quantity integer, p_reason text, p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_return_id uuid;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to return stock to a supplier';
  end if;

  -- record_stock_movement already enforces sufficient stock exists
  -- (can't return more than is actually on hand) via its own check —
  -- reusing it here means this gets that safety net for free.
  perform record_stock_movement(
    p_batch_id, 'return_to_supplier', p_quantity, 'supplier_return', null,
    p_reason, p_created_by
  );

  insert into supplier_returns (clinic_id, supplier_id, batch_id, quantity, reason, created_by)
  values (p_clinic_id, p_supplier_id, p_batch_id, p_quantity, p_reason, p_created_by)
  returning id into v_return_id;

  -- Backfill the reference_id on the movement we just created, now that
  -- we have the return's own id (record_stock_movement needed to run
  -- first to get the concurrency-safe lock and quantity check).
  -- Postgres UPDATE doesn't support ORDER BY/LIMIT directly (that's
  -- MySQL syntax) — select the target row's id via a subquery instead.
  update stock_movements set reference_id = v_return_id
  where id = (
    select id from stock_movements
    where batch_id = p_batch_id and reference_type = 'supplier_return' and reference_id is null
    order by created_at desc
    limit 1
  );

  return v_return_id;
end;
$function$
;

-- FUNCTION: record_vital_signs
CREATE OR REPLACE FUNCTION public.record_vital_signs(p_clinic_id uuid, p_admission_id uuid, p_recorded_by uuid, p_bp_systolic integer, p_bp_diastolic integer, p_heart_rate integer, p_temperature_celsius numeric, p_respiratory_rate integer, p_oxygen_saturation integer, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_id uuid;
begin
  if not exists (select 1 from admissions where id = p_admission_id and clinic_id = p_clinic_id and status = 'admitted') then
    raise exception 'Admission not found, or the patient is not currently admitted';
  end if;

  insert into vital_signs (
    clinic_id, admission_id, recorded_by, blood_pressure_systolic, blood_pressure_diastolic,
    heart_rate, temperature_celsius, respiratory_rate, oxygen_saturation, notes
  ) values (
    p_clinic_id, p_admission_id, p_recorded_by, p_bp_systolic, p_bp_diastolic,
    p_heart_rate, p_temperature_celsius, p_respiratory_rate, p_oxygen_saturation, p_notes
  )
  returning id into v_id;

  return v_id;
end;
$function$
;

-- FUNCTION: register_visit_with_charge
CREATE OR REPLACE FUNCTION public.register_visit_with_charge(p_clinic_id uuid, p_patient_id uuid, p_visit_reason text, p_service_price_id uuid, p_registered_by uuid, p_assigned_doctor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(visit_id uuid, service_charge_id uuid, amount_xaf numeric)
 LANGUAGE plpgsql
AS $function$
declare
  v_visit_id uuid;
  v_charge_id uuid;
  v_amount numeric(10,2);
  v_service_name text;
begin
  -- THE FIX: verify the patient actually belongs to this clinic before
  -- creating a visit for them. Everything else in this function already
  -- checked its own foreign references (service price, assigned
  -- doctor) — the patient itself was the one gap.
  if not exists (select 1 from patients where id = p_patient_id and clinic_id = p_clinic_id) then
    raise exception 'Patient does not belong to this clinic';
  end if;

  select price_xaf, service_name into v_amount, v_service_name
  from service_prices where id = p_service_price_id and clinic_id = p_clinic_id;

  if v_amount is null then
    raise exception 'Service price % not found for this clinic', p_service_price_id;
  end if;

  if p_assigned_doctor_id is not null and not exists (
    select 1 from staff where id = p_assigned_doctor_id and clinic_id = p_clinic_id
      and role = 'doctor' and is_active = true
  ) then
    raise exception 'Selected doctor not found or inactive in this clinic';
  end if;

  begin
    insert into visits (clinic_id, patient_id, visit_reason, status, registered_by, assigned_doctor_id)
    values (p_clinic_id, p_patient_id, p_visit_reason, 'registered', p_registered_by, p_assigned_doctor_id)
    returning id into v_visit_id;
  exception
    when unique_violation then
      raise exception 'This patient already has an active visit in progress — check the queue rather than starting a new one';
  end;

  v_charge_id := create_service_charge(
    p_clinic_id, p_patient_id, v_visit_id, p_service_price_id,
    'consultation', v_service_name, v_amount, p_registered_by
  );

  return query select v_visit_id, v_charge_id, v_amount;
end;
$function$
;

-- FUNCTION: reject_discount
CREATE OR REPLACE FUNCTION public.reject_discount(p_discount_id uuid, p_rejected_by uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_discount record;
  v_rejecter_role staff_role;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to reject a discount request';
  end if;

  select * into v_discount from discounts where id = p_discount_id for update;
  if v_discount.id is null then
    raise exception 'Discount request % not found', p_discount_id;
  end if;
  if v_discount.status <> 'pending_approval' then
    raise exception 'Discount request % is not pending (status: %)', p_discount_id, v_discount.status;
  end if;

  select role into v_rejecter_role from staff
    where id = p_rejected_by and clinic_id = v_discount.clinic_id and is_active = true;
  if v_rejecter_role <> 'admin' then
    raise exception 'Only an admin can reject a discount request';
  end if;

  update discounts set status = 'rejected', rejected_reason = p_reason where id = p_discount_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_discount.clinic_id, p_rejected_by, 'billing.discount_rejected', 'service_charge', v_discount.service_charge_id,
    jsonb_build_object('reason', p_reason, 'requested_by', v_discount.requested_by));
end;
$function$
;

-- FUNCTION: request_discount
CREATE OR REPLACE FUNCTION public.request_discount(p_service_charge_id uuid, p_requested_by uuid, p_discount_amount_xaf numeric, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_charge record;
  v_threshold numeric(10,2);
  v_remaining_unpaid numeric(10,2);
  v_discount_id uuid;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to request a discount';
  end if;

  select * into v_charge from service_charges where id = p_service_charge_id for update;
  if v_charge.id is null then
    raise exception 'Service charge % not found', p_service_charge_id;
  end if;

  v_remaining_unpaid := v_charge.amount_xaf - v_charge.amount_paid_xaf;
  if p_discount_amount_xaf > v_remaining_unpaid then
    raise exception 'Discount of % exceeds the unpaid balance of % on this charge — amounts already paid require a refund, not a discount', p_discount_amount_xaf, v_remaining_unpaid;
  end if;

  select coalesce(discount_auto_approve_max_xaf, 5000) into v_threshold
  from app_settings where clinic_id = v_charge.clinic_id;
  if v_threshold is null then
    v_threshold := 5000; -- no app_settings row yet for this clinic — safe default
  end if;

  if p_discount_amount_xaf <= v_threshold then
    -- Auto-approved: apply immediately.
    update service_charges set amount_xaf = amount_xaf - p_discount_amount_xaf
      where id = p_service_charge_id;

    insert into discounts (clinic_id, service_charge_id, requested_by, discount_amount_xaf, reason, status, approved_by, approved_at)
    values (v_charge.clinic_id, p_service_charge_id, p_requested_by, p_discount_amount_xaf, p_reason, 'approved', p_requested_by, now())
    returning id into v_discount_id;

    insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
    values (v_charge.clinic_id, p_requested_by, 'billing.discount_auto_approved', 'service_charge', p_service_charge_id,
      jsonb_build_object('amount', p_discount_amount_xaf, 'reason', p_reason));

    return jsonb_build_object('discount_id', v_discount_id, 'status', 'approved');
  else
    -- Above threshold: sits pending, charge is untouched until an admin acts.
    insert into discounts (clinic_id, service_charge_id, requested_by, discount_amount_xaf, reason, status)
    values (v_charge.clinic_id, p_service_charge_id, p_requested_by, p_discount_amount_xaf, p_reason, 'pending_approval')
    returning id into v_discount_id;

    return jsonb_build_object('discount_id', v_discount_id, 'status', 'pending_approval');
  end if;
end;
$function$
;

-- FUNCTION: resolve_batch_recall
CREATE OR REPLACE FUNCTION public.resolve_batch_recall(p_recall_id uuid, p_resolved_by uuid, p_resolution_notes text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if p_resolution_notes is null or trim(p_resolution_notes) = '' then
    raise exception 'Resolution notes are required to close a recall';
  end if;

  update batch_recalls set
    status = 'resolved',
    resolved_by = p_resolved_by,
    resolved_at = now(),
    resolution_notes = p_resolution_notes
  where id = p_recall_id;
end;
$function$
;

-- FUNCTION: reverse_payment
CREATE OR REPLACE FUNCTION public.reverse_payment(p_payment_id uuid, p_reversed_by uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_payment record;
  v_reverser_role staff_role;
  v_allocation record;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to reverse a payment';
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'Payment % not found', p_payment_id;
  end if;
  if v_payment.status = 'reversed' then
    raise exception 'Payment % has already been reversed', p_payment_id;
  end if;

  select role into v_reverser_role from staff
    where id = p_reversed_by and clinic_id = v_payment.clinic_id and is_active = true;
  if v_reverser_role is null then
    raise exception 'Reversing staff member not found or inactive in this clinic';
  end if;
  if v_reverser_role <> 'admin' then
    raise exception 'Only an admin can reverse a payment, got %', v_reverser_role;
  end if;

  -- Undo exactly what this payment did, charge by charge, using the
  -- precise allocation record from Part A — not a recalculation or guess.
  for v_allocation in
    select * from payment_allocations where payment_id = p_payment_id
  loop
    update service_charges
      set amount_paid_xaf = amount_paid_xaf - v_allocation.amount_xaf,
          status = case
            when amount_paid_xaf - v_allocation.amount_xaf <= 0 then 'pending'
            else 'partial'
          end::service_charge_status
      where id = v_allocation.service_charge_id;
  end loop;

  update invoices set
    amount_paid_xaf = amount_paid_xaf - v_payment.total_amount_xaf,
    status = case
      when amount_paid_xaf - v_payment.total_amount_xaf <= 0 then 'unpaid'
      else 'partial'
    end::invoice_status
  where id = v_payment.invoice_id;

  update payments set status = 'reversed', reversed_reason = p_reason where id = p_payment_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_payment.clinic_id, p_reversed_by, 'billing.payment_reversed', 'payment', p_payment_id,
    jsonb_build_object('reason', p_reason, 'original_amount', v_payment.total_amount_xaf));
end;
$function$
;

-- FUNCTION: review_shift_variance
CREATE OR REPLACE FUNCTION public.review_shift_variance(p_shift_id uuid, p_reviewed_by uuid, p_review_notes text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_shift record;
  v_reviewer_role staff_role;
begin
  if p_review_notes is null or trim(p_review_notes) = '' then
    raise exception 'Review notes are required to clear a flagged shift variance';
  end if;

  select * into v_shift from cashier_shifts where id = p_shift_id for update;
  if v_shift.id is null then
    raise exception 'Shift % not found', p_shift_id;
  end if;
  if not v_shift.requires_review then
    raise exception 'This shift was not flagged for review';
  end if;
  if v_shift.staff_id = p_reviewed_by then
    raise exception 'The cashier whose shift this is cannot review their own variance';
  end if;

  select role into v_reviewer_role from staff
    where id = p_reviewed_by and clinic_id = v_shift.clinic_id and is_active = true;
  if v_reviewer_role is null then
    raise exception 'Reviewer not found or inactive in this clinic';
  end if;
  if v_reviewer_role <> 'admin' then
    raise exception 'Only an admin can review a flagged shift variance, got %', v_reviewer_role;
  end if;

  update cashier_shifts set
    requires_review = false,
    reviewed_by = p_reviewed_by,
    reviewed_at = now(),
    review_notes = p_review_notes
  where id = p_shift_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_shift.clinic_id, p_reviewed_by, 'billing.shift_variance_reviewed', 'cashier_shift', p_shift_id,
    jsonb_build_object('notes', p_review_notes, 'variance', v_shift.variance_xaf, 'cashier', v_shift.staff_id));
end;
$function$
;

-- FUNCTION: set_lab_test_range_override
CREATE OR REPLACE FUNCTION public.set_lab_test_range_override(p_clinic_id uuid, p_lab_test_catalog_id uuid, p_reference_range_low numeric DEFAULT NULL::numeric, p_reference_range_high numeric DEFAULT NULL::numeric, p_critical_low numeric DEFAULT NULL::numeric, p_critical_high numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if not exists (
    select 1 from clinic_lab_tests
    where clinic_id = p_clinic_id and lab_test_catalog_id = p_lab_test_catalog_id
  ) then
    raise exception 'This test is not configured as available for this clinic yet — activate it first';
  end if;

  update clinic_lab_tests set
    override_reference_range_low = p_reference_range_low,
    override_reference_range_high = p_reference_range_high,
    override_critical_low = p_critical_low,
    override_critical_high = p_critical_high
  where clinic_id = p_clinic_id and lab_test_catalog_id = p_lab_test_catalog_id;
end;
$function$
;

-- FUNCTION: set_visit_priority
CREATE OR REPLACE FUNCTION public.set_visit_priority(p_visit_id uuid, p_priority text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if p_priority not in ('routine', 'urgent', 'critical') then
    raise exception 'Invalid priority: %', p_priority;
  end if;

  update visits
  set
    triage_priority = p_priority,
    priority_note = p_note,
    priority_flagged_by = auth.uid()::uuid,
    priority_flagged_at = now()
  where id = p_visit_id
    and clinic_id = current_staff_clinic_id();

  if not found then
    raise exception 'Visit not found or not in your clinic';
  end if;
end;
$function$
;

-- FUNCTION: start_consultation
CREATE OR REPLACE FUNCTION public.start_consultation(p_visit_id uuid, p_doctor_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_visit record;
  v_consultation_id uuid;
  v_existing_consultation_id uuid;
  v_doctor_role staff_role;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'waiting_consultation' then
    raise exception 'Visit is not waiting for consultation (currently: %)', v_visit.status;
  end if;

  if v_visit.assigned_doctor_id is not null and v_visit.assigned_doctor_id <> p_doctor_id then
    select role into v_doctor_role from staff where id = p_doctor_id and clinic_id = v_visit.clinic_id;
    if v_doctor_role <> 'admin' then
      raise exception 'This patient is assigned to a different doctor';
    end if;
  end if;

  -- Look for a previously completed consultation on THIS visit — this is
  -- what a return-from-lab trip looks like. Reopen it rather than
  -- starting fresh.
  select id into v_existing_consultation_id
  from consultations
  where visit_id = p_visit_id and completed_at is not null
  order by started_at desc
  limit 1;

  if v_existing_consultation_id is not null then
    update consultations set completed_at = null where id = v_existing_consultation_id;
    v_consultation_id := v_existing_consultation_id;
  else
    insert into consultations (clinic_id, visit_id, doctor_id, started_at)
    values (v_visit.clinic_id, p_visit_id, p_doctor_id, now())
    returning id into v_consultation_id;
  end if;

  update visits set status = 'in_consultation', assigned_doctor_id = p_doctor_id where id = p_visit_id;

  return v_consultation_id;
end;
$function$
;

-- FUNCTION: submit_insurance_claim
CREATE OR REPLACE FUNCTION public.submit_insurance_claim(p_clinic_id uuid, p_claim_id uuid, p_submitted_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if not exists (select 1 from insurance_claims where id = p_claim_id and clinic_id = p_clinic_id and status = 'draft') then
    raise exception 'Claim not found, not in this clinic, or not in draft status';
  end if;

  update insurance_claims
    set status = 'submitted', submitted_at = now(), submitted_by = p_submitted_by
    where id = p_claim_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_submitted_by, 'insurance.claim_submitted', 'insurance_claim', p_claim_id, '{}'::jsonb);
end;
$function$
;

-- FUNCTION: top_selling_products
CREATE OR REPLACE FUNCTION public.top_selling_products(p_clinic_id uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(product_id uuid, product_name text, total_quantity bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select product_id, product_name, sum(qty) as total_quantity
  from (
    select psi.product_id, p.name as product_name, psi.quantity as qty
    from pos_sale_items psi
    join pos_sales ps on ps.id = psi.pos_sale_id
    join products p on p.id = psi.product_id
    where ps.clinic_id = p_clinic_id and ps.status = 'completed'
      and ps.created_at >= current_date - p_days

    union all

    select sc.product_id, p.name as product_name, sc.quantity as qty
    from service_charges sc
    join products p on p.id = sc.product_id
    where sc.clinic_id = p_clinic_id and sc.category = 'pharmacy' and sc.product_id is not null
      and sc.status <> 'void'
      and sc.service_date >= current_date - p_days
  ) combined
  group by product_id, product_name
  order by total_quantity desc
  limit 10
$function$
;

-- FUNCTION: touch_service_charge_updated_at
CREATE OR REPLACE FUNCTION public.touch_service_charge_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  NEW.updated_at := now();
  return NEW;
end;
$function$
;

-- FUNCTION: transfer_patient
CREATE OR REPLACE FUNCTION public.transfer_patient(p_clinic_id uuid, p_admission_id uuid, p_to_ward_id uuid, p_to_bed_id uuid, p_transferred_by uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_admission record;
  v_new_bed_status bed_status;
begin
  select * into v_admission from admissions
    where id = p_admission_id and clinic_id = p_clinic_id
    for update;

  if v_admission.id is null then
    raise exception 'Admission does not belong to this clinic';
  end if;
  if v_admission.status <> 'admitted' then
    raise exception 'Only an admitted patient can be transferred (current status: %)', v_admission.status;
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to transfer a patient';
  end if;

  select status into v_new_bed_status from beds
    where id = p_to_bed_id and ward_id = p_to_ward_id and clinic_id = p_clinic_id
    for update;
  if v_new_bed_status is null then
    raise exception 'Destination bed not found in this ward for this clinic';
  end if;
  if v_new_bed_status <> 'available' then
    raise exception 'Destination bed is not available (current status: %)', v_new_bed_status;
  end if;

  if v_admission.bed_id is not null then
    update beds set status = 'available' where id = v_admission.bed_id;
  end if;
  update beds set status = 'occupied' where id = p_to_bed_id;

  insert into admission_transfers (
    clinic_id, admission_id, from_ward_id, from_bed_id, to_ward_id, to_bed_id, reason, transferred_by
  ) values (
    p_clinic_id, p_admission_id, v_admission.ward_id, v_admission.bed_id, p_to_ward_id, p_to_bed_id, p_reason, p_transferred_by
  );

  update admissions set ward_id = p_to_ward_id, bed_id = p_to_bed_id where id = p_admission_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_transferred_by, 'admission.transferred', 'admission', p_admission_id,
    jsonb_build_object('to_ward_id', p_to_ward_id, 'to_bed_id', p_to_bed_id, 'reason', p_reason));
end;
$function$
;

-- FUNCTION: transfer_patient_to_doctor
CREATE OR REPLACE FUNCTION public.transfer_patient_to_doctor(p_visit_id uuid, p_new_doctor_id uuid, p_staff_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_visit record;
  v_new_doctor_role staff_role;
  v_requester_role staff_role;
begin
  select * into v_visit from visits where id = p_visit_id for update;
  if v_visit.id is null then
    raise exception 'Visit % not found', p_visit_id;
  end if;
  if v_visit.status <> 'waiting_consultation' then
    raise exception 'Can only transfer a patient who is waiting and not yet in consultation (currently: %)', v_visit.status;
  end if;

  select role into v_requester_role from staff
    where id = p_staff_id and clinic_id = v_visit.clinic_id and is_active = true;
  if v_requester_role is null then
    raise exception 'Requesting staff member not found or inactive in this clinic';
  end if;
  if v_requester_role not in ('receptionist', 'doctor', 'admin') then
    raise exception 'Only receptionists, doctors, or admins can transfer a patient, got %', v_requester_role;
  end if;

  select role into v_new_doctor_role from staff
    where id = p_new_doctor_id and clinic_id = v_visit.clinic_id and is_active = true;
  if v_new_doctor_role is null then
    raise exception 'Selected doctor not found or inactive in this clinic';
  end if;
  if v_new_doctor_role <> 'doctor' then
    raise exception 'Can only transfer to a doctor, got %', v_new_doctor_role;
  end if;

  update visits set assigned_doctor_id = p_new_doctor_id where id = p_visit_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (v_visit.clinic_id, p_staff_id, 'visit.transferred_to_doctor', 'visit', p_visit_id,
    jsonb_build_object('new_doctor_id', p_new_doctor_id, 'previous_doctor_id', v_visit.assigned_doctor_id));
end;
$function$
;

-- FUNCTION: update_claim_status
CREATE OR REPLACE FUNCTION public.update_claim_status(p_clinic_id uuid, p_claim_id uuid, p_status text, p_updated_by uuid, p_total_approved_xaf numeric DEFAULT NULL::numeric, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if not exists (select 1 from insurance_claims where id = p_claim_id and clinic_id = p_clinic_id) then
    raise exception 'Claim not found in this clinic';
  end if;
  if p_status not in ('under_review', 'approved', 'partially_approved', 'denied', 'paid') then
    raise exception 'Invalid claim status: %', p_status;
  end if;

  update insurance_claims set
    status = p_status,
    total_approved_xaf = coalesce(p_total_approved_xaf, total_approved_xaf),
    notes = coalesce(p_notes, notes)
  where id = p_claim_id;

  insert into audit_log (clinic_id, staff_id, action, entity_type, entity_id, details)
  values (p_clinic_id, p_updated_by, 'insurance.claim_status_updated', 'insurance_claim', p_claim_id,
    jsonb_build_object('status', p_status, 'total_approved_xaf', p_total_approved_xaf));
end;
$function$
;

-- FUNCTION: verify_lab_result
CREATE OR REPLACE FUNCTION public.verify_lab_result(p_lab_result_id uuid, p_verified_by uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_result record;
  v_verifier_role staff_role;
begin
  select * into v_result from lab_results where id = p_lab_result_id;
  if v_result.id is null then
    raise exception 'Lab result % not found', p_lab_result_id;
  end if;

  select role into v_verifier_role from staff
    where id = p_verified_by and clinic_id = v_result.clinic_id and is_active = true;
  if v_verifier_role not in ('lab_technician', 'admin') then
    raise exception 'Only a lab technician or admin can verify a result, got %', v_verifier_role;
  end if;

  update lab_results set verified_by = p_verified_by, verified_at = now() where id = p_lab_result_id;
end;
$function$
;

-- FUNCTION: wait_time_by_doctor
CREATE OR REPLACE FUNCTION public.wait_time_by_doctor(p_clinic_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(doctor_id uuid, doctor_name text, avg_wait_to_doctor_min numeric, avg_consult_min numeric, patients_seen bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with bounds as (
    select
      coalesce(p_from, (timezone('Africa/Douala', now()))::date) as d_from,
      coalesce(p_to,   (timezone('Africa/Douala', now()))::date) as d_to
  ),
  -- For each visit, find key timestamps
  visit_times as (
    select
      e.visit_id,
      e.assigned_doctor_id,
      min(e.changed_at) filter (where e.to_status = 'registered') as registered_at,
      min(e.changed_at) filter (where e.to_status = 'in_consultation') as consult_start,
      min(e.changed_at) filter (where e.to_status in ('billing', 'waiting_pharmacy', 'discharged', 'admitted')) as consult_end
    from visit_status_events e, bounds
    where e.clinic_id = p_clinic_id
      and date(timezone('Africa/Douala', e.changed_at)) between bounds.d_from and bounds.d_to
    group by e.visit_id, e.assigned_doctor_id
  )
  select
    vt.assigned_doctor_id,
    s.full_name,
    round(avg(extract(epoch from (vt.consult_start - vt.registered_at)) / 60.0)::numeric, 1),
    round(avg(extract(epoch from (vt.consult_end - vt.consult_start)) / 60.0)::numeric, 1),
    count(*) filter (where vt.consult_start is not null)
  from visit_times vt
  join staff s on s.id = vt.assigned_doctor_id
  where vt.assigned_doctor_id is not null
    and vt.consult_start is not null
  group by vt.assigned_doctor_id, s.full_name
  order by count(*) desc
$function$
;

-- FUNCTION: wait_time_by_stage
CREATE OR REPLACE FUNCTION public.wait_time_by_stage(p_clinic_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(stage text, avg_minutes numeric, median_minutes numeric, max_minutes numeric, visit_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with bounds as (
    select
      coalesce(p_from, (timezone('Africa/Douala', now()))::date) as d_from,
      coalesce(p_to,   (timezone('Africa/Douala', now()))::date) as d_to
  ),
  -- Pair each event with the next event for the same visit
  durations as (
    select
      e.to_status as stage,
      extract(epoch from (
        lead(e.changed_at) over (partition by e.visit_id order by e.changed_at) - e.changed_at
      )) / 60.0 as minutes
    from visit_status_events e, bounds
    where e.clinic_id = p_clinic_id
      and date(timezone('Africa/Douala', e.changed_at)) between bounds.d_from and bounds.d_to
  )
  select
    stage,
    round(avg(minutes)::numeric, 1),
    round((percentile_cont(0.5) within group (order by minutes))::numeric, 1),
    round(max(minutes)::numeric, 1),
    count(*)
  from durations
  where minutes is not null and minutes >= 0
  group by stage
  order by avg(minutes) desc
$function$
;

-- ─────────────────────────── TRIGGERS ───────────────────────────

CREATE TRIGGER trg_apply_insurance_split BEFORE INSERT ON public.service_charges FOR EACH ROW EXECUTE FUNCTION apply_insurance_split();
CREATE TRIGGER trg_auto_close_service_charge BEFORE UPDATE ON public.service_charges FOR EACH ROW EXECUTE FUNCTION auto_close_service_charge();
CREATE TRIGGER trg_check_clinic_lab_panel_ownership BEFORE INSERT OR UPDATE ON public.clinic_lab_panels FOR EACH ROW EXECUTE FUNCTION check_clinic_lab_panel_ownership();
CREATE TRIGGER trg_check_clinic_lab_test_ownership BEFORE INSERT OR UPDATE ON public.clinic_lab_tests FOR EACH ROW EXECUTE FUNCTION check_clinic_lab_test_ownership();
CREATE TRIGGER trg_check_lab_panel_item_same_clinic BEFORE INSERT OR UPDATE ON public.lab_panel_items FOR EACH ROW EXECUTE FUNCTION check_lab_panel_item_same_clinic();
CREATE TRIGGER trg_flag_prescription_review AFTER INSERT OR UPDATE ON public.prescription_items FOR EACH ROW EXECUTE FUNCTION flag_prescription_for_review();
CREATE TRIGGER trg_invoice_number BEFORE INSERT ON public.invoices FOR EACH ROW WHEN ((new.invoice_number IS NULL)) EXECUTE FUNCTION generate_invoice_number();
CREATE TRIGGER trg_lab_result_flag BEFORE INSERT OR UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION evaluate_lab_result_flag();
CREATE TRIGGER trg_log_visit_status AFTER INSERT OR UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION log_visit_status_change();
CREATE TRIGGER trg_patient_code BEFORE INSERT ON public.patients FOR EACH ROW WHEN ((new.patient_code IS NULL)) EXECUTE FUNCTION generate_patient_code();
CREATE TRIGGER trg_touch_service_charge BEFORE UPDATE ON public.service_charges FOR EACH ROW EXECUTE FUNCTION touch_service_charge_updated_at();
CREATE TRIGGER trg_vitals_flags BEFORE INSERT OR UPDATE ON public.vitals FOR EACH ROW EXECUTE FUNCTION evaluate_vitals_flags();
