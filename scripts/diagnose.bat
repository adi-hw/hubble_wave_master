@echo off
echo ====================================
echo EAM Platform Startup Diagnostic
echo ====================================
echo.

echo [1/4] Checking Docker containers...
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo [2/4] Checking database connection...
node scripts/inspect-db.js
echo.

echo [3/4] Checking if ports are in use...
echo Port 3000 (svc-identity):
netstat -ano | findstr ":3000" || echo   Not listening
echo Port 4200 (web-client):
netstat -ano | findstr ":4200" || echo   Not listening
echo.

echo [4/4] Environment Check...
echo DB_HOST: %DB_HOST%
echo DB_PORT: %DB_PORT%
echo DB_USER: %DB_USER%
echo.

echo ====================================
echo Diagnostic Complete
echo ====================================
echo.
echo Next steps:
echo 1. If Docker containers are NOT running: docker-compose up -d
echo 2. If ports are in use but services not working: Kill the processes
echo 3. Start identity service: npm run dev:identity
echo 4. Start web client: npm run dev:web
