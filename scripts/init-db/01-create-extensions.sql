-- Enable required PostgreSQL extensions
-- This script runs automatically when the PostgreSQL container starts

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full-text search with better tokenization
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Case-insensitive text (useful for email addresses, usernames)
CREATE EXTENSION IF NOT EXISTS "citext";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
