import { renderPrompt } from './ai.prompts';
import { resolveAiMinimisation, minimiseVariables, type AiMinimisation } from './ai.minimisation';

/**
 * The only supported way to build a prompt from database records.
 *
 * `renderPrompt` in `ai.prompts.ts` stays pure and synchronous: it redacts and
 * substitutes, and it is unit-tested without a database. This wrapper is the
 * seam where per-organisation policy enters, and it exists so that policy
 * cannot be forgotten.
 *
 * That is not a hypothetical. The de-identification pass added earlier in this
 * codebase was applied inside `renderPrompt` precisely so that it would apply to
 * all fourteen call sites rather than thirteen — a control that has to be
 * remembered at fourteen places has been forgotten at one of them by the time it
 * matters, and a new capability inherits the leak by default. Minimisation has
 * the same shape and the same failure mode, so it gets the same treatment:
 * resolved here, once, from the organisation, rather than at each call site.
 *
 * The counter-argument was that a fifth argument on `renderPrompt` would be
 * simpler, and it would also be optional. Optional means a call site that
 * forgets it silently sends narrative under a policy that forbids it, and the
 * failure is invisible in review because the call still compiles and still
 * works. `ai.boundary.test.ts` fails the build if any call site reaches for
 * `renderPrompt` directly instead of coming through here.
 */
export async function renderOrgPrompt(
  promptKey: string,
  variables: Record<string, string>,
  orgId: string,
  extraNameKeys: string[] = [],
  /** Overrides the database read. Used by tests and the background consumer. */
  minimisationOverride?: AiMinimisation,
): Promise<{ system: string; user: string }> {
  const mode = minimisationOverride ?? (await resolveAiMinimisation(orgId));
  // Minimise before redacting, not after: withdrawing the narrative first
  // leaves the redaction pass strictly less text to handle, and guarantees no
  // narrative can be reintroduced by a later template substitution.
  const minimised = minimiseVariables(variables, mode);
  return renderPrompt(promptKey, minimised, orgId, extraNameKeys);
}
