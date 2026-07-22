// lib/types.ts
// Kept in sync with the staff_role enum in 01_foundation_schema.sql.
// If a role is ever added/renamed in the database, update here too.

export type StaffRole =
  | 'admin'
  | 'doctor'
  | 'nurse'
  | 'pharmacist'
  | 'lab_technician'
  | 'receptionist'
  | 'billing_clerk'
  | 'auditor'
