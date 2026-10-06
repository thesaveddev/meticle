import { Request } from 'express';
import { CreateCareNoteAction } from './actions/createCareNote.action';
import {
  MicaActionRequest,
  MicaActionContext,
  MicaActionResult,
  getMicaAction,
} from './ai.actions';
import { AIController } from './ai.controller';

export type MicaGatewayContext = {
  req: Request;
  user: { organizationId: string; userId: string };
};

export const MicaGateway = {
  async handle(
    request: MicaActionRequest,
    ctx: MicaGatewayContext,
  ): Promise<MicaActionResult> {
    if (request.action === 'CREATE_CARE_NOTE') {
      const action = new CreateCareNoteAction(AIController as any);
      const actionContext: MicaActionContext = {
        organizationId: ctx.user.organizationId,
        userId: ctx.user.userId,
        actedBy: ctx.user.userId,
        preparedAt: new Date().toISOString(),
        source: ((request.input.source as MicaActionRequest['input']['source']) || 'voice') as 'voice' | 'text' | 'manual',
        extras: undefined,
      };

      const resolveResult = await action.resolve(request, actionContext);

      if ('error' in resolveResult) {
        return resolveResult;
      }
      if ('needClarification' in resolveResult) {
        return resolveResult;
      }
      if ('draft' in resolveResult) {
        return resolveResult;
      }

      // If resolution did not hand us a draft, treat it as an error.
      return { error: { message: 'The care note request could not be prepared.' } };
    }

    return { error: { message: `Mica action "${request.action}" is not implemented yet.` } };
  },
};

export type { MicaActionRequest, MicaActionContext, MicaActionResult } from './ai.actions';
export { getMicaAction } from './ai.actions';
