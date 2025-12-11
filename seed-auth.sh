# Seed Tenant and Admin User
curl -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{"slug": "acme", "name": "Acme Corp"}'
