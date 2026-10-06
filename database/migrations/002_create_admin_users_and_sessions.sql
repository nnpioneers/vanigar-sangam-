-- Migration 002: Create admin_users and sessions tables
-- Phase 2 Task 2.2: Authentication & User Management database schema

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'CASHIER')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(128) PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for fast session lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
