const { Client } = require('pg');
require('dotenv').config();

async function checkColumns() {
  const client = new Client({
    host: process.env.TENANT_DB_HOST || 'localhost',
    port: parseInt(process.env.TENANT_DB_PORT || '5432'),
    user: process.env.TENANT_DB_USER || 'admin',
    password: process.env.TENANT_DB_PASSWORD || 'password',
    database: 'eam_tenant_acme',
  });

  await client.connect();
  
  const result = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'user_accounts'
    ORDER BY ordinal_position
  `);
  
  console.log('user_accounts columns:');
  result.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
  
  const result2 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'user_role_assignments'
    ORDER BY ordinal_position
  `);
  
  console.log('\nuser_role_assignments columns:');
  result2.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
  
  await client.end();
}

checkColumns();
