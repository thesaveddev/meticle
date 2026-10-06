import { query as dbQuery } from '../../../shared/database';
import { AIController } from '../ai.controller';
import {
  MicaAction,
  MicaActionContext,
  MicaActionRequest,
  MicaActionResult,
  MicaClarificationResponse,
  MicaActionDraft,
  MicaActionMetadata,
  MicaActionError,
} from '../ai.actions';

export class CreateCareNoteAction implements MicaAction<CreateCareNoteInput, CreateCareNoteRawResult> {
  metadata: MicaActionMetadata = {
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
  };

  constructor(private db: typeof dbQuery) {}

  async resolve(
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionResult | MicaActionDraft<CreateCareNoteRawResult>> {
    const input = request.input as CreateCareNoteInput;
    const orgId = context.organizationId;

    if (!input.transcription && !input.staffInput) {
      return { error: { message: 'Mica needs something to listen to. Say what you observed, or type it.' } };
    }

    const body: CreateCareNoteInput = {
      personId: input.personId,
      personName: input.personName,
      staffInput: input.staffInput || input.transcription || '',
      shift: input.shift,
      noteDate: input.noteDate,
      source: (input.source ?? context.source) as 'voice' | 'text' | 'manual',
    };

    if (request.clarify) {
      return this.resolveClarifications(orgId, body, request, context);
    }

    return this.buildDraft(orgId, body, context);
  }

  async resolveClarifications(
    orgId: string,
    body: CreateCareNoteInput,
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionResult | MicaClarificationResponse | MicaActionDraft<CreateCareNoteRawResult>> {
    if (!body.personId && body.personName) {
      const candidates = await AIController.findPersonByName(this.db, orgId, body.personName);
      if (candidates.length === 0) {
        return { error: { message: `No active person named "${body.personName}" found in this organisation` } };
      }
      if (candidates.length > 1) {
        return {
          needClarification: true,
          type: 'choosePerson',
          prompt: `I found ${candidates.length} people named "${body.personName}". Which one?`,
          candidates: candidates.map((c: any) => ({
            id: c.id,
            name: `${c.first_name} ${c.last_name}`,
            detail: c.room_number ? `Room ${c.room_number}` : undefined,
          })),
        };
      }
      body.personId = candidates[0].id;
    }

    if (!body.transcription && !body.staffInput) {
      return { error: { message: 'I did not catch any speech. Try again.' } };
    }

    if (!body.shift) {
      return {
        needClarification: true,
        type: 'chooseShift',
        prompt: 'Which shift is this note for?',
        options: [
          { id: 'morning', label: 'Morning' },
          { id: 'afternoon', label: 'Afternoon' },
          { id: 'evening', label: 'Evening' },
          { id: 'night', label: 'Night' },
        ],
      };
    }

    return this.buildDraft(orgId, body, context);
  }

  async execute(
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionDraft<CreateCareNoteRawResult> | MicaActionResult> {
    const input = request.input as CreateCareNoteInput;
    const orgId = context.organizationId;

    const body: CreateCareNoteInput = {
      personId: input.personId,
      personName: input.personName,
      staffInput: input.staffInput || input.transcription || '',
      shift: input.shift,
      noteDate: input.noteDate,
      source: (input.source ?? context.source) as 'voice' | 'text' | 'manual',
    };

    return this.buildDraft(orgId, body, context);
  }

  private async buildDraft(
    orgId: string,
    body: CreateCareNoteInput,
    context: MicaActionContext,
  ): Promise<MicaActionDraft<CreateCareNoteRawResult> | MicaActionError> {
    const rawSource = body.source ?? context.source ?? 'voice';
    const res = await AIController.generateDailyNoteRaw(
      this.db,
      orgId,
      context.userId,
      {
        personId: body.personId,
        personName: body.personName,
        staffInput: body.staffInput || '',
        shift: body.shift,
        noteDate: body.noteDate,
        source: rawSource as 'voice' | 'text' | 'manual',
      },
    );

    if ('error' in res) {
      return res;
    }

    const noteContextSource = res.noteContext.source;
    let noteSource: 'voice' | 'text' | 'manual' = 'voice';
    if (noteContextSource === 'voice' || noteContextSource === 'text' || noteContextSource === 'manual') {
      noteSource = noteContextSource;
    }
    const drafted: MicaActionDraft<CreateCareNoteRawResult> = {
      draft: true,
      action: 'CREATE_CARE_NOTE',
      output: res,
      summary: `I've prepared the care note for ${res.person.name}.`,
      context: {
        organizationId: orgId,
        userId: context.userId,
        actedBy: context.userId,
        preparedAt: new Date().toISOString(),
        source: rawSource,
        extras: {
          personId: res.person.id,
          personName: res.person.name,
          shift: res.noteContext.shift,
          noteDate: res.noteContext.noteDate,
          source: noteSource,
        },
      },
    };

    return drafted;
  }
}

export interface CreateCareNoteInput {
  personId?: string;
  personName?: string;
  staffInput?: string;
  transcription?: string;
  shift?: string;
  noteDate?: string;
  source?: 'voice' | 'text' | 'manual';
}

export interface CreateCareNoteRawResult {
  result: any;
  person: { id: string; name: string };
  noteContext: {
    personId: string;
    shift: 'day' | 'night';
    noteDate: string;
    source: 'voice' | 'text' | 'manual';
  } & { source: 'voice' | 'text' | 'manual' };
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}
