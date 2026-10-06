-- Migration 004: Create cash_transfers and cash_reconciliations
-- Phase 4 Task 4.2: Cash Operations Foundation: Admin Cash Transfers & Reconciliation

-- 1. Create cash_transfers table
CREATE TABLE IF NOT EXISTS cash_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id UUID NOT NULL REFERENCES admin_cash_accounts(id) ON DELETE RESTRICT,
  destination_account_id UUID NOT NULL REFERENCES admin_cash_accounts(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED')),
  idempotency_key VARCHAR(100) UNIQUE NULL,
  notes TEXT NULL,
  initiated_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT diff_accounts CHECK (source_account_id != destination_account_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_transfers_source ON cash_transfers(source_account_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_destination ON cash_transfers(destination_account_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_status ON cash_transfers(status);

-- 2. Create cash_reconciliations table
CREATE TABLE IF NOT EXISTS cash_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES admin_cash_accounts(id) ON DELETE RESTRICT,
  expected_balance_paise BIGINT NOT NULL,
  actual_balance_paise BIGINT NOT NULL,
  discrepancy_paise BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'RESOLVED')),
  notes TEXT NULL,
  performed_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_reconciliations_account ON cash_reconciliations(account_id);

-- 3. Immutability trigger: prevent DELETE on cash_transfers
CREATE OR REPLACE FUNCTION prevent_cash_transfers_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'cash_transfers history is immutable: DELETE operations are strictly prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_cash_transfers_delete ON cash_transfers;
CREATE TRIGGER trg_protect_cash_transfers_delete
BEFORE DELETE ON cash_transfers
FOR EACH ROW
EXECUTE FUNCTION prevent_cash_transfers_deletion();

-- 4. Immutability trigger: prevent DELETE on cash_reconciliations and UPDATE of balances
CREATE OR REPLACE FUNCTION protect_cash_reconciliations_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'cash_reconciliations history is immutable: DELETE operations are strictly prohibited';
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    IF OLD.account_id != NEW.account_id OR 
       OLD.expected_balance_paise != NEW.expected_balance_paise OR 
       OLD.actual_balance_paise != NEW.actual_balance_paise OR 
       OLD.discrepancy_paise != NEW.discrepancy_paise OR 
       OLD.performed_by_admin_id != NEW.performed_by_admin_id THEN
      RAISE EXCEPTION 'cash_reconciliations core financial fields are immutable: UPDATE operations on balances and accounts are strictly prohibited';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_cash_reconciliations_immutability ON cash_reconciliations;
CREATE TRIGGER trg_protect_cash_reconciliations_immutability
BEFORE DELETE OR UPDATE ON cash_reconciliations
FOR EACH ROW
EXECUTE FUNCTION protect_cash_reconciliations_immutability();
