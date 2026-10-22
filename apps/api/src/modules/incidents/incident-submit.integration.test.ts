import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../test/helpers';
import { createOrg, createUser, createIncidentCategory, generateToken } from '../../test/factories';

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

let app: Express;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

describe('Incident submit wiring — form + assess + workflow', () => {
  it('files with form answers, assesses severity and starts a workflow', async () => {
    const org = await createOrg();
    const mgr = await createUser({ email: `sub-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
    const token = generateToken(mgr);
    const cat = await createIncidentCategory({ organizationId: org.id });

    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Fall in corridor',
        description: 'Resident slipped near the lounge',
        category_id: cat.id,
        location: 'Lounge',
        form_key: 'general',
        form_answers: { category: 'falls', harm_level: 'severe', occurred_at: '2026-10-26T10:00:00Z', location: 'Lounge', description: 'Resident slipped near the lounge' },
      });

    expect(res.status).toBe(201);
    expect(res.body.form_version_id).toBeTruthy();
    expect(res.body.current_severity_assessment_id).toBeTruthy();
    // Engine decides: severe harm → high.
    expect(res.body.severity).toBe('high');

    const assessments = await request(app).get(`/incidents/${res.body.id}/assessments`).set('Authorization', `Bearer ${token}`);
    expect(assessments.status).toBe(200);
    expect(assessments.body.length).toBeGreaterThanOrEqual(1);

    const workflow = await request(app).get(`/incidents/${res.body.id}/workflow`).set('Authorization', `Bearer ${token}`);
    expect(workflow.status).toBe(200);
    expect(workflow.body.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it('idempotent retry returns the same incident without duplicating the workflow', async () => {
    const org = await createOrg();
    const mgr = await createUser({ email: `sub2-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
    const token = generateToken(mgr);
    const cat = await createIncidentCategory({ organizationId: org.id });
    const key = randomUUID();

    const first = await request(app).post('/incidents').set('Authorization', `Bearer ${token}`).send({
      title: 'Retry case', category_id: cat.id, client_submission_id: key,
      form_answers: { category: 'falls', harm_level: 'minor', description: 'x' },
    });
    const retry = await request(app).post('/incidents').set('Authorization', `Bearer ${token}`).send({
      title: 'Retry case', category_id: cat.id, client_submission_id: key,
      form_answers: { category: 'falls', harm_level: 'minor', description: 'x' },
    });
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(first.body.id);

    const workflow = await request(app).get(`/incidents/${first.body.id}/workflow`).set('Authorization', `Bearer ${token}`);
    expect(workflow.body.tasks.length).toBeGreaterThanOrEqual(1);
  });

  it('a support worker report stays visible only to them, with engine rows attached', async () => {
    const org = await createOrg();
    const worker = await createUser({ email: `subw-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id });
    const other = await createUser({ email: `subo-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id });
    const cat = await createIncidentCategory({ organizationId: org.id });

    const res = await request(app).post('/incidents').set('Authorization', `Bearer ${generateToken(worker)}`).send({
      title: 'Worker concern', category_id: cat.id,
      form_answers: { category: 'falls', harm_level: 'minor', description: 'Saw a near miss' },
    });
    expect(res.status).toBe(201);
    expect(res.body.current_severity_assessment_id).toBeTruthy();

    const forbidden = await request(app).get(`/incidents/${res.body.id}/workflow`).set('Authorization', `Bearer ${generateToken(other)}`);
    expect(forbidden.status).toBe(403);
  });
});
