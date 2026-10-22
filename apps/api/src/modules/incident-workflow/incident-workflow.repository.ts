import { query } from '../../shared/database';
import { planForSeverity, taskKey } from './incident-workflow.engine';

export class IncidentWorkflowRepository {
  /** Idempotent start: the same incident (or the same key) returns one workflow. */
  static async start(orgId: string, userId: string, incidentId: string, severityLevel: string, idempotencyKey?: string | null) {
    const existing = (await query(`SELECT * FROM incident_workflows WHERE incident_id = $1 AND organization_id = $2`, [incidentId, orgId])).rows[0];
    if (existing) {
      const tasks = (await query(`SELECT * FROM incident_workflow_tasks WHERE workflow_id = $1 ORDER BY due_at ASC`, [existing.id])).rows;
      return { workflow: existing, tasks, duplicate: true };
    }
    const workflow = (
      await query(
        `INSERT INTO incident_workflows (organization_id, incident_id, definition_version, state, workstreams, idempotency_key)
         VALUES ($1,$2,1,'open','[]'::jsonb,$3) RETURNING *`,
        [orgId, incidentId, idempotencyKey ?? `incident:${incidentId}`],
      )
    ).rows[0];
    const plans = planForSeverity(severityLevel);
    const tasks = [];
    for (const p of plans) {
      const row = (
        await query(
          `INSERT INTO incident_workflow_tasks (organization_id, workflow_id, kind, title, owner_role, status, due_at, idempotency_key, fallback_to)
           VALUES ($1,$2,$3,$4,$5,'pending', CURRENT_TIMESTAMP + ($6 || ' hours')::interval, $7, $8)
           ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
          [orgId, workflow.id, p.kind, p.title, p.owner_role, String(p.due_hours), taskKey(incidentId, p.kind), p.fallback_to],
        )
      ).rows[0];
      if (row) tasks.push(row);
    }
    const all = (await query(`SELECT * FROM incident_workflow_tasks WHERE workflow_id = $1 ORDER BY due_at ASC`, [workflow.id])).rows;
    await query(
      `INSERT INTO incident_workflow_events (organization_id, workflow_id, event, to_state, actor_id) VALUES ($1,$2,'started','open',$3)`,
      [orgId, workflow.id, userId],
    );
    return { workflow, tasks: all, duplicate: false };
  }

  static async getByIncident(orgId: string, incidentId: string) {
    const workflow = (await query(`SELECT * FROM incident_workflows WHERE incident_id = $1 AND organization_id = $2`, [incidentId, orgId])).rows[0];
    if (!workflow) return null;
    const tasks = (await query(`SELECT * FROM incident_workflow_tasks WHERE workflow_id = $1 ORDER BY due_at ASC`, [workflow.id])).rows;
    const events = (await query(`SELECT * FROM incident_workflow_events WHERE workflow_id = $1 ORDER BY created_at ASC`, [workflow.id])).rows;
    return { workflow, tasks, events };
  }

  static async transition(orgId: string, userId: string, taskId: string, action: 'ack' | 'complete' | 'extend', reason?: string) {
    const task = (await query(`SELECT * FROM incident_workflow_tasks WHERE id = $1 AND organization_id = $2`, [taskId, orgId])).rows[0];
    if (!task) return null;
    let status = task.status as string;
    if (action === 'ack' && task.status === 'pending') status = 'acknowledged';
    else if (action === 'ack' && task.status === 'overdue') status = 'acknowledged';
    else if (action === 'complete' && (task.status === 'acknowledged' || task.status === 'pending' || task.status === 'overdue')) status = 'completed';
    else if (action !== 'extend') return { task, noop: true };
    if (action === 'extend') {
      await query(`UPDATE incident_workflow_tasks SET due_at = due_at + INTERVAL '24 hours', attempts = attempts + 1 WHERE id = $1`, [taskId]);
    } else if (status !== task.status) {
      const col = status === 'acknowledged' ? 'ack_at = CURRENT_TIMESTAMP,' : status === 'completed' ? 'completed_at = CURRENT_TIMESTAMP,' : '';
      await query(`UPDATE incident_workflow_tasks SET status = $1, ${col} attempts = attempts + 1 WHERE id = $2`, [status, taskId]);
    }
    await query(
      `INSERT INTO incident_workflow_events (organization_id, workflow_id, task_id, event, from_state, to_state, actor_id, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [orgId, task.workflow_id, taskId, `task.${action}`, task.status, status, userId, reason ?? null],
    );
    const updated = (await query(`SELECT * FROM incident_workflow_tasks WHERE id = $1`, [taskId])).rows[0];
    return { task: updated, noop: false };
  }

  /** Overdue sweep: unacked tasks past due → escalated to fallback, ledgered. */
  static async sweepOverdue(orgId: string) {
    const overdue = (
      await query(
        `SELECT * FROM incident_workflow_tasks
         WHERE organization_id = $1 AND status IN ('pending','acknowledged') AND due_at < CURRENT_TIMESTAMP AND fallback_to IS NOT NULL`,
        [orgId],
      )
    ).rows;
    const escalated = [];
    for (const t of overdue) {
      await query(`UPDATE incident_workflow_tasks SET status = 'escalated', attempts = attempts + 1 WHERE id = $1`, [t.id]);
      await query(
        `INSERT INTO incident_escalations (organization_id, task_id, from_owner, to_owner, reason)
         VALUES ($1,$2,$3,$4,'Unacknowledged past due — fell back per plan')`,
        [orgId, t.id, t.owner_role, t.fallback_to],
      );
      await query(
        `INSERT INTO incident_workflow_events (organization_id, workflow_id, task_id, event, from_state, to_state, reason)
         VALUES ($1,$2,$3,'task.escalated',$4,'escalated','Overdue with no ack')`,
        [orgId, t.workflow_id, t.id, t.status],
      );
      escalated.push(t.id);
    }
    return escalated;
  }
}
