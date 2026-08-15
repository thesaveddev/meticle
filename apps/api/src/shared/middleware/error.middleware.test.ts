import { describe, it, expect, vi } from 'vitest';
import { ZodError } from 'zod';
import { errorHandler, AppError } from './error.middleware';

function makeRes() {
  const json = vi.fn().mockReturnThis();
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json,
    setHeader: vi.fn(),
  };
  return { res, json };
}

describe('errorHandler', () => {
  it('maps body-parser entity.parse.failed errors to 400', () => {
    const { res, json } = makeRes();
    const err: any = Object.assign(new SyntaxError('Unexpected token'), {
      type: 'entity.parse.failed',
      status: 400,
      statusCode: 400,
      expose: true,
    });
    errorHandler(err, {} as any, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Invalid JSON body' })
    );
  });

  it('maps body too large errors to 413', () => {
    const { res, json } = makeRes();
    const err: any = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
      status: 413,
      expose: true,
    });
    errorHandler(err, {} as any, res, () => {});
    expect(res.status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 413, message: 'Request body too large' })
    );
  });

  it('maps other exposed 4xx errors to their status', () => {
    const { res, json } = makeRes();
    const err: any = Object.assign(new Error('Payload too long'), { status: 431, expose: true });
    errorHandler(err, {} as any, res, () => {});
    expect(res.status).toHaveBeenCalledWith(431);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 431, message: 'Payload too long' })
    );
  });

  it('returns 500 for unhandled errors', () => {
    const { res, json } = makeRes();
    errorHandler(new Error('boom'), {} as any, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal Server Error' })
    );
  });

  it('returns AppError status and message', () => {
    const { res, json } = makeRes();
    errorHandler(new AppError(404, 'Not found'), {} as any, res, () => {});
    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Not found' })
    );
  });

  it('returns 400 with fields for ZodError', () => {
    const { res, json } = makeRes();
    const schema = { parse: () => { throw new ZodError([{ path: ['email'], message: 'Required', code: 'invalid_type', expected: 'string', received: 'undefined' }]); } };
    try {
      (schema as any).parse();
    } catch (e) {
      errorHandler(e as any, {} as any, res, () => {});
    }
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, errors: [{ field: 'email', message: 'Required' }] })
    );
  });
});
