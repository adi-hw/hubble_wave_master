-- Create a template database for tenant databases
-- This ensures all tenant databases have the same base configuration

-- Create a template database that can be used to quickly provision new tenant databases
-- Note: This runs as a superuser during container initialization

DO $$
BEGIN
    -- Check if template already exists
    IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'tenant_template') THEN
        -- Create tenant template database
        PERFORM dblink_exec('dbname=' || current_database(),
            'CREATE DATABASE tenant_template TEMPLATE template0 ENCODING ''UTF8''');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create tenant_template database (may already exist or dblink not available)';
END $$;
