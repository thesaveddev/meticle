import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../test/helpers';
import { createOrg, createUser, createIncident, createIncidentCategory, generateToken } from '../../test/factories';
import { migrateQuery } from '../../shared/database';

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

let app: Express;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

async function team() {
  const org = await createOrg();
  const mgr = await createUser({ email: `sug-${Date.now()}-${Math.random()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
  const worker = await createUser({ email: `suw-${Date.now()}-${Math.random()}@inc-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id });
  return { org, mgr, worker };
}

describe('Incident suggested actions — propose from the incident facts', () => {
  it('proposes rule drafts for a falls report and converges on re-run', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const cat = await createIncidentCategory({ organizationId: org.id, name: 'Falls' });
    const incident = await createIncident({ organizationId: org.id, categoryId: cat.id, reportedBy: mgr.id });

    const first = await request(app).post(`/incidents/${incident.id}/actions/suggest`).set('Authorization', `Bearer ${token}`).send({});
    expect(first.status).toBe(201);
    expect(first.body.length).toBeGreaterThanOrEqual(3);
    expect(first.body.every((s: any) => s.status === 'proposed')).toBe(true);
    expect(first.body.some((s: any) => s.rule_key === 'falls_review')).toBe(true);

    const second = await request(app).post(`/incidents/${incident.id}/actions/suggest`).set('Authorization', `Bearer ${token}`).send({});
    expect(second.status).toBe(201);
    expect(second.body).toHaveLength(first.body.length);

    const listed = await request(app).get(`/incidents/${incident.id}/actions/suggestions`).set('Authorization', `Bearer ${token}`);
    expect(listed.body).toHaveLength(first.body.length);
  });

  it('folds AI triage recommendations in with their provenance', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, reportedBy: mgr.id });
    await migrateQuery(`UPDATE incidents SET ai_triage = $1 WHERE id = $2`, [
      JSON.stringify({ actions_recommended: ['Reassess the moving and handling plan'], generated_by_ai: true }),
      incident.id,
    ]);

    const res = await request(app).post(`/incidents/${incident.id}/actions/suggest`).set('Authorization', `Bearer ${token}`).send({});
    const ai = res.body.filter((s: any) => s.source === 'ai');
    expect(ai).toHaveLength(1);
    expect(ai[0].action).toBe('Reassess the moving and handling plan');
  });

  it('keeps proposing and deciding a manager job', async () => {
    const { org, worker } = await team();
    const incident = await createIncident({ organizationId: org.id, reportedBy: worker.id });
    const token = generateToken(worker);

    expect((await request(app).post(`/incidents/${incident.id}/actions/suggest`).set('Authorization', `Bearer ${token}`).send({})).status).toBe(403);
    // The reporter can still read what was proposed for their own report.
    expect((await request(app).get(`/incidents/${incident.id}/actions/suggestions`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });
});

describe('Incident suggested actions — approve and reject', () => {
  it('approving creates the real action; deciding twice is refused', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, reportedBy: mgr.id });
    const suggested = await request(app).post(`/incidents/${incident.id}/actions/suggest`).set('Authorization', `Bearer ${token}`).send({});
    const target = suggested.body[0];

    const approved = await request(app).post(`/incidents/${incident.id}/actions/suggestions/${target.id}/decide`).set('Authorization', `Bearer ${token}`)
      .send({ decision: 'approved' });
    expect(approved.status).toBe(200);
    expect(approved.body.suggestion.status).toBe('approved');
    expect(approved.body.action.action).toBe(target.action);

    const detail = await request(app).get(`/incidents/${incident.id}`).set('Authorization', `Bearer ${token}`);
    expect(detail.body.actions.some((a: any) => a.action === target.action)).toBe(true);

    const again = await request(app).post(`/incidents/${incident.id}/actions/suggestions/${target.id}/decide`).set('Authorization', `Bearer ${token}`)
      .send({ decision: 'rejected', reason: 'changed my mind' });
    expect(again.status).toBe(409);
  });

  it('rejecting records the reason and creates nothing', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, reportedBy: mgr.id });
    const suggested = await request(app).post(`/incidents/${incident.id}/actions/suggest`).set('Authorization', `Bearer ${token}`).send({});
    const target = suggested.body[0];

    const rejected = await request(app).post(`/incidents/${incident.id}/actions/suggestions/${target.id}/decide`).set('Authorization', `Bearer ${token}`)
      .send({ decision: 'rejected', reason: 'Not applicable — no equipment involved' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.suggestion.status).toBe('rejected');
    expect(rejected.body.action).toBeNull();

    const detail = await request(app).get(`/incidents/${incident.id}`).set('Authorization', `Bearer ${token}`);
    expect(detail.body.actions).toHaveLength(0);
  });

  it('refuses unknown suggestions and bad decisions', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, reportedBy: mgr.id });

    expect((await request(app).post(`/incidents/${incident.id}/actions/suggestions/00000000-0000-0000-0000-000000000000/decide`)
      .set('Authorization', `Bearer ${token}`).send({ decision: 'approved' })).status).toBe(404);
    const suggested = await request(app).post(`/incidents/${incident.id}/actions/suggest`).set('Authorization', `Bearer ${token}`).send({});
    expect((await request(app).post(`/incidents/${incident.id}/actions/suggestions/${suggested.body[0].id}/decide`)
      .set('Authorization', `Bearer ${token}`).send({ decision: 'maybe' as never })).status).toBe(400);
  });
});

describe('Incident severity events — catalogue name', () => {
  it('publishes incident.severity_changed when an assessment lands', async () => {
    const { org, mgr } = await team();
    const incident = await createIncident({ organizationId: org.id, reportedBy: mgr.id });

    const res = await request(app).post('/incident-severity/assess').set('Authorization', `Bearer ${generateToken(mgr)}`)
      .send({ incident_id: incident.id, answers: { harm_level: 'severe', category: 'falls', urgency: 'today' } });
    expect(res.status).toBe(201);

    const rows = await migrateQuery(
      `SELECT event_name FROM domain_events WHERE organization_id = $1 AND aggregate_id = $2 AND event_name = 'incident.severity_changed'`,
      [org.id, incident.id]
    );
    expect(rows.rows.length).toBeGreaterThanOrEqual(1);
  });
});
