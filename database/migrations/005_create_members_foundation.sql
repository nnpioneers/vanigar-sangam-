-- Migration 005: Create Members Foundation
-- Phase 5 Task 5.1: Member Foundation Schema

-- 1. Create relationship enum type if preferred, but VARCHAR is safer for future evolution.
-- We will use VARCHAR with CHECK constraint for safety.

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number VARCHAR(50) NOT NULL UNIQUE,
  member_name VARCHAR(255) NOT NULL,
  related_person_name VARCHAR(255) NOT NULL,
  related_person_relationship VARCHAR(50) NOT NULL CHECK (
    related_person_relationship IN ('FATHER', 'MOTHER', 'HUSBAND', 'WIFE', 'SON', 'DAUGHTER', 'OTHER')
  ),
  shop_name VARCHAR(255) NULL,
  address TEXT NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  
  number_of_sheets INTEGER NOT NULL CHECK (number_of_sheets > 0),
  
  nominee_name VARCHAR(255) NULL,
  nominee_relationship VARCHAR(50) NULL,
  nominee_phone VARCHAR(20) NULL,
  
  insurance_number VARCHAR(100) NULL,
  
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the primary business search key
CREATE INDEX IF NOT EXISTS idx_members_member_number ON members(member_number);

-- Index for listing/status filtering
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);

-- 2. Immutability trigger: prevent DELETE on members to protect historical financial relationships
CREATE OR REPLACE FUNCTION prevent_member_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'members history is immutable: DELETE operations are strictly prohibited. Use status updates to deactivate members.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_members_delete ON members;
CREATE TRIGGER trg_protect_members_delete
BEFORE DELETE ON members
FOR EACH ROW
EXECUTE FUNCTION prevent_member_deletion();
