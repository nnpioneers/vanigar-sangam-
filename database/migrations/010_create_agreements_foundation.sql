-- Phase 10.1: Loan Agreement Database Foundation
-- 
-- Unresolved business rule: Exact agreement versioning/replacement policy is unknown.
-- Action: Implementing a strict 1-to-1 unique constraint per loan to prevent duplicate 
-- active agreements safely until versioning policy is resolved.

CREATE TYPE agreement_status_enum AS ENUM ('DRAFT', 'SIGNED', 'CANCELLED');

CREATE TABLE loan_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id),
    agreement_number VARCHAR(100),
    agreement_date DATE NOT NULL,
    status agreement_status_enum NOT NULL DEFAULT 'DRAFT',
    recorded_by_admin_id UUID NOT NULL REFERENCES admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient lookup
CREATE INDEX idx_loan_agreements_loan_id ON loan_agreements(loan_id);
CREATE INDEX idx_loan_agreements_status ON loan_agreements(status);

-- Safe uniqueness constraint: 1 agreement per loan for now
CREATE UNIQUE INDEX idx_unique_loan_agreement ON loan_agreements(loan_id);

-- Immutability Protection: prevent deletion of historical agreements
CREATE OR REPLACE FUNCTION prevent_agreement_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Historical agreements cannot be physically deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_agreements_delete
BEFORE DELETE ON loan_agreements
FOR EACH ROW EXECUTE FUNCTION prevent_agreement_deletion();


