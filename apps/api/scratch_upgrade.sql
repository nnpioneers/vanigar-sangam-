BEGIN;

-- 1. Enums
CREATE TYPE loan_category AS ENUM ('DAILY_CHIT', 'COMMERCIAL', 'SHOP_LOAN');
CREATE TYPE repayment_freq AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE collateral_type_enum AS ENUM ('CHEQUE', 'PROMISSORY_NOTE', 'TRADE_LICENSE', 'OTHER');
CREATE TYPE collateral_status_enum AS ENUM ('COLLECTED', 'RETURNED_TO_MEMBER');

-- 2. Loans Table
ALTER TABLE loans 
  ADD COLUMN loan_type loan_category,
  ADD COLUMN repayment_frequency repayment_freq,
  ADD COLUMN repayment_tenure_months INTEGER,
  ADD COLUMN scheduled_installment_amount_paise BIGINT;

-- 3. Loan Guarantors Table
ALTER TABLE loan_guarantors 
  ALTER COLUMN guarantor_member_id DROP NOT NULL,
  ADD COLUMN non_member_name VARCHAR(255),
  ADD COLUMN non_member_phone VARCHAR(20),
  ADD COLUMN non_member_address TEXT,
  ADD COLUMN non_member_id_proof_url VARCHAR(255);

ALTER TABLE loan_guarantors 
  ADD CONSTRAINT check_guarantor_exists CHECK (
    guarantor_member_id IS NOT NULL OR 
    (non_member_name IS NOT NULL AND non_member_phone IS NOT NULL)
  );

-- 4. Loan Collaterals Table
CREATE TABLE loan_collaterals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    collateral_type collateral_type_enum NOT NULL,
    document_reference_number VARCHAR(100),
    document_status collateral_status_enum NOT NULL DEFAULT 'COLLECTED',
    notes TEXT,
    recorded_by_admin_id UUID NOT NULL REFERENCES admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
