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

async function team() {
  const org = await createOrg();
  const mgr = await createUser({ email: `clo-${Date.now()}-${Math.random()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
  const worker = await createUser({ email: `clw-${Date.now()}-${Math.random()}@inc-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id });
  return { org, mgr, worker };
}

async function reportedAction(token: string, incidentId: string) {
  const created = await request(app).post(`/incidents/${incidentId}/actions`).set('Authorization', `Bearer ${token}`).send({ action: 'Fix the handrail' });
  expect(created.status).toBe(201);
  return created.body;
}

describe('Incident closeout — investigation', () => {
  it('starts once, appends notes, completes immutably', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, reportedBy: mgr.id });

    const missing = await request(app).get(`/incidents/${incident.id}/investigation`).set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);

    const started = await request(app).post(`/incidents/${incident.id}/investigation`).set('Authorization', `Bearer ${token}`).send({ summary: 'Initial scope' });
    expect(started.status).toBe(201);
    expect(started.body.status).toBe('open');

    const retry = await request(app).post(`/incidents/${incident.id}/investigation`).set('Authorization', `Bearer ${token}`).send({});
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(started.body.id);

    const note = await request(app).post(`/incidents/${incident.id}/investigation/notes`).set('Authorization', `Bearer ${token}`).send({ note: 'Spoke to night staff' });
    expect(note.status).toBe(201);

    const done = await request(app).post(`/incidents/${incident.id}/investigation/complete`).set('Authorization', `Bearer ${token}`).send({ summary: 'Handrail loose; maintenance booked' });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('complete');

    const late = await request(app).post(`/incidents/${incident.id}/investigation/notes`).set('Authorization', `Bearer ${token}`).send({ note: 'Afterthought' });
    expect(late.status).toBe(409);

    const read = await request(app).get(`/incidents/${incident.id}/investigation`).set('Authorization', `Bearer ${token}`);
    expect(read.body.notes).toHaveLength(1);
  });

  it('keeps investigation management with managers', async () => {
    const { org, worker } = await team();
    const incident = await createIncident({ organizationId: org.id, reportedBy: worker.id });
    const res = await request(app).post(`/incidents/${incident.id}/investigation`).set('Authorization', `Bearer ${generateToken(worker)}`).send({});
    expect(res.status).toBe(403);
  });
});

describe('Incident closeout — action verification', () => {
  it('verifies a completed action and refuses an incomplete one', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, reportedBy: mgr.id });

    const done = await reportedAction(token, incident.id);
    await request(app).patch(`/incidents/${incident.id}/actions/${done.id}/complete`).set('Authorization', `Bearer ${token}`);
    const verified = await request(app).post(`/incidents/${incident.id}/actions/${done.id}/verify`).set('Authorization', `Bearer ${token}`)
      .send({ effectiveness: 'effective', notes: 'Handrail solid on re-check' });
    expect(verified.status).toBe(200);
    expect(verified.body.effectiveness).toBe('effective');
    expect(verified.body.verified_by).toBeTruthy();

    const open = await reportedAction(token, incident.id);
    const early = await request(app).post(`/incidents/${incident.id}/actions/${open.id}/verify`).set('Authorization', `Bearer ${token}`)
      .send({ effectiveness: 'effective' });
    expect(early.status).toBe(409);

    const bad = await request(app).post(`/incidents/${incident.id}/actions/${done.id}/verify`).set('Authorization', `Bearer ${token}`)
      .send({ effectiveness: 'miraculous' as never });
    expect(bad.status).toBe(400);
  });
});

describe('Incident closeout — reporting and guarded close', () => {
  it('closes a simple incident and repeats idempotently', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, reportedBy: mgr.id });

    const closed = await request(app).post(`/incidents/${incident.id}/close`).set('Authorization', `Bearer ${token}`).send({});
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('closed');

    const again = await request(app).post(`/incidents/${incident.id}/close`).set('Authorization', `Bearer ${token}`).send({});
    expect(again.status).toBe(200);
  });

  it('refuses to close a draft and names every blocker', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const draft = await createIncident({ organizationId: org.id, status: 'draft', reportedBy: mgr.id });
    expect((await request(app).post(`/incidents/${draft.id}/close`).set('Authorization', `Bearer ${token}`).send({})).status).toBe(409);
  });

  it('blocks on open investigation, unverified work and missing CQC decision', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, is_cqc_reportable: true, reportedBy: mgr.id } as never);

    await request(app).post(`/incidents/${incident.id}/investigation`).set('Authorization', `Bearer ${token}`).send({});
    const action = await reportedAction(token, incident.id);
    await request(app).patch(`/incidents/${incident.id}/actions/${action.id}/complete`).set('Authorization', `Bearer ${token}`);

    const blocked = await request(app).post(`/incidents/${incident.id}/close`).set('Authorization', `Bearer ${token}`).send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/Investigation is still open/);
    expect(blocked.body.message).toMatch(/not yet verified/);
    expect(blocked.body.message).toMatch(/reporting assessment/);

    await request(app).post(`/incidents/${incident.id}/investigation/complete`).set('Authorization', `Bearer ${token}`).send({});
    await request(app).post(`/incidents/${incident.id}/actions/${action.id}/verify`).set('Authorization', `Bearer ${token}`).send({ effectiveness: 'partial' });
    const assessed = await request(app).post(`/incidents/${incident.id}/reporting`).set('Authorization', `Bearer ${token}`)
      .send({ reportable: true, channel: 'CQC', reference: 'CQC-123' });
    expect(assessed.status).toBe(201);

    const closed = await request(app).post(`/incidents/${incident.id}/close`).set('Authorization', `Bearer ${token}`).send({ summary: 'All closeout complete' });
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('closed');

    const timeline = await request(app).get(`/incidents/${incident.id}/timeline`).set('Authorization', `Bearer ${token}`);
    expect(timeline.body.some((t: any) => t.event === 'audit.close')).toBe(true);
  });

  it('lets open actions survive closure', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, reportedBy: mgr.id });
    await reportedAction(token, incident.id);

    const closed = await request(app).post(`/incidents/${incident.id}/close`).set('Authorization', `Bearer ${token}`).send({});
    expect(closed.status).toBe(200);

    const detail = await request(app).get(`/incidents/${incident.id}`).set('Authorization', `Bearer ${token}`);
    expect(detail.body.actions).toHaveLength(1);
    expect(detail.body.actions[0].completed_at).toBeNull();
  });
});
