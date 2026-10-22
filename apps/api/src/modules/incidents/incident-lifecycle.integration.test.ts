import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../test/helpers';
import { createOrg, createUser, createIncident, createIncidentCategory, generateToken } from '../../test/factories';

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

let app: Express;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

async function team() {
  const org = await createOrg();
  const mgr = await createUser({ email: `lcm-${Date.now()}-${Math.random()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
  const worker = await createUser({ email: `lcw-${Date.now()}-${Math.random()}@inc-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id });
  return { org, mgr, worker };
}

describe('Incident lifecycle — submit', () => {
  it('moves a draft to submitted and repeats idempotently', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, status: 'draft', reportedBy: mgr.id });

    const first = await request(app).post(`/incidents/${incident.id}/submit`).set('Authorization', `Bearer ${token}`).send({});
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('submitted');

    const retry = await request(app).post(`/incidents/${incident.id}/submit`).set('Authorization', `Bearer ${token}`).send({});
    expect(retry.status).toBe(200);
    expect(retry.body.status).toBe('submitted');
  });

  it('refuses to submit an incident already under investigation', async () => {
    const { org, mgr } = await team();
    const incident = await createIncident({ organizationId: org.id, status: 'investigating', reportedBy: mgr.id });

    const res = await request(app).post(`/incidents/${incident.id}/submit`).set('Authorization', `Bearer ${generateToken(mgr)}`).send({});
    expect(res.status).toBe(409);
  });

  it('lets a reporter submit their own draft but not triage it', async () => {
    const { org, worker } = await team();
    const incident = await createIncident({ organizationId: org.id, status: 'draft', reportedBy: worker.id });

    const res = await request(app).post(`/incidents/${incident.id}/submit`).set('Authorization', `Bearer ${generateToken(worker)}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('submitted');
  });
});

describe('Incident lifecycle — reopen', () => {
  it('reopens a closed incident with a recorded reason', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, status: 'closed', reportedBy: mgr.id });

    const res = await request(app).post(`/incidents/${incident.id}/reopen`).set('Authorization', `Bearer ${token}`).send({ reason: 'Family provided new information' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('reopened');

    const timeline = await request(app).get(`/incidents/${incident.id}/timeline`).set('Authorization', `Bearer ${token}`);
    expect(timeline.body.some((t: any) => t.event === 'audit.reopen')).toBe(true);
  });

  it('requires a reason and a closable state', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const closed = await createIncident({ organizationId: org.id, status: 'resolved', reportedBy: mgr.id });
    const open = await createIncident({ organizationId: org.id, status: 'investigating', reportedBy: mgr.id });

    const noReason = await request(app).post(`/incidents/${closed.id}/reopen`).set('Authorization', `Bearer ${token}`).send({});
    expect(noReason.status).toBe(400);
    const badState = await request(app).post(`/incidents/${open.id}/reopen`).set('Authorization', `Bearer ${token}`).send({ reason: 'x' });
    expect(badState.status).toBe(409);
  });

  it('keeps reopening a manager decision, not a reporter one', async () => {
    const { org, worker } = await team();
    const incident = await createIncident({ organizationId: org.id, status: 'closed', reportedBy: worker.id });

    const res = await request(app).post(`/incidents/${incident.id}/reopen`).set('Authorization', `Bearer ${generateToken(worker)}`).send({ reason: 'I disagree' });
    expect(res.status).toBe(403);
  });
});

describe('Incident lifecycle — duplicates and links', () => {
  it('surfaces same-category reports from the same week', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const cat = await createIncidentCategory({ organizationId: org.id });
    const first = await createIncident({ organizationId: org.id, categoryId: cat.id, title: 'Fall in lounge', reportedBy: mgr.id });
    const twin = await createIncident({ organizationId: org.id, categoryId: cat.id, title: 'Fall in lounge again', reportedBy: mgr.id });
    const other = await createIncident({ organizationId: org.id, title: 'Medication error', reportedBy: mgr.id });

    const res = await request(app).get(`/incidents/${first.id}/duplicates`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((r: any) => r.id);
    expect(ids).toContain(twin.id);
    expect(ids).not.toContain(first.id);
    expect(ids).not.toContain(other.id);
  });

  it('links, lists and unlinks a duplicate, once only', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const a = await createIncident({ organizationId: org.id, reportedBy: mgr.id });
    const b = await createIncident({ organizationId: org.id, reportedBy: mgr.id });

    const created = await request(app).post(`/incidents/${a.id}/links`).set('Authorization', `Bearer ${token}`)
      .send({ linked_incident_id: b.id, link_type: 'duplicate', reason: 'Same fall, reported twice' });
    expect(created.status).toBe(201);

    const again = await request(app).post(`/incidents/${a.id}/links`).set('Authorization', `Bearer ${token}`)
      .send({ linked_incident_id: b.id, link_type: 'duplicate' });
    expect(again.status).toBe(409);

    const self = await request(app).post(`/incidents/${a.id}/links`).set('Authorization', `Bearer ${token}`)
      .send({ linked_incident_id: a.id, link_type: 'related' });
    expect(self.status).toBe(400);

    const listed = await request(app).get(`/incidents/${a.id}/links`).set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const removed = await request(app).delete(`/incidents/${a.id}/links/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(204);
  });

  it('refuses links across organisations', async () => {
    const first = await team();
    const second = await team();
    const mine = await createIncident({ organizationId: first.org.id, reportedBy: first.mgr.id });
    const theirs = await createIncident({ organizationId: second.org.id, reportedBy: second.mgr.id });
    // Naming an incident from another org resolves to "not found",
    // never to the other org's record.
    const res = await request(app).post(`/incidents/${mine.id}/links`)
      .set('Authorization', `Bearer ${generateToken(first.mgr)}`)
      .send({ linked_incident_id: theirs.id, link_type: 'related' });
    expect(res.status).toBe(404);
  });
});

describe('Incident lifecycle — follow-up reports', () => {
  it('records lineage when a new report continues a closed incident', async () => {
    const { org, mgr } = await team();
    const token = generateToken(mgr);
    const cat = await createIncidentCategory({ organizationId: org.id });
    const closed = await createIncident({ organizationId: org.id, status: 'closed', reportedBy: mgr.id });

    const res = await request(app).post('/incidents').set('Authorization', `Bearer ${token}`).send({
      title: 'Follow-up: same fall, new bruising', category_id: cat.id, reopens_incident_id: closed.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.reopened_of).toBe(closed.id);
  });
});
