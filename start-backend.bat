@echo off
echo Starting EAM Platform Identity Service...
echo.

REM Set environment variables
set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=admin
set DB_PASSWORD=password
set DB_NAME=eam_global
set JWT_SECRET=super-secret-jwt-key-change-in-production
set PORT=3000
set FRONTEND_URL=http://localhost:4200

echo Environment configured:
echo   DB: %DB_USER%@%DB_HOST%:%DB_PORT%/%DB_NAME%
echo   Port: %PORT%
echo.

REM Start the service
npx nx serve svc-identity
