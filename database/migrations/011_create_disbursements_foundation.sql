-- Phase 10.6: Loan Disbursements Foundation

CREATE TYPE disbursement_status_enum AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE loan_disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id),
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    disbursement_date DATE NOT NULL,
    cash_account_id UUID REFERENCES admin_cash_accounts(id), -- Nullable due to unresolved cash account policy
    status disbursement_status_enum NOT NULL DEFAULT 'PENDING',
    recorded_by_admin_id UUID NOT NULL REFERENCES admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure 1-to-1 or proper mapping for active disbursements. 
    -- We assume a loan has at most one active/pending/completed disbursement
    CONSTRAINT uq_loan_disbursement UNIQUE (loan_id)
);

CREATE INDEX idx_loan_disbursements_loan_id ON loan_disbursements(loan_id);
CREATE INDEX idx_loan_disbursements_status ON loan_disbursements(status);

-- Function to protect disbursements from physical deletion (Immutability)
CREATE OR REPLACE FUNCTION prevent_disbursement_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Physical deletion of loan disbursements is strictly prohibited. Disbursement records are immutable.';
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce immutability
CREATE TRIGGER trg_protect_disbursements_delete
BEFORE DELETE ON loan_disbursements
FOR EACH ROW EXECUTE FUNCTION prevent_disbursement_deletion();
