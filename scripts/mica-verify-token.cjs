/* Local dev verification helper — creates a clearly-named temporary ORG_ADMIN
 * in an AI-enabled org via the app's own migrate (superuser) pool, then mints a
 * 1h JWT so Mica TTS can be exercised end to end. Never prints secrets. */
require('dotenv').config({ path: require('path').resolve(__dirname, '../apps/api/.env') });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

(async () => {
  const migrateUrl = process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: migrateUrl });
  const orgRes = await pool.query(
    "SELECT id FROM organizations WHERE coalesce(ai_config->>'apiKey','') <> '' AND ai_config->>'enabled' = 'true' ORDER BY created_at DESC LIMIT 1"
  );
  if (!orgRes.rows.length) { console.log('NO AI-ENABLED ORG'); process.exit(1); }
  const org = orgRes.rows[0];
  const email = 'mica-tts-verify+temp@meticlecare.dev';
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
  const hash = bcrypt.hashSync('VerifyOnly-Tts2026!', 10);
  const u = await pool.query(
    "INSERT INTO users (id, organization_id, email, role, status, password_hash) VALUES (gen_random_uuid(), $1, $2, 'ORG_ADMIN', 'active', $3) RETURNING id",
    [org.id, email, hash]
  );
  const userId = u.rows[0].id;
  const secret = process.env.JWT_SECRET;
  if (!secret) { console.log('NO JWT_SECRET'); process.exit(1); }
  const token = jwt.sign(
    { userId, organizationId: org.id, role: 'ORG_ADMIN', email },
    secret,
    { expiresIn: '1h' }
  );
  const tokenPath = require('path').join(require('os').tmpdir(), 'mica-token.txt');
  require('fs').writeFileSync(tokenPath, token);
  require('fs').writeFileSync(tokenPath + '.path', tokenPath);
  console.log('VERIFY USER READY org', String(org.id).slice(0, 8), 'token at', tokenPath);
  await pool.end();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
