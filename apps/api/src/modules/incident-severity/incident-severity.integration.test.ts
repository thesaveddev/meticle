import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../test/helpers';
import { createOrg, createUser, createIncident, generateToken } from '../../test/factories';

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

let app: Express;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

describe('Incident severity — assess + override + history', () => {
  it('assesses, appends on reassess, and records overrides with reasons', async () => {
    const org = await createOrg();
    const mgr = await createUser({ email: `sev-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, title: 'Severity case' });

    const first = await request(app)
      .post('/incident-severity/assess')
      .set('Authorization', `Bearer ${token}`)
      .send({ incident_id: incident.id, answers: { harm_level: 'severe', category: 'falls', urgency: 'today' } });
    expect(first.status).toBe(201);
    expect(first.body.level).toBe('high');
    expect(Array.isArray(first.body.explanation)).toBe(true);

    const second = await request(app)
      .post('/incident-severity/assess')
      .set('Authorization', `Bearer ${token}`)
      .send({ incident_id: incident.id, answers: { harm_level: 'severe', category: 'falls', urgency: 'today', safeguarding_concern: true } });
    expect(second.status).toBe(201);
    expect(second.body.assessment.supersedes_id).toBe(first.body.assessment.id);

    const over = await request(app)
      .post('/incident-severity/override')
      .set('Authorization', `Bearer ${token}`)
      .send({ assessment_id: second.body.assessment.id, level: 'critical', reason: 'Clinician review: safeguarding + severe harm' });
    expect(over.status).toBe(201);
    expect(over.body.level).toBe('critical');
    expect(over.body.override_reason).toContain('Clinician');

    const history = await request(app).get(`/incident-severity/${incident.id}/history`).set('Authorization', `Bearer ${token}`);
    expect(history.status).toBe(200);
    expect(history.body.length).toBe(3);
  });

  it('refuses overrides without reason or role', async () => {
    const org = await createOrg();
    const mgr = await createUser({ email: `sev2-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
    const worker = await createUser({ email: `sevw-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id });
    const incident = await createIncident({ organizationId: org.id, title: 'Override gate' });
    const assessed = await request(app)
      .post('/incident-severity/assess')
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
      .send({ incident_id: incident.id, answers: { harm_level: 'minor', category: 'falls' } });

    const noReason = await request(app)
      .post('/incident-severity/override')
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
      .send({ assessment_id: assessed.body.assessment.id, level: 'high' });
    expect(noReason.status).toBe(400);

    const workerTry = await request(app)
      .post('/incident-severity/override')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ assessment_id: assessed.body.assessment.id, level: 'high', reason: 'I think so' });
    expect(workerTry.status).toBe(403);
  });
});
