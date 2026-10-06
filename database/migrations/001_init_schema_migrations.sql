-- Migration 001: Initial schema migrations tracking table
-- Creates the internal migration history tracking table for PostgreSQL.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER NOT NULL
);
