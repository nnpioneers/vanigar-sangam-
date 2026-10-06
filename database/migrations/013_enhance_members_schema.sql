-- 013_enhance_members_schema.sql
-- Migration to add new merchant and shop details to members

ALTER TABLE members
ADD COLUMN join_date DATE,
ADD COLUMN daily_collection_amount NUMERIC(12, 2),
ADD COLUMN shop_category VARCHAR(255),
ADD COLUMN shop_contact_number VARCHAR(20),
ADD COLUMN shop_email VARCHAR(255),
ADD COLUMN trade_license VARCHAR(255);

CREATE TABLE IF NOT EXISTS member_successors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    successor_name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    alternate_contact VARCHAR(20),
    email_address VARCHAR(255),
    expected_takeover_date VARCHAR(255),
    residential_address TEXT,
    remarks TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_member_successors_member_id ON member_successors(member_id);
