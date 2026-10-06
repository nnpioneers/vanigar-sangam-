-- Phase 11.1: Loan Repayment Foundation

CREATE TABLE loan_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id),
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    repayment_date DATE NOT NULL,
    recorded_by_admin_id UUID NOT NULL REFERENCES admin_users(id),
    payment_mode VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loan_repayments_loan_id ON loan_repayments(loan_id);
CREATE INDEX idx_loan_repayments_date ON loan_repayments(repayment_date);

-- Prevent physical deletion
CREATE OR REPLACE FUNCTION prevent_loan_repayment_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Physical deletion of loan_repayments is strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_loan_repayment_delete_trigger
BEFORE DELETE ON loan_repayments
FOR EACH ROW
EXECUTE FUNCTION prevent_loan_repayment_delete();

-- Audit log for loan_repayments
CREATE TABLE loan_repayments_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repayment_id UUID NOT NULL REFERENCES loan_repayments(id),
    loan_id UUID NOT NULL,
    admin_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    amount_paise BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loan_repayments_audit_repayment_id ON loan_repayments_audit(repayment_id);
CREATE INDEX idx_loan_repayments_audit_loan_id ON loan_repayments_audit(loan_id);

-- Prevent physical deletion of audit
CREATE OR REPLACE FUNCTION prevent_loan_repayments_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Physical deletion of loan_repayments_audit is strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_loan_repayments_audit_delete_trigger
BEFORE DELETE ON loan_repayments_audit
FOR EACH ROW
EXECUTE FUNCTION prevent_loan_repayments_audit_delete();
