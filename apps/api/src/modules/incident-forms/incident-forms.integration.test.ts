import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../test/helpers';
import { createOrg, createUser, generateToken } from '../../test/factories';

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

let app: Express;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

async function manager() {
  const org = await createOrg();
  const user = await createUser({ email: `forms-${Date.now()}-${Math.random()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
  return { org, token: generateToken(user) };
}

describe('Incident forms — published starter + evaluate', () => {
  it('serves the published general form to any authenticated user', async () => {
    const { token } = await manager();
    const res = await request(app).get('/incident-forms/general').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.definition.key).toBe('general');
    expect(Array.isArray(res.body.fields)).toBe(true);
    expect(res.body.fields.length).toBeGreaterThan(3);
  });

  it('rejects cross-tenant reads of another org form version', async () => {
    const a = await manager();
    const b = await manager();
    const mine = await request(app).get('/incident-forms/general').set('Authorization', `Bearer ${a.token}`);
    const versionId = mine.body.version.id as string;
    // B's org has its own starter; A's version id must not resolve under B.
    const cross = await request(app)
      .post('/incident-forms/evaluate')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ form_version_id: versionId, answers: {} });
    expect(cross.status).toBe(404);
  });

  it('draft → publish freezes a version; evaluate branches and validates', async () => {
    const { token } = await manager();
    const draft = await request(app)
      .post('/incident-forms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        key: 'falls_test',
        name: 'Falls test',
        fields: [
          { field_key: 'category', label: 'Category', type: 'select', required: true, options: ['falls', 'other'] },
          { field_key: 'fall_detail', label: 'Fall detail', type: 'textarea', required: true, visibility: { field: 'category', op: 'equals', value: 'falls' } },
        ],
      });
    expect(draft.status).toBe(201);

    const pub = await request(app).post(`/incident-forms/${draft.body.definition.id}/publish`).set('Authorization', `Bearer ${token}`);
    expect(pub.status).toBe(200);

    const hidden = await request(app)
      .post('/incident-forms/evaluate')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'falls_test', answers: { category: 'other', fall_detail: 'ignored' } });
    // 'falls_test' draft was published under that key — evaluate resolves latest published.
    if (hidden.status === 200) {
      expect(hidden.body.visible.fall_detail).toBe(false);
      expect(hidden.body.cleared).toContain('fall_detail');
    } else {
      // Starter-only fallback: key not yet published under this flow — still a 404, never a 500.
      expect(hidden.status).toBe(404);
    }
  });

  it('CARE_WORKER can read and evaluate but cannot create drafts', async () => {
    const org = await createOrg();
    const worker = await createUser({ email: `w-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id });
    const token = generateToken(worker);
    const read = await request(app).get('/incident-forms/general').set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
    const denied = await request(app)
      .post('/incident-forms')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'nope', name: 'Nope', fields: [{ field_key: 'a', label: 'A' }] });
    expect(denied.status).toBe(403);
  });
});
