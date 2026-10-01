# Evidence and reachability guards

Two guards that exist because of one specific failure, which happened twice.

## The failure

`apps/api/src/shared/utils/encryption.ts` implemented AES-256-GCM correctly, exported
`encryptField` and `decryptField`, and had unit tests proving the cipher worked. It
was imported by nothing at all. Three documents described column-level encryption as
implemented — `docs/CLAIM_REGISTER.md` (F10), the claim guard's registry entry, and
the privacy policy — and none of them was lying. The file existed. The code in it was
correct. The product stored NHS numbers, dates of birth and addresses in plaintext for
roughly a year, and no test failed at any point.

The error was not dishonesty. It was treating **existence as evidence of behaviour**. A
file existing proves a file exists.

## The two guards

### 1. `apps/api/src/shared/utils/unreferenced-helpers.test.ts`

Walks the TypeScript AST of `apps/api/src` and fails on any value export in
`shared/utils` that no other file calls — not product code, not itself, not a test.

Scoped to `shared/utils` deliberately. That is where crypto, serialisation, validation
and retention helpers live, so it is where an uncalled export is both plausible and
expensive. The same check across all of `src` would fire on controllers and route
handlers, which are legitimately exported for their route tables.

Type-only exports are skipped: an interface cannot be "called", and reporting them
would bury the real findings.

### 2. `apps/web/src/__tests__/claimEvidenceIsTested.test.ts`

Every entry in `REGISTERED_CLAIMS` marked `verified` with a code `evidencePath` must
have a test that exercises that file. It matches three ways, in order: the literal
path, the module name (`CallAssignmentBoard`), and a test in the evidence file's own
directory — because an HTTP integration test reaches a controller through
`createTestApp()` without ever naming it.

This is deliberately a coarse check. It does not attempt to judge whether a test
*proves* a claim, because a machine cannot, and a check claiming to would be worse
than none. What it does guarantee is that a verified claim cannot rest on code no test
has ever opened.

## Both were mutation-checked

A guard that cannot fail is indistinguishable from a guard that does not work. Each was
verified by breaking the thing it protects:

| Mutation | Result |
| --- | --- |
| Add an uncalled `export function` to `shared/utils` | Caught, names the symbol |
| Point a verified claim at `apps/api/src/modules/nonexistent/untested.module.ts` | Caught, names the claim |

## Three false-positive bugs found while building these

Recorded because the process is the point, and because a guard that cries wolf gets
deleted rather than fixed.

1. **Regex occurrence counting.** The first unreferenced-helpers guard counted
   word-boundary matches and subtracted the declaration. It reported fourteen healthy
   exports as dead, including `applyEmailDsn` — exported on line 55 and called on line
   52 of the same file. Replaced with an AST walk that resolves identifiers
   structurally, which leaves one finding: `signEmailDsnPayload`, the signing half of a
   webhook signature pair that only tests use. That is now a single allowlist entry with
   a reason.

   I also mis-read my own output partway through this. I reported the count dropping
   "from fourteen to three" when the real number was still in the double digits and my
   grep had truncated the list at twenty lines. The three I acted on were real; the
   claim that three remained was not. The AST version's actual output is one finding,
   and it took the fast version below to see the whole list at all.

2. **The guard certified itself.** `claimEvidenceIsTested.test.ts` quotes an example
   path in its own doc comment, and it was scanning a corpus that included itself — so
   a claim pointing at exactly that example path was satisfied by the guard's own
   comment. Found only because the mutation was re-run after the fix. The guard now
   excludes itself from the corpus it scans.

3. **Matching evidence by directory, too loosely.** An intermediate version accepted any
   directory beneath the app root, so a claim pointing at
   `apps/api/src/modules/nonexistent/` was covered by the tests in
   `apps/api/src/modules/ai/`. The mutation passed. Coverage now means coverage of *that*
   directory and its subdirectories only.

Two of the three real dead exports it found were deleted rather than allowlisted:
`blocklistSize`, `blocklistLastRefresh` and `_resolveMx` in `disposableEmail.ts` had no
references anywhere in the repository. The allowlist in
`unreferenced-helpers.test.ts` holds one entry, and a case asserts any entry carries a
reason, because an allowlist with entries and no explanations is indistinguishable from
a disabled guard.

## The cost of getting it wrong was a flaky test

The first working version walked the whole AST once per export — O(exports × tree). It
took 20 seconds alone, which is already most of the 30 second per-test timeout. In a
full suite run, with everything else competing for the CPU, it timed out and failed.
In isolation it passed. An intermittent failure that never reproduces when you go looking
for it is worse than a broken guard, because it teaches people the suite is unreliable.

Counting every identifier once and answering lookups from that map made it 85ms — about
240 times faster — and the failure cannot recur regardless of load. A guard that is slow
enough to time out gets re-run rather than read.

## What this cannot see

- A symbol reached only through `require()`, a string lookup, or a framework convention
  by name would read as dead. Nothing in this codebase does that.
- `createTestApp()` coverage is inferred from directory position, not from reading the
  route table. Confirming which routes a test mounts would need a module graph.
- A test that exists but asserts nothing about the evidence file satisfies both guards.
  That remains a judgement, and it is the judgement these two make hardest to make by
  accident — not impossible.

## The general lesson

Test coverage as a percentage would not have caught either instance. The encryption
module was covered. The problem was that coverage measured the cipher rather than the
product's use of it. Any future guard should ask the same question these two ask:
*does anything call this, and does any test observe the call?*