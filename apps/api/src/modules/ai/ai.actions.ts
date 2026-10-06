/**
 * Reusable Mica action framework.
 *
 * The product plan wants Mica to grow from "one voice care-note flow" into a
 * small, inspectable action system: intent detection, entity/context resolution,
 * permission + risk metadata, typed input/output, structured LLM output, and an
 * audit trail for every action. This file is the type layer for that system.
 *
 * It is deliberately small and lives next to the existing AI module so the first
 * actions reuse AIRepository, aiCall, renderOrgPrompt, the prompt registry, and
 * the existing audit logging — rather than inventing a parallel service.
 *
 * Today the only implemented action is CREATE_CARE_NOTE (voice + text), but the
 * shapes are written so later actions (create task, create appointment, prepare
 * handover, summarise changes, etc.) can be added without rewriting the flow.
 */

/** Risk tier attached to an action. Drives whether the client must confirm. */
export type MicaActionRisk = 'low' | 'medium' | 'high';

/** The discrete actions Mica can currently attempt. */
export type MicaActionId =
  /** Voice/text care note: transcribe → resolve person/shift → draft → review → persist */
  | 'CREATE_CARE_NOTE'
  /** Planned: operational actions live here once they exist. */
  | 'CREATE_TASK'
  | 'CREATE_APPOINTMENT'
  | 'PREPARE_HANDOVER'
  | 'SUMMARISE_CHANGES'
  /** Sentinel placeholder so the registry can grow without becoming partial. */
  | '_UNIMPLEMENTED';

/** Metadata every Mica action must describe to the gateway and the client. */
export interface MicaActionMetadata {
  id: MicaActionId;
  label: string;
  description: string;
  /** Minimal input shape the client must supply before the action runs. */
  inputSchema: string;
  /** What the action returns after successful execution. */
  outputSchema: string;
  /** Who is allowed to invoke this action. Mirrors existing role checks. */
  allowedRoles: Array<'ORG_ADMIN' | 'MANAGER' | 'CARE_WORKER'>;
  risk: MicaActionRisk;
  /**
   * Whether the action expects explicit user confirmation before persistence.
   *
   * The voice care-note flow already behaves this way: it produces a draft, shows
   * it, and only persists after the user approves. New actions with side effects
   * should follow the same contract rather than writing straight through.
   */
  requiresConfirmation: boolean;
  /**
   * The audit feature key used when logging this action.
   *
   * Kept explicit so the audit log stays readable as a list of Mica actions rather
   * than a bag of prompt keys. For LLM-mediated actions this is also the prompt key
   * the existing audit helper expects.
   */
  auditFeature: string;
  /**
   * Optional prompt key if the action sends variables to an LLM.
   *
   * Not every action needs one (deterministic tools may not), but most Mica actions
   * today render a prompt and so should name the template they use.
   */
  promptKey?: string;
}

/** What the client sends when it asks Mica to perform an action. */
export interface MicaActionRequest {
  /** Which action is being invoked. */
  action: MicaActionId;
  /** Optional clarification pass: the client could not resolve a parameter alone. */
  clarify?: boolean;
  /** When the client first heard the intent from speech, the raw utterance. */
  utterance?: string;
  /** Action-specific input. Shape depends on `action`. */
  input: Record<string, unknown>;
}

/** A structured clarification response the client can render as a choice card. */
export interface MicaClarificationResponse {
  needClarification: true;
  type: 'choosePerson' | 'chooseShift' | 'chooseOption';
  prompt: string;
  options?: Array<{ id: string; label: string; detail?: string }>;
  candidates?: Array<{ id: string; name: string; detail?: string }>;
}

/** Successful response from an action that has not yet been persisted. */
export interface MicaActionDraft<TOut = unknown> {
  needClarification?: never;
  draft: true;
  action: MicaActionId;
  output: TOut;
  /** Human-readable summary the client can echo back before confirmation. */
  summary: string;
  /** What changed, for the review card. */
  context: MicaActionContext;
}

/** Everything a Mica action knows about the world it is acting in. */
export interface MicaActionContext {
  organizationId: string;
  actedBy: string;
  /** The principal actor for audit purposes (usually the authenticated user). */
  userId: string;
  /** When the action was prepared. */
  preparedAt: string;
  /** Where the action came from. */
  source: 'voice' | 'text' | 'manual';
  /** Action-specific context, e.g. the resolved person + shift for a care note. */
  extras?: Record<string, unknown>;
}

/** Top-level response from the Mica action gateway. */
export type MicaActionResult<TOut = unknown> =
  | MicaClarificationResponse
  | MicaActionDraft<TOut>
  | MicaActionError;

/** Errors bubble up as structured objects, not raw strings. */
export interface MicaActionError {
  error: {
    message: string;
    code?: string;
    candidates?: Array<{ id: string; name: string; detail?: string }>;
  };
}

