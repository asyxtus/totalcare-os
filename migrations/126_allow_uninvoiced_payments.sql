-- ============================================================================
-- ALLOW UNINVOICED PAYMENTS
--
-- collectChargesDirectly() marks service_charges as paid for charges that
-- have no invoice (e.g. a lab charge ordered after the consultation invoice
-- was already closed) — but it never created a row in `payments`, so the
-- collected money had no receipt and didn't show up anywhere: not in
-- Receipts, not in the end-of-day cash report, not in patient payment
-- history. The cash was collected but effectively untraceable.
--
-- This allows payments.invoice_id to be null so a real payment record (with
-- payment_splits) can be created even when there's no invoice behind it.
-- ============================================================================

alter table payments alter column invoice_id drop not null;
