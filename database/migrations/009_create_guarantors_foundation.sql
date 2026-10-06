-- 009_create_guarantors_foundation.sql
-- Migration Phase 9.1: Guarantor Database Foundation

CREATE TYPE guarantor_status AS ENUM (
    'ACTIVE',
    'RELEASED'
);

CREATE TABLE loan_guarantors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
    guarantor_member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    responsibility_amount_paise BIGINT NOT NULL CHECK (responsibility_amount_paise > 0),
    status guarantor_status NOT NULL DEFAULT 'ACTIVE',
    recorded_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent a member from being a guarantor multiple times for the same loan
    CONSTRAINT uq_loan_guarantor UNIQUE (loan_id, guarantor_member_id)
);

CREATE INDEX idx_loan_guarantors_loan_id ON loan_guarantors(loan_id);
CREATE INDEX idx_loan_guarantors_member_id ON loan_guarantors(guarantor_member_id);

-- Function to protect guarantors from physical deletion (Immutability)
CREATE OR REPLACE FUNCTION prevent_guarantors_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Physical deletion of guarantors is strictly prohibited. Guarantor records are immutable.';
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce immutability
CREATE TRIGGER trg_protect_guarantors_delete
BEFORE DELETE ON loan_guarantors
FOR EACH ROW EXECUTE FUNCTION prevent_guarantors_delete();
