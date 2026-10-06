-- Migration 003: Create admin_cash_accounts and cash_transactions (append-only ledger)
-- Phase 4 Task 4.1: Admin & Minimal Cash Foundation Schema (M14a)

-- 1. Create admin_cash_accounts table
CREATE TABLE IF NOT EXISTS admin_cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL UNIQUE REFERENCES admin_users(id) ON DELETE RESTRICT,
  account_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by admin_id
CREATE INDEX IF NOT EXISTS idx_admin_cash_accounts_admin_id ON admin_cash_accounts(admin_id);

-- 2. Create cash_transactions table (Append-only ledger)
CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES admin_cash_accounts(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
    'OPENING_BALANCE',
    'COLLECTION_DEPOSIT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'LOAN_DISBURSEMENT',
    'EXPENSE',
    'ADJUSTMENT'
  )),
  domain_entity_type VARCHAR(50) NULL,
  domain_entity_id UUID NULL,
  correlation_id VARCHAR(100) NULL,
  notes TEXT NULL,
  recorded_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  transacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for cash transactions query performance and correlation
CREATE INDEX IF NOT EXISTS idx_cash_transactions_account_id ON cash_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_transacted_at ON cash_transactions(transacted_at);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_domain_entity ON cash_transactions(domain_entity_type, domain_entity_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_correlation_id ON cash_transactions(correlation_id);

-- 3. Immutability trigger: prevent UPDATE and DELETE on cash_transactions
CREATE OR REPLACE FUNCTION prevent_cash_transactions_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'cash_transactions is an append-only ledger: UPDATE and DELETE operations are strictly prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_cash_transactions_update_delete ON cash_transactions;
CREATE TRIGGER trg_protect_cash_transactions_update_delete
BEFORE UPDATE OR DELETE ON cash_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_cash_transactions_modification();

-- 4. Create derived balance view: Balance = SUM(CREDIT) - SUM(DEBIT)
CREATE OR REPLACE VIEW v_admin_cash_balances AS
SELECT 
  a.id AS account_id,
  a.admin_id,
  a.account_name,
  a.status,
  COALESCE(SUM(CASE WHEN t.direction = 'CREDIT' THEN t.amount_paise ELSE 0 END), 0)::BIGINT AS total_credit_paise,
  COALESCE(SUM(CASE WHEN t.direction = 'DEBIT' THEN t.amount_paise ELSE 0 END), 0)::BIGINT AS total_debit_paise,
  (
    COALESCE(SUM(CASE WHEN t.direction = 'CREDIT' THEN t.amount_paise ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.direction = 'DEBIT' THEN t.amount_paise ELSE 0 END), 0)
  )::BIGINT AS balance_paise,
  COUNT(t.id)::INTEGER AS transaction_count,
  MAX(t.transacted_at) AS last_transacted_at
FROM admin_cash_accounts a
LEFT JOIN cash_transactions t ON a.id = t.account_id
GROUP BY a.id, a.admin_id, a.account_name, a.status;
