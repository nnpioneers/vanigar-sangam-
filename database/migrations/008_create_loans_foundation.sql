-- 008_create_loans_foundation.sql
-- Migration Phase 8.1: Loans Database Foundation

-- Create the loan status enumeration
CREATE TYPE loan_status AS ENUM (
    'NEW',
    'ACTIVE',
    'PARTIALLY_REPAID',
    'CLOSED',
    'OVERDUE'
);

-- Create the loans table
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    requested_amount_paise BIGINT NOT NULL CHECK (requested_amount_paise > 0),
    approved_amount_paise BIGINT CHECK (approved_amount_paise IS NULL OR approved_amount_paise > 0),
    status loan_status NOT NULL DEFAULT 'NEW',
    application_date DATE NOT NULL,
    disbursement_date DATE,
    max_due_date DATE,
    recorded_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for frequent lookups and filtering
CREATE INDEX idx_loans_member_id ON loans(member_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_application_date ON loans(application_date);

-- Function to protect loans from physical deletion (Immutability)
CREATE OR REPLACE FUNCTION prevent_loans_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Physical deletion of loans is strictly prohibited. Loans are immutable financial records.';
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce immutability
CREATE TRIGGER trg_protect_loans_delete
BEFORE DELETE ON loans
FOR EACH ROW EXECUTE FUNCTION prevent_loans_delete();

-- Partial unique index to enforce "Only ONE active loan is allowed for a member at a time"
-- A member cannot have another loan if they already have one that is NEW, ACTIVE, PARTIALLY_REPAID, or OVERDUE
CREATE UNIQUE INDEX idx_loans_single_active_per_member 
ON loans (member_id) 
WHERE status IN ('NEW', 'ACTIVE', 'PARTIALLY_REPAID', 'OVERDUE');
