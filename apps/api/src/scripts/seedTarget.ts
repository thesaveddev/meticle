// Which database a seed script is about to touch.
//
// The October seed was written against the local dev database and then run
// there by mistake when the data was wanted on the production VPS. Nothing in
// the script could tell the difference: `DATABASE_URL` pointed wherever the
// environment pointed, and "Clean Care LTD" happened to exist in both. So the
// target is resolved explicitly and printed before any write, and a write to
// anything other than the local dev database has to be confirmed by name.
//
// ## Why localhost is not the test for "local"
//
// seed-vps.ts reaches production through an SSH tunnel:
//
//   postgres://meticle:<pwd>@localhost:55432/meticle
//
// That is localhost, and it is the production database. Treating localhost as
// a stand-in for "somebody's laptop" would wave through the exact run this
// module exists to catch, so the test is the whole connection target — the
// local dev database is a specific host, port and database name, not a
// hostname.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const LOCAL_PORT = '5432';
const LOCAL_DB = 'meticle';

export interface SeedTarget {
  /** Organisation to seed. */
  orgName: string;
  /** Year and 1-based month of the rota, e.g. 2026 / 10 for October 2026. */
  year: number;
  month: number;
  /** 'YYYY-MM' — the boundary dates passed to listVisits. */
  from: string;
  to: string;
  /** Connection string with the password removed. */
  safeUrl: string;
  host: string;
  port: string;
  database: string;
  /** Postgres role the write would run as — `meticle_app` bypasses nothing,
   *  `meticle` is the owner role that bypasses RLS. */
  role: string;
  /** True only for the local dev database. */
  isLocalDev: boolean;
  /** `host:port/database`, the string a remote write must confirm. */
  confirmToken: string;
}

function redact(url: URL): string {
  const copy = new URL(url.toString());
  if (copy.password) copy.password = '***';
  return copy.toString();
}

/**
 * Resolve the target from the environment.
 *
 * Overridable per run, so the same script serves the local dev database and the
 * production tunnel without being edited:
 *
 *   SEED_ORG_NAME   organisation to seed   (default: Clean Care LTD)
 *   SEED_YEAR       rota year             (default: 2026)
 *   SEED_MONTH      rota month, 1-12      (default: 10)
 *
 * @throws if the month is out of range or DATABASE_URL is missing/unparseable.
 */
export function resolveSeedTarget(env: NodeJS.ProcessEnv = process.env): SeedTarget {
  const raw = env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      'DATABASE_URL is not set. Point it at the database you intend to seed — ' +
        'for production that is the SSH tunnel in seed-vps.ts:\n' +
        "  DATABASE_URL='postgres://meticle:<pwd>@localhost:55432/meticle'",
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`DATABASE_URL could not be parsed as a postgres URL: ${redactSafe(raw)}`);
  }

  const database = url.pathname.replace(/^\//, '') || '';
  const host = url.hostname;
  const port = url.port || '5432';
  const role = decodeURIComponent(url.username || '(default)');

  const year = Number(env.SEED_YEAR ?? 2026);
  const month = Number(env.SEED_MONTH ?? 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`SEED_YEAR must be a four-digit year, got ${env.SEED_YEAR}`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`SEED_MONTH must be 1-12, got ${env.SEED_MONTH}`);
  }

  // to= is exclusive of the next month: October runs to 2026-11-01.
  const pad = (n: number) => String(n).padStart(2, '0');
  const from = `${year}-${pad(month)}-01`;
  const to = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;

  return {
    orgName: env.SEED_ORG_NAME ?? 'Clean Care LTD',
    year,
    month,
    from,
    to,
    safeUrl: redact(url),
    host,
    port,
    database,
    role,
    isLocalDev: LOCAL_HOSTS.has(host) && port === LOCAL_PORT && database === LOCAL_DB,
    confirmToken: `${host}:${port}/${database}`,
  };
}

function redactSafe(raw: string): string {
  return raw.replace(/(:\/\/[^:@/]+:)[^@/]*@/, '$1***@');
}

/** Print the resolved target, password removed, so the operator can see it. */
export function reportTarget(target: SeedTarget, label = 'target'): void {
  console.log(`\n${label}:`);
  console.log(`  database    ${target.safeUrl}`);
  console.log(`  role        ${target.role}`);
  console.log(`  organisation ${target.orgName}`);
  console.log(`  month       ${target.from.slice(0, 7)}`);
  console.log(`  scope       ${target.isLocalDev ? 'LOCAL DEV' : 'REMOTE — writes affect a shared database'}`);
}

/**
 * Refuse to write anywhere but the local dev database without confirmation.
 *
 * A dry run is read-only and always allowed; that is the whole point of it.
 * Otherwise SEED_CONFIRM_TARGET must equal the target's confirm token, so the
 * confirmation names the database it applies to rather than being a generic
 * "yes" that could be copy-pasted from a previous run against a different one.
 *
 * @param isDryRun when true, no confirmation is required.
 * @throws when the confirmation is missing or does not match.
 */
export function requireWriteConsent(target: SeedTarget, isDryRun: boolean): void {
  if (isDryRun || target.isLocalDev) return;

  const provided = process.env.SEED_CONFIRM_TARGET;
  if (provided === target.confirmToken) return;

  throw new Error(
    `Refusing to write to ${target.confirmToken} — that is not the local dev database.\n` +
      'Re-run with the database named explicitly:\n\n' +
      `  SEED_CONFIRM_TARGET=${target.confirmToken} npm run seed:october-visits\n\n` +
      'Or first preview exactly what would change, which writes nothing:\n\n' +
      '  npm run seed:october-visits -- --dry-run\n',
  );
}

/**
 * Look up the organisation by name, failing loudly with the alternatives.
 *
 * A missing org used to print "Nothing to do" and exit 0, which reads as a
 * successful run. Against a production database whose organisations differ from
 * dev that is the worst possible outcome: the seed appears to have worked and
 * nothing was written.
 */
export async function requireOrg(
  client: { query: (text: string, params?: any[]) => Promise<{ rows: any[] }> },
  orgName: string,
): Promise<string> {
  const found = await client.query('SELECT id FROM organizations WHERE name = $1', [orgName]);
  if (found.rows.length) return found.rows[0].id as string;

  const others = await client.query('SELECT name FROM organizations ORDER BY name LIMIT 20');
  const names = others.rows.map((r) => r.name as string);
  throw new Error(
    `No organisation named '${orgName}'. Nothing was written.\n` +
      (names.length
        ? `Organisations on this database (first 20):\n  ${names.join('\n  ')}\n\n` +
          'If the right one is not listed, set SEED_ORG_NAME to its exact name.\n'
        : 'This database has no organisations at all.\n'),
  );
}