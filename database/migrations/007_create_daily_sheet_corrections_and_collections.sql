-- Migration 007: Create daily_sheet_corrections and collections
-- Phase 6 Tasks 6.6 & 6.8: Daily Sheet Correction Audit & Collections Foundation

-- 1. Create daily_sheet_corrections table (Audit log for corrections & reversals)
CREATE TABLE IF NOT EXISTS daily_sheet_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_daily_sheet_id UUID NOT NULL UNIQUE REFERENCES daily_sheets(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  business_date DATE NOT NULL,
  original_actual_paid_paise BIGINT NOT NULL CHECK (original_actual_paid_paise >= 0),
  original_status VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  reversal_cash_transaction_id UUID NULL REFERENCES cash_transactions(id) ON DELETE RESTRICT,
  corrected_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for daily sheet corrections
CREATE INDEX IF NOT EXISTS idx_ds_corrections_original_id ON daily_sheet_corrections(original_daily_sheet_id);
CREATE INDEX IF NOT EXISTS idx_ds_corrections_member_id ON daily_sheet_corrections(member_id);
CREATE INDEX IF NOT EXISTS idx_ds_corrections_business_date ON daily_sheet_corrections(business_date);

-- Immutability trigger: prevent DELETE on daily_sheet_corrections
CREATE OR REPLACE FUNCTION prevent_daily_sheet_corrections_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'daily_sheet_corrections is an append-only audit log: DELETE operations are strictly prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_daily_sheet_corrections_delete ON daily_sheet_corrections;
CREATE TRIGGER trg_protect_daily_sheet_corrections_delete
BEFORE DELETE ON daily_sheet_corrections
FOR EACH ROW
EXECUTE FUNCTION prevent_daily_sheet_corrections_delete();


-- 2. Create collections table (Financial recap and receipt views linked to Daily Sheet)
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_sheet_id UUID NOT NULL UNIQUE REFERENCES daily_sheets(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  payment_mode VARCHAR(50) NOT NULL CHECK (
    payment_mode IN ('CASH', 'ONLINE', 'BANK_TRANSFER', 'CHEQUE', 'OTHER')
  ),
  cash_transaction_id UUID NULL REFERENCES cash_transactions(id) ON DELETE RESTRICT,
  business_date DATE NOT NULL,
  recorded_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for collections queries
CREATE INDEX IF NOT EXISTS idx_collections_daily_sheet_id ON collections(daily_sheet_id);
CREATE INDEX IF NOT EXISTS idx_collections_member_id ON collections(member_id);
CREATE INDEX IF NOT EXISTS idx_collections_business_date ON collections(business_date);
CREATE INDEX IF NOT EXISTS idx_collections_cash_tx_id ON collections(cash_transaction_id);

-- Immutability trigger: prevent physical DELETE on collections
CREATE OR REPLACE FUNCTION prevent_collections_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'collections history is immutable: DELETE operations are strictly prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_collections_delete ON collections;
CREATE TRIGGER trg_protect_collections_delete
BEFORE DELETE ON collections
FOR EACH ROW
EXECUTE FUNCTION prevent_collections_delete();
