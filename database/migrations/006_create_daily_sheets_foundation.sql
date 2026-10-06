-- Migration 006: Create daily_sheets foundation
-- Phase 6 Task 6.1: Daily Sheet Database Foundation

CREATE TABLE IF NOT EXISTS daily_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  business_date DATE NOT NULL,
  number_of_sheets INTEGER NOT NULL CHECK (number_of_sheets > 0),
  daily_due_amount_paise BIGINT NOT NULL CHECK (daily_due_amount_paise >= 0),
  previous_arrears_paise BIGINT NOT NULL DEFAULT 0 CHECK (previous_arrears_paise >= 0),
  total_due_paise BIGINT NOT NULL CHECK (total_due_paise >= 0),
  actual_paid_paise BIGINT NOT NULL DEFAULT 0 CHECK (actual_paid_paise >= 0),
  status VARCHAR(50) NOT NULL CHECK (
    status IN ('PAID', 'ADVANCE_PAID', 'ADVANCE_COVERED', 'PARTIAL', 'NOT_PAID', 'OVERDUE')
  ),
  payment_time TIMESTAMPTZ NULL,
  payment_mode VARCHAR(50) NULL CHECK (
    payment_mode IS NULL OR payment_mode IN ('CASH', 'ONLINE', 'BANK_TRANSFER', 'CHEQUE', 'OTHER')
  ),
  notes TEXT NULL,
  idempotency_key VARCHAR(100) UNIQUE NULL,
  recorded_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying by member, business date, status, and combined lookup
CREATE INDEX IF NOT EXISTS idx_daily_sheets_member_id ON daily_sheets(member_id);
CREATE INDEX IF NOT EXISTS idx_daily_sheets_business_date ON daily_sheets(business_date);
CREATE INDEX IF NOT EXISTS idx_daily_sheets_member_date ON daily_sheets(member_id, business_date);
CREATE INDEX IF NOT EXISTS idx_daily_sheets_status ON daily_sheets(status);

-- Immutability trigger: prevent physical DELETE on daily_sheets to protect financial history
CREATE OR REPLACE FUNCTION prevent_daily_sheets_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'daily_sheets history is immutable: DELETE operations are strictly prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_daily_sheets_delete ON daily_sheets;
CREATE TRIGGER trg_protect_daily_sheets_delete
BEFORE DELETE ON daily_sheets
FOR EACH ROW
EXECUTE FUNCTION prevent_daily_sheets_deletion();
