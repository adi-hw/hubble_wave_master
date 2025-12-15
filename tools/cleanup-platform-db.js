const { Client } = require('pg');

async function cleanup() {
  console.log('Starting Platform DB Cleanup...');

  const config = {
    user: 'admin',
    host: 'localhost',
    database: 'eam_global',
    password: 'password',
    port: 5432,
  };

  const client = new Client(config);

  try {
    await client.connect();
    console.log(`Connected to database: ${config.database}`);

    // We only drop api_keys from global if it exists, as we moved it to tenant db
    const queries = [
      'DROP TABLE IF EXISTS api_keys CASCADE',
    ];

    for (const query of queries) {
        try {
            await client.query(query);
            console.log(`Executed: ${query}`);
        } catch (err) {
            console.error(`Error executing ${query}: ${err.message}`);
        }
    }

    console.log('Platform Cleanup completed successfully.');

  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await client.end();
  }
}

cleanup();