/**
 * Contract for one Mica action implementation.
 *
 * The framework calls `resolve` first. If it returns a clarification, the gateway
 * returns it to the client. Otherwise it calls `execute`, which may return a draft
 * for review or a final result. The same class can be used for both voice and
 * manual invocations because the difference is mostly in how the input was obtained.
 */
export interface MicaAction<TIn = Record<string, unknown>, TOut = unknown> {
  metadata: MicaActionMetadata;
  /** Validate + resolve the request; may return a clarification instead of continuing. */
  resolve(request: MicaActionRequest, context: MicaActionContext): Promise<MicaActionResult | MicaActionDraft<TOut>>;
  /** Execute the action once resolution has succeeded. May return a clarification or draft. */
  execute(request: MicaActionRequest, context: MicaActionContext): Promise<MicaActionResult | MicaActionDraft<TOut>>;
}

/**
 * Small helper: the standard context block the gateway builds for every action.
 */
export function makeActionContext(
  organizationId: string,
  userId: string,
  source: 'voice' | 'text' | 'manual',
  extras?: Record<string, unknown>,
): MicaActionContext {
  return {
    organizationId,
    userId,
    actedBy: userId,
    preparedAt: new Date().toISOString(),
    source,
    extras,
  };
}

/** Registry the gateway uses to route and describe actions. */
const MICA_ACTIONS_INTERNAL: Record<Exclude<MicaActionId, '_UNIMPLEMENTED'>, MicaActionMetadata> = {
  CREATE_CARE_NOTE: {
    id: 'CREATE_CARE_NOTE',
    label: 'Record a care note',
    description: 'Transform voice or text observations into a structured care note for a person, then review before saving.',
    inputSchema: 'MicaCreateCareNoteInput',
    outputSchema: 'MicaCreateCareNoteOutput',
    allowedRoles: ['ORG_ADMIN', 'MANAGER', 'CARE_WORKER'],
    risk: 'medium',
    requiresConfirmation: true,
    auditFeature: 'voice_care_note',
    promptKey: 'daily_note_generation',
  },
  CREATE_TASK: {
    id: 'CREATE_TASK',
    label: 'Create a task',
    description: 'Create a follow-up task for a person or staff member. Not yet implemented.',
    inputSchema: 'MicaCreateTaskInput',
    outputSchema: 'MicaCreateTaskOutput',
    allowedRoles: ['ORG_ADMIN', 'MANAGER', 'CARE_WORKER'],
    risk: 'medium',
    requiresConfirmation: true,
    auditFeature: 'create_task',
  },
  CREATE_APPOINTMENT: {
    id: 'CREATE_APPOINTMENT',
    label: 'Create an appointment',
    description: 'Create an appointment for a person. Not yet implemented.',
    inputSchema: 'MicaCreateAppointmentInput',
    outputSchema: 'MicaCreateAppointmentOutput',
    allowedRoles: ['ORG_ADMIN', 'MANAGER', 'CARE_WORKER'],
    risk: 'medium',
    requiresConfirmation: true,
    auditFeature: 'create_appointment',
  },
  PREPARE_HANDOVER: {
    id: 'PREPARE_HANDOVER',
    label: 'Prepare a handover',
    description: 'Prepare a shift handover summary for a person or team. Not yet implemented.',
    inputSchema: 'MicaPrepareHandoverInput',
    outputSchema: 'MicaPrepareHandoverOutput',
    allowedRoles: ['ORG_ADMIN', 'MANAGER', 'CARE_WORKER'],
    risk: 'low',
    requiresConfirmation: false,
    auditFeature: 'prepare_handover',
    promptKey: 'unified_intelligence',
  },
  SUMMARISE_CHANGES: {
    id: 'SUMMARISE_CHANGES',
    label: 'Summarise what has changed',
    description: 'Summarise changes for a person against recent records. Not yet implemented.',
    inputSchema: 'MicaSummariseChangesInput',
    outputSchema: 'MicaSummariseChangesOutput',
    allowedRoles: ['ORG_ADMIN', 'MANAGER', 'CARE_WORKER'],
    risk: 'low',
    requiresConfirmation: false,
    auditFeature: 'summarise_changes',
    promptKey: 'unified_intelligence',
  },
};

export const MICA_ACTIONS: Record<MicaActionId, MicaActionMetadata> = {
  ...MICA_ACTIONS_INTERNAL,
  _UNIMPLEMENTED: {
    id: '_UNIMPLEMENTED',
    label: 'Unimplemented action',
    description: 'Placeholder so the registry can grow without becoming partial.',
    inputSchema: 'unknown',
    outputSchema: 'unknown',
    allowedRoles: ['ORG_ADMIN'],
    risk: 'high',
    requiresConfirmation: true,
    auditFeature: '_unimplemented',
  },
};

/** Action registry lookup. */
export function getMicaAction(id: MicaActionId): MicaActionMetadata {
  return MICA_ACTIONS[id] ?? MICA_ACTIONS.CREATE_CARE_NOTE;
}
