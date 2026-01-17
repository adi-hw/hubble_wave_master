SELECT format('CREATE DATABASE %I OWNER %I', 'hubblewave_control_plane', current_user)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hubblewave_control_plane') \gexec

SELECT format('CREATE DATABASE %I OWNER %I', 'hubblewave', current_user)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hubblewave') \gexec
