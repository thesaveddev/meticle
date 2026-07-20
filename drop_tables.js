const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:admin@localhost:5432/caredesk' });
(async () => {
  await client.connect();
  const res = await client.query(
    "SELECT string_agg('DROP TABLE IF EXISTS \"' || tablename || '\" CASCADE;', ' ') AS stmts FROM pg_tables WHERE schemaname = 'public'"
  );
  const dropStmts = res.rows[0]?.stmts;
  if (dropStmts) {
    console.log('Dropping all tables...');
    await client.query(dropStmts);
    console.log('All tables dropped.');
  } else {
    console.log('No tables found.');
  }
  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
