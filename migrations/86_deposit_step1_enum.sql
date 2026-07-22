-- ============================================================================
-- DEPOSIT, STEP 1: ADD THE ENUM VALUE ALONE
-- Must run in its own transaction, separate from anything that uses
-- this new value — Postgres doesn't allow a newly-added enum value to
-- be referenced in the same transaction it was created in. Confirmed
-- the real existing values first (cash, momo, orange_money, mixed)
-- rather than guessing.
-- ============================================================================

alter type payment_method add value 'deposit';
