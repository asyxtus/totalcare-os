-- ============================================================================
-- INSURANCE, STEP 0: ADD 'insurance' AS ITS OWN PAYMENT METHOD
-- Must run alone, before anything references it — same restriction as
-- adding 'deposit' earlier. Insurer reimbursements are NOT the same
-- thing as a patient deposit and shouldn't be mislabeled as one; a
-- report asking "how much came from insurance vs. patient prepayments"
-- needs to be answerable, which it wouldn't be if both used 'deposit'.
-- ============================================================================

alter type payment_method add value 'insurance';
