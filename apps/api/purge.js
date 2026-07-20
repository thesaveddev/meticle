const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:admin@localhost:5432/caredesk' });
(async () => {
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  const tables = res.rows.map(r => r.table_name).filter(t => t !== 'migrations');
  if (tables.length === 0) { console.log('No tables to truncate'); process.exit(0); }
  await client.query('TRUNCATE TABLE ' + tables.map(t => '"' + t + '"').join(', ') + ' CASCADE');
  console.log('Purged tables: ' + tables.join(', '));
  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
