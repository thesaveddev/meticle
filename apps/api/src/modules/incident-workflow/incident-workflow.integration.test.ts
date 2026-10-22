import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../test/helpers';
import { createOrg, createUser, createIncident, generateToken } from '../../test/factories';
import { migrateQuery as query } from '../../shared/database';

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

let app: Express;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

describe('Incident workflow — start once, ack, escalate', () => {
  it('starts one workflow per incident with critical routing, retries duplicate-free', async () => {
    const org = await createOrg();
    const mgr = await createUser({ email: `wf-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, title: 'Workflow case' });

    const first = await request(app)
      .post('/incident-workflow/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ incident_id: incident.id, severity_level: 'critical', idempotency_key: `k-${incident.id}` });
    expect(first.status).toBe(201);
    expect(first.body.duplicate).toBe(false);
    expect(first.body.tasks.length).toBeGreaterThanOrEqual(4);
    expect(first.body.tasks[0].due_at).toBeTruthy();

    const retry = await request(app)
      .post('/incident-workflow/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ incident_id: incident.id, severity_level: 'critical', idempotency_key: `k-${incident.id}` });
    expect(retry.status).toBe(200);
    expect(retry.body.duplicate).toBe(true);
    expect(retry.body.workflow.id).toBe(first.body.workflow.id);
  });

  it('acks and completes with visible, recoverable transitions', async () => {
    const org = await createOrg();
    const mgr = await createUser({ email: `wf2-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, title: 'Ack case' });
    const started = await request(app).post('/incident-workflow/start').set('Authorization', `Bearer ${token}`).send({ incident_id: incident.id, severity_level: 'high' });
    const taskId = started.body.tasks[0].id as string;

    const ack = await request(app).post(`/incident-workflow/tasks/${taskId}/ack`).set('Authorization', `Bearer ${token}`).send({});
    expect(ack.status).toBe(200);
    expect(ack.body.status).toBe('acknowledged');

    const done = await request(app).post(`/incident-workflow/tasks/${taskId}/complete`).set('Authorization', `Bearer ${token}`).send({});
    expect(done.body.status).toBe('completed');

    const view = await request(app).get(`/incident-workflow/${incident.id}`).set('Authorization', `Bearer ${token}`);
    expect(view.status).toBe(200);
    expect(view.body.events.length).toBeGreaterThanOrEqual(2);
  });

  it('escalates unacked overdue work to the fallback owner', async () => {
    const org = await createOrg();
    const mgr = await createUser({ email: `wf3-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id });
    const token = generateToken(mgr);
    const incident = await createIncident({ organizationId: org.id, title: 'Overdue case' });
    const started = await request(app).post('/incident-workflow/start').set('Authorization', `Bearer ${token}`).send({ incident_id: incident.id, severity_level: 'critical' });
    const ackTask = started.body.tasks.find((t: { kind: string }) => t.kind === 'acknowledge') as { id: string };
    // Force it overdue: the sweep reads due_at, not wall-clock fixtures.
    await query(`UPDATE incident_workflow_tasks SET due_at = CURRENT_TIMESTAMP - INTERVAL '2 hours' WHERE id = $1`, [ackTask.id]);

    const sweep = await request(app).post('/incident-workflow/sweep').set('Authorization', `Bearer ${token}`).send({});
    expect(sweep.status).toBe(200);
    expect(sweep.body.escalated).toContain(ackTask.id);

    const view = await request(app).get(`/incident-workflow/${incident.id}`).set('Authorization', `Bearer ${token}`);
    const task = view.body.tasks.find((t: { id: string }) => t.id === ackTask.id) as { status: string };
    expect(task.status).toBe('escalated');
  });
});
