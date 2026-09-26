/**
 * Unauthenticated account enumeration.
 *
 * An attacker who can tell which addresses have accounts on a care platform has
 * a targeting list: the staff who hold client records, and the domains whose
 * mail the organisation trusts. Every public auth endpoint has to answer the
 * same way for a registered address and an unregistered one, or it becomes an
 * oracle — and the honest defence is a test, because a helpful error message
 * looks like good service.
 *
 * `/auth/forgot-password` was already correct. Two others were not:
 *
 * - `/auth/send-email-code` returned `409 An account with this email already
 *   exists`, which undid forgot-password's non-enumerability on the same
 *   surface — the first one a prospective member of staff reaches.
 * - `/auth/login` returned `403 Your account has been deactivated` for a
 *   deactivated account and `401 Invalid email or password` for an unknown one,
 *   which distinguishes "exists but deactivated" from "does not exist" without
 *   ever attempting a password comparison.
 *
 * `/auth/register` still discloses, and that is deliberate rather than
 * overlooked — see `REGISTER_DISCLOSES_BY_DESIGN` below.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTROLLER = join(process.cwd(), 'src/modules/auth/auth.controller.ts');

/** Body of one static method, by name. */
function method(name: string): string {
  const source = readFileSync(CONTROLLER, 'utf8');
  const start = source.indexOf(`static async ${name}(`);
  if (start === -1) throw new Error(`${name} not found`);
  const next = source.indexOf('\n  static ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

const body = (name: string) => method(name).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\S\n]*\/\/[^\n]*$/gm, '');

describe('public auth endpoints do not disclose whether an account exists', () => {
  it('send-email-code answers identically for a registered address', () => {
    const source = body('sendEmailCode');
    // A lookup is harmless on its own — the rate limit needs to know the
    // address — but it must not gate the response.
    expect(source).not.toMatch(/findByEmail[\s\S]{0,200}throw new AppError/);
    expect(source).not.toContain('already exists');
    // The success path must still be reachable, or the code is never sent.
    expect(source).toContain("res.json({ message: 'Verification code sent' })");
  });

  it('login does not distinguish a deactivated account from an unknown one', () => {
    const source = body('login');
    const unknown = /!user\s*\)?\s*throw new AppError\((\d+),\s*'([^']+)'/;
    const deactivated = /status === 'deactivated'\)[\s\S]{0,120}?throw new AppError\((\d+),\s*'([^']+)'/;
    expect(source).toMatch(unknown);
    expect(source).toMatch(deactivated);
    const unknownMatch = unknown.exec(source)!;
    const deactivatedMatch = deactivated.exec(source)!;
    // Same status and same body, or the pair distinguishes existence. Timing is
    // the other half of this and is not asserted here; see the note below.
    expect(deactivatedMatch[1]).toBe(unknownMatch[1]);
    expect(deactivatedMatch[2]).toBe(unknownMatch[2]);
  });

  it('forgot-password stays non-enumerable', () => {
    // The behaviour the other two were measured against. Kept as a test so the
    // reference implementation cannot drift either.
    const source = body('forgotPassword');
    expect(source).toContain("res.json({ message: 'If that email exists, a reset link has been sent.' })");
    expect(source).not.toContain('already exists');
  });
});

/**
 * The one public endpoint that still discloses, recorded rather than hidden.
 *
 * `/auth/register` must reject a duplicate address, so it cannot answer
 * identically in both cases. Disclosure is only safe once the caller has proved
 * they own the mailbox, and the client does require a verified code before
 * submitting — but *the server does not*. `registrationSchema` carries no
 * verification code, so `register` is currently reachable with no proof of
 * ownership at all, which makes the duplicate error an unconditional oracle.
 *
 * Closing it properly means requiring a verified code server-side, which is a
 * change to the signup contract rather than a one-line edit. Tracked as an
 * outstanding item in `docs/SECURITY_POLICY.md`; this assertion fails loudly if
 * the disclosure is removed without the ownership check going in with it.
 */
describe('register disclosure is recorded, not accidental', () => {
  /**
   * `REGISTER_OWNSHIP_PROOF` is false today. While it is false, the test below
   * asserts only that the gap is still visible and still described in the same
   * place as the code — not that the endpoint is safe. It is not.
   *
   * Flip this to true in the same commit that adds the server-side ownership
   * check, and the assertion tightens to require that check.
   */
  const REGISTER_OWNSHIP_PROOF = false;

  it('register either stops disclosing or proves mailbox ownership first', () => {
    const source = body('register');
    const provesOwnership = /email_verification_codes[\s\S]{0,400}verified/i.test(source)
      || /verified[\s\S]{0,200}email/i.test(source);

    if (REGISTER_OWNSHIP_PROOF) {
      // Ownership is established, so the duplicate error is only ever shown to
      // someone who controls the mailbox and it stops being an oracle.
      expect(provesOwnership).toBe(true);
      return;
    }

    // Known, open, and deliberately left failing-safe rather than forgotten:
    // this asserts the disclosure is still exactly what the note above says it
    // is, so the documentation cannot quietly go stale in either direction.
    expect({
      disclosesDuplicate: source.includes('already exists'),
      provesOwnership,
    }).toEqual({ disclosesDuplicate: true, provesOwnership: false });
  });
});
