import { z } from 'zod';
import { query } from '../../shared/database';
import { decryptRowsForOrg } from '../../shared/utils/encrypted-columns';
import { ReportData, ReportTableColumn } from './reporting.types';

/**
 * Custom (ad-hoc) report engine for the report builder.
 *
 * Canned reports in REPORT_REGISTRY fix their dataset, columns and
 * aggregations; the builder lets a manager combine them freely: pick one of
 * the whitelisted datasets below, choose columns, add filter conditions,
 * optionally group with aggregations, sort and limit. Every identifier that
 * reaches SQL — dataset, column, operator, function, direction — is resolved
 * against this whitelist; user input only ever becomes a bound parameter
 * ($2, $3, …), never SQL text. A stored configuration is re-validated on
 * every run, so a hand-edited custom_reports row cannot smuggle anything
 * through either.
 */

// ─── Dataset whitelist ─────────────────────────────────────

export interface CustomDatasetColumn {
  /** Stable identifier used in columns / filters / group / sort. */
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  /** Fully-qualified select expression, e.g. 'sp.first_name'. */
  sql: string;
  /** Usable inside COUNT/SUM/AVG/MIN/MAX (numeric and date columns). */
  aggregatable: boolean;
}

export interface CustomDataset {
  id: string;
  label: string;
  description: string;
  /** FROM + JOIN clause. Static text — never interpolated with input. */
  from: string;
  /** Qualified column the tenant scope binds to, e.g. 'u.organization_id'. */
  orgColumn: string;
  /** Passed through decryptRowsForOrg when set (encrypted PII dataset). */
  decryptTable?: string;
  columns: CustomDatasetColumn[];
}

const STAFF_LOCATION_JOIN = 'LEFT JOIN locations l ON sp.location_id = l.id LEFT JOIN departments d ON sp.department_id = d.id';

export const CUSTOM_DATASETS: CustomDataset[] = [
  {
    id: 'staff',
    label: 'Staff',
    description: 'One row per staff profile with account, role and posting.',
    from: `staff_profiles sp JOIN users u ON sp.user_id = u.id ${STAFF_LOCATION_JOIN}`,
    orgColumn: 'u.organization_id',
    columns: [
      { key: 'first_name', label: 'First name', type: 'text', sql: 'sp.first_name', aggregatable: false },
      { key: 'last_name', label: 'Last name', type: 'text', sql: 'sp.last_name', aggregatable: false },
      { key: 'email', label: 'Email', type: 'text', sql: 'u.email', aggregatable: false },
      { key: 'role', label: 'Role', type: 'text', sql: 'u.role', aggregatable: false },
      { key: 'status', label: 'Status', type: 'text', sql: 'u.status', aggregatable: false },
      { key: 'employment_status', label: 'Employment status', type: 'text', sql: 'sp.employment_status', aggregatable: false },
      { key: 'location', label: 'Location', type: 'text', sql: 'l.name', aggregatable: false },
      { key: 'department', label: 'Department', type: 'text', sql: 'd.name', aggregatable: false },
      { key: 'joined', label: 'Joined', type: 'date', sql: 'u.created_at', aggregatable: true },
    ],
  },
  {
    id: 'people',
    label: 'People supported',
    description: 'One row per person with status, needs and location.',
    from: 'people p LEFT JOIN locations l ON p.location_id = l.id',
    orgColumn: 'p.organization_id',
    decryptTable: 'people',
    columns: [
      { key: 'first_name', label: 'First name', type: 'text', sql: 'p.first_name', aggregatable: false },
      { key: 'last_name', label: 'Last name', type: 'text', sql: 'p.last_name', aggregatable: false },
      { key: 'status', label: 'Status', type: 'text', sql: 'p.status', aggregatable: false },
      { key: 'support_level', label: 'Support level', type: 'text', sql: 'p.support_level', aggregatable: false },
      { key: 'room_number', label: 'Room', type: 'text', sql: 'p.room_number', aggregatable: false },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date', sql: 'p.date_of_birth', aggregatable: false },
      { key: 'location', label: 'Location', type: 'text', sql: 'l.name', aggregatable: false },
      { key: 'min_staff_required', label: 'Min staff required', type: 'number', sql: 'p.min_staff_required', aggregatable: true },
      { key: 'created', label: 'Created', type: 'date', sql: 'p.created_at', aggregatable: true },
    ],
  },
  {
    id: 'incidents',
    label: 'Incidents',
    description: 'One row per incident with severity, category and status.',
    from: 'incidents i LEFT JOIN incident_categories ic ON i.category_id = ic.id',
    orgColumn: 'i.organization_id',
    columns: [
      { key: 'title', label: 'Title', type: 'text', sql: 'i.title', aggregatable: false },
      { key: 'severity', label: 'Severity', type: 'text', sql: 'i.severity', aggregatable: false },
      { key: 'status', label: 'Status', type: 'text', sql: 'i.status', aggregatable: false },
      { key: 'category', label: 'Category', type: 'text', sql: 'ic.name', aggregatable: false },
      { key: 'location', label: 'Location', type: 'text', sql: 'i.location', aggregatable: false },
      { key: 'incident_date', label: 'Incident date', type: 'date', sql: 'i.incident_date', aggregatable: true },
      { key: 'is_near_miss', label: 'Near miss', type: 'boolean', sql: 'i.is_near_miss', aggregatable: false },
      { key: 'is_cqc_reportable', label: 'CQC reportable', type: 'boolean', sql: 'i.is_cqc_reportable', aggregatable: false },
      { key: 'created', label: 'Reported', type: 'date', sql: 'i.created_at', aggregatable: true },
    ],
  },
  {
    id: 'leave',
    label: 'Leave requests',
    description: 'One row per leave request with type, dates and decision.',
    from: `leave_requests lr JOIN staff_profiles sp ON lr.staff_id = sp.id JOIN users u ON sp.user_id = u.id LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id ${STAFF_LOCATION_JOIN}`,
    orgColumn: 'u.organization_id',
    columns: [
      { key: 'first_name', label: 'First name', type: 'text', sql: 'sp.first_name', aggregatable: false },
      { key: 'last_name', label: 'Last name', type: 'text', sql: 'sp.last_name', aggregatable: false },
      { key: 'leave_type', label: 'Leave type', type: 'text', sql: 'lt.name', aggregatable: false },
      { key: 'status', label: 'Status', type: 'text', sql: 'lr.status', aggregatable: false },
      { key: 'start_date', label: 'Start', type: 'date', sql: 'lr.start_date', aggregatable: true },
      { key: 'end_date', label: 'End', type: 'date', sql: 'lr.end_date', aggregatable: true },
      { key: 'hours_requested', label: 'Hours', type: 'number', sql: 'lr.hours_requested', aggregatable: true },
      { key: 'location', label: 'Location', type: 'text', sql: 'l.name', aggregatable: false },
      { key: 'department', label: 'Department', type: 'text', sql: 'd.name', aggregatable: false },
      { key: 'requested', label: 'Requested', type: 'date', sql: 'lr.created_at', aggregatable: true },
    ],
  },
  {
    id: 'shifts',
    label: 'Shifts',
    description: 'One row per rota shift with location, status and hours.',
    from: 'shifts s JOIN locations l ON s.location_id = l.id LEFT JOIN departments d ON s.department_id = d.id',
    orgColumn: 'l.organization_id',
    columns: [
      { key: 'location', label: 'Location', type: 'text', sql: 'l.name', aggregatable: false },
      { key: 'department', label: 'Department', type: 'text', sql: 'd.name', aggregatable: false },
      { key: 'status', label: 'Status', type: 'text', sql: 's.status', aggregatable: false },
      { key: 'shift_type', label: 'Shift type', type: 'text', sql: 's.shift_type', aggregatable: false },
      { key: 'start_time', label: 'Start', type: 'date', sql: 's.start_time', aggregatable: true },
      { key: 'end_time', label: 'End', type: 'date', sql: 's.end_time', aggregatable: true },
      { key: 'hours', label: 'Hours', type: 'number', sql: 'EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600', aggregatable: true },
      { key: 'created', label: 'Created', type: 'date', sql: 's.created_at', aggregatable: true },
    ],
  },
  {
    id: 'training',
    label: 'Training records',
    description: 'One row per staff training record with module and dates.',
    from: `training_records tr JOIN training_modules tm ON tr.module_id = tm.id JOIN staff_profiles sp ON tr.staff_id = sp.id JOIN users u ON sp.user_id = u.id ${STAFF_LOCATION_JOIN}`,
    orgColumn: 'u.organization_id',
    columns: [
      { key: 'first_name', label: 'First name', type: 'text', sql: 'sp.first_name', aggregatable: false },
      { key: 'last_name', label: 'Last name', type: 'text', sql: 'sp.last_name', aggregatable: false },
      { key: 'module', label: 'Module', type: 'text', sql: 'tm.name', aggregatable: false },
      { key: 'category', label: 'Category', type: 'text', sql: 'tm.category', aggregatable: false },
      { key: 'status', label: 'Status', type: 'text', sql: 'tr.status', aggregatable: false },
      { key: 'completed_at', label: 'Completed', type: 'date', sql: 'tr.completed_at', aggregatable: true },
      { key: 'expires_at', label: 'Expires', type: 'date', sql: 'tr.expires_at', aggregatable: true },
      { key: 'location', label: 'Location', type: 'text', sql: 'l.name', aggregatable: false },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance records',
    description: 'One row per staff compliance record with requirement and dates.',
    from: `compliance_records cr JOIN compliance_config cc ON cr.requirement_id = cc.id JOIN staff_profiles sp ON cr.staff_id = sp.id JOIN users u ON sp.user_id = u.id ${STAFF_LOCATION_JOIN}`,
    orgColumn: 'u.organization_id',
    columns: [
      { key: 'first_name', label: 'First name', type: 'text', sql: 'sp.first_name', aggregatable: false },
      { key: 'last_name', label: 'Last name', type: 'text', sql: 'sp.last_name', aggregatable: false },
      { key: 'requirement', label: 'Requirement', type: 'text', sql: 'cc.name', aggregatable: false },
      { key: 'category', label: 'Category', type: 'text', sql: 'cc.category', aggregatable: false },
      { key: 'status', label: 'Status', type: 'text', sql: 'cr.status', aggregatable: false },
      { key: 'issued_at', label: 'Issued', type: 'date', sql: 'cr.issued_at', aggregatable: true },
      { key: 'expires_at', label: 'Expires', type: 'date', sql: 'cr.expires_at', aggregatable: true },
      { key: 'location', label: 'Location', type: 'text', sql: 'l.name', aggregatable: false },
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'One row per task with status, priority and assignee.',
    from: 'tasks t LEFT JOIN staff_profiles sp ON t.assigned_to = sp.id',
    orgColumn: 't.organization_id',
    columns: [
      { key: 'title', label: 'Title', type: 'text', sql: 't.title', aggregatable: false },
      { key: 'status', label: 'Status', type: 'text', sql: 't.status', aggregatable: false },
      { key: 'priority', label: 'Priority', type: 'text', sql: 't.priority', aggregatable: false },
      { key: 'assignee_first_name', label: 'Assignee first name', type: 'text', sql: 'sp.first_name', aggregatable: false },
      { key: 'assignee_last_name', label: 'Assignee last name', type: 'text', sql: 'sp.last_name', aggregatable: false },
      { key: 'due_date', label: 'Due', type: 'date', sql: 't.due_date', aggregatable: true },
      { key: 'completed_at', label: 'Completed', type: 'date', sql: 't.completed_at', aggregatable: true },
      { key: 'created', label: 'Created', type: 'date', sql: 't.created_at', aggregatable: true },
    ],
  },
];

export function getCustomDataset(id: string): CustomDataset | undefined {
  return CUSTOM_DATASETS.find((d) => d.id === id);
}

// ─── Configuration validation ────────────────────────────

const filterOpSchema = z.enum(['eq', 'ne', 'in', 'like', 'gt', 'gte', 'lt', 'lte', 'is_null', 'is_not_null']);

const filterConditionSchema = z.object({
  field: z.string().min(1).max(64),
  op: filterOpSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]).optional(),
});

const aggregationSchema = z.object({
  func: z.enum(['count', 'sum', 'avg', 'min', 'max']),
  field: z.string().min(1).max(64).optional(),
});

export const customReportConfigSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  dataset: z.string().min(1).max(32),
  columns: z.array(z.string().min(1).max(64)).min(1).max(20),
  filters: z.array(filterConditionSchema).max(20).default([]),
  group_by: z.string().min(1).max(64).nullable().optional(),
  aggregations: z.array(aggregationSchema).max(5).default([]),
  sort_by: z.string().min(1).max(64).nullable().optional(),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
  row_limit: z.number().int().min(1).max(5000).default(500),
  chart_type: z.enum(['table', 'bar', 'pie', 'line']).default('table'),
});

export type CustomReportConfig = z.infer<typeof customReportConfigSchema>;

export interface CustomRunRequest {
  /** Run a saved configuration by id … */
  saved_id?: string;
  /** … or run an ad-hoc configuration inline. */
  config?: CustomReportConfig;
}

/** Output key for an aggregation: count → 'records', else func_field. */
function aggAlias(func: string, field?: string): string {
  return func === 'count' && !field ? 'records' : `${func}_${field}`;
}

// ─── SQL builder ───────────────────────────────────────────

interface BuiltQuery {
  sql: string;
  params: any[];
  /** Output key → { label, type } in SELECT order, for the table + CSV. */
  output: { key: string; label: string; type: ReportTableColumn['type'] }[];
  groupKey: string | null;
}

const OP_SQL: Record<string, (col: string, idx: number) => string> = {
  eq: (c, i) => `${c} = $${i}`,
  ne: (c, i) => `${c} IS DISTINCT FROM $${i}`,
  gt: (c, i) => `${c} > $${i}`,
  gte: (c, i) => `${c} >= $${i}`,
  lt: (c, i) => `${c} < $${i}`,
  lte: (c, i) => `${c} <= $${i}`,
  like: (c, i) => `${c}::text ILIKE $${i}`,
  in: (c, i) => `${c}::text = ANY($${i})`,
  is_null: (c) => `${c} IS NULL`,
  is_not_null: (c) => `${c} IS NOT NULL`,
};

const NO_VALUE_OPS = new Set(['is_null', 'is_not_null']);

function columnByKey(dataset: CustomDataset, key: string) {
  return dataset.columns.find((c) => c.key === key);
}

/**
 * Resolves a validated config against the dataset whitelist and builds the
 * parameterised query. Throws an Error with a plain message for every
 * invalid reference — the controller turns those into 400s.
 */
export function buildCustomQuery(config: CustomReportConfig): BuiltQuery {
  const dataset = getCustomDataset(config.dataset);
  if (!dataset) throw new Error(`Unknown dataset: ${config.dataset}`);

  const grouped = Boolean(config.group_by) || config.aggregations.length > 0;

  const groupCol = config.group_by ? columnByKey(dataset, config.group_by) : undefined;
  if (config.group_by && !groupCol) throw new Error(`Unknown group-by field: ${config.group_by}`);

  const selected = config.columns.map((key) => {
    const col = columnByKey(dataset, key);
    if (!col) throw new Error(`Unknown column: ${key}`);
    return col;
  });

  if (grouped) {
    if (!groupCol) throw new Error('Aggregations need a group-by field.');
    for (const col of selected) {
      if (col.key !== groupCol.key) {
        throw new Error(`Column "${col.key}" must be the group-by field when grouping is on.`);
      }
    }
  } else if (config.aggregations.length > 0) {
    throw new Error('Aggregations need a group-by field.');
  }

  const aggs = config.aggregations.map((a) => {
    if (a.func !== 'count') {
      const col = a.field ? columnByKey(dataset, a.field) : undefined;
      if (!col) throw new Error(`Unknown aggregation field: ${a.field}`);
      if (!col.aggregatable) throw new Error(`Field "${a.field}" cannot be aggregated.`);
      if (col.type === 'boolean') throw new Error(`Field "${a.field}" cannot be aggregated.`);
      return { ...a, col };
    }
    if (a.field) {
      const col = columnByKey(dataset, a.field);
      if (!col) throw new Error(`Unknown aggregation field: ${a.field}`);
    }
    return { ...a, col: undefined };
  });

  // SELECT
  const select: string[] = [];
  const output: BuiltQuery['output'] = [];
  if (!grouped) {
    for (const col of selected) {
      select.push(`${col.sql} AS "${col.key}"`);
      output.push({ key: col.key, label: col.label, type: col.type === 'boolean' ? 'text' : col.type });
    }
  } else {
    select.push(`${groupCol!.sql} AS "${groupCol!.key}"`);
    output.push({ key: groupCol!.key, label: groupCol!.label, type: groupCol!.type === 'boolean' ? 'text' : groupCol!.type });
    if (aggs.length === 0) {
      select.push('COUNT(*)::int AS records');
      output.push({ key: 'records', label: 'Records', type: 'number' });
    } else {
      for (const a of aggs) {
        const alias = aggAlias(a.func, a.field);
        const expr =
          a.func === 'count' && !a.field
            ? 'COUNT(*)::int'
            : a.func === 'count'
              ? `COUNT(${a.col!.sql})::int`
              : `${a.func.toUpperCase()}(${a.col!.sql})`;
        select.push(`${expr} AS "${alias}"`);
        output.push({ key: alias, label: a.field ? `${a.func.toUpperCase()} ${a.col!.label}` : 'Records', type: 'number' });
      }
    }
  }

  // WHERE — tenant scope first, then the builder's conditions.
  const params: any[] = [];
  let idx = 1;
  const where: string[] = [`${dataset.orgColumn} = $${idx}`];
  params.push('__ORG__');
  idx++;

  for (const cond of config.filters) {
    const col = columnByKey(dataset, cond.field);
    if (!col) throw new Error(`Unknown filter field: ${cond.field}`);
    if (NO_VALUE_OPS.has(cond.op)) {
      where.push(OP_SQL[cond.op](col.sql, idx));
      continue;
    }
    if (cond.value === undefined || cond.value === null || cond.value === '') {
      throw new Error(`Filter on "${cond.field}" needs a value.`);
    }
    if (cond.op === 'in') {
      const list = Array.isArray(cond.value) ? cond.value : String(cond.value).split(',').map((s) => s.trim()).filter(Boolean);
      if (!list.length) throw new Error(`Filter on "${cond.field}" needs at least one value.`);
      where.push(OP_SQL.in(col.sql, idx));
      params.push(list.map(String));
      idx++;
      continue;
    }
    if (col.type === 'boolean') {
      const truthy = cond.value === true || cond.value === 1 || String(cond.value).toLowerCase() === 'true';
      if (cond.op !== 'eq' && cond.op !== 'ne') throw new Error(`Field "${cond.field}" only supports equals / not-equals.`);
      where.push(OP_SQL[cond.op](col.sql, idx));
      params.push(truthy);
      idx++;
      continue;
    }
    if (col.type === 'number' && ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(cond.op)) {
      const num = Number(cond.value);
      if (!Number.isFinite(num)) throw new Error(`Filter on "${cond.field}" needs a number.`);
      where.push(OP_SQL[cond.op](col.sql, idx));
      params.push(num);
      idx++;
      continue;
    }
    if (cond.op === 'like') {
      where.push(OP_SQL.like(col.sql, idx));
      params.push(`%${String(cond.value)}%`);
      idx++;
      continue;
    }
    where.push(OP_SQL[cond.op](col.sql, idx));
    params.push(String(cond.value));
    idx++;
  }

  let sql = `SELECT ${select.join(', ')} FROM ${dataset.from} WHERE ${where.join(' AND ')}`;
  if (grouped) sql += ` GROUP BY "${groupCol!.key}"`;

  // ORDER BY — restricted to output keys so no hidden identifier reaches SQL.
  const outputKeys = new Set(output.map((o) => o.key));
  if (config.sort_by) {
    if (!outputKeys.has(config.sort_by)) throw new Error(`Cannot sort by "${config.sort_by}".`);
    sql += ` ORDER BY "${config.sort_by}" ${config.sort_dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`;
  } else if (grouped) {
    sql += ' ORDER BY "records" DESC NULLS LAST';
  }

  sql += ` LIMIT ${Math.min(Math.max(config.row_limit, 1), 5000)}`;

  return { sql, params, output, groupKey: grouped ? groupCol!.key : null };
}

// ─── Execution ─────────────────────────────────────────────

function formatCell(col: { key: string; type: ReportTableColumn['type'] }, val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (col.type === 'date' && val) {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  if (typeof val === 'number' && !Number.isInteger(val)) return Math.round(val * 100) / 100;
  return val;
}

/** Query executor: request paths use `query` (RLS-enforced); the delivery
 * sweep passes `migrateQuery` because it runs outside any request. */
export type DbExecutor = (text: string, params?: any[]) => Promise<any>;

export async function runCustomReport(orgId: string, config: CustomReportConfig, title?: string, db: DbExecutor = query): Promise<ReportData> {
  const dataset = getCustomDataset(config.dataset);
  if (!dataset) throw new Error(`Unknown dataset: ${config.dataset}`);

  const built = buildCustomQuery(config);
  const params = built.params.map((p) => (p === '__ORG__' ? orgId : p));
  const result = await db(built.sql, params);
  let rows = result.rows;
  if (dataset.decryptTable) rows = decryptRowsForOrg(dataset.decryptTable, rows, orgId);

  const columns: ReportTableColumn[] = built.output.map((o) => ({ key: o.key, label: o.label, type: o.type }));
  const tableRows = rows.map((r: Record<string, any>) => {
    const row: Record<string, any> = {};
    for (const o of built.output) row[o.key] = formatCell(o, r[o.key]);
    return row;
  });

  const series = built.groupKey
    ? tableRows.map((r: Record<string, any>) => {
      const numericKey = built.output.find((o) => o.key !== built.groupKey && o.type === 'number')?.key;
      return {
        name: String(r[built.groupKey!] ?? 'Unknown'),
        value: Number(numericKey ? r[numericKey] : 0) || 0,
      };
    })
    : [];

  return {
    report: {
      id: `custom:${config.dataset}`,
      title: title || config.name || dataset.label,
      category: 'custom',
      generatedAt: new Date().toISOString(),
    },
    summary: {
      cards: [
        { label: 'Records', value: tableRows.length, color: '#0F4C81' },
        ...(built.groupKey ? [{ label: 'Groups', value: tableRows.length, color: '#6366F1' }] : []),
      ],
    },
    series,
    table: { columns, rows: tableRows },
  };
}

// ─── Saved configurations ──────────────────────────────────

export interface SavedCustomReport {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  dataset: string;
  columns: string[];
  filters: Array<{ field: string; op: string; value?: any }>;
  group_by: string | null;
  aggregations: Array<{ func: string; field?: string }>;
  sort_by: string | null;
  sort_dir: 'asc' | 'desc';
  row_limit: number;
  chart_type: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const SAVED_SELECT = `id, organization_id, name, description, dataset, columns, filters,
  group_by, aggregations, sort_by, sort_dir, row_limit, chart_type, created_by, created_at, updated_at`;

export async function listSavedReports(orgId: string): Promise<SavedCustomReport[]> {
  const result = await query(
    `SELECT ${SAVED_SELECT} FROM custom_reports WHERE organization_id = $1 ORDER BY updated_at DESC`,
    [orgId],
  );
  return result.rows;
}

export async function getSavedReport(orgId: string, id: string, db: DbExecutor = query): Promise<SavedCustomReport | null> {
  const result = await db(`SELECT ${SAVED_SELECT} FROM custom_reports WHERE organization_id = $1 AND id = $2`, [orgId, id]);
  return result.rows[0] || null;
}

export async function createSavedReport(orgId: string, userId: string, config: CustomReportConfig): Promise<SavedCustomReport> {
  const result = await query(
    `INSERT INTO custom_reports (organization_id, name, description, dataset, columns, filters, group_by, aggregations, sort_by, sort_dir, row_limit, chart_type, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING ${SAVED_SELECT}`,
    [orgId, config.name, config.description || '', config.dataset, JSON.stringify(config.columns), JSON.stringify(config.filters),
      config.group_by || null, JSON.stringify(config.aggregations), config.sort_by || null, config.sort_dir, config.row_limit, config.chart_type, userId],
  );
  return result.rows[0];
}

export async function updateSavedReport(orgId: string, id: string, config: CustomReportConfig): Promise<SavedCustomReport | null> {
  const result = await query(
    `UPDATE custom_reports SET name = $3, description = $4, dataset = $5, columns = $6, filters = $7,
      group_by = $8, aggregations = $9, sort_by = $10, sort_dir = $11, row_limit = $12, chart_type = $13, updated_at = NOW()
     WHERE organization_id = $1 AND id = $2
     RETURNING ${SAVED_SELECT}`,
    [orgId, id, config.name, config.description || '', config.dataset, JSON.stringify(config.columns), JSON.stringify(config.filters),
      config.group_by || null, JSON.stringify(config.aggregations), config.sort_by || null, config.sort_dir, config.row_limit, config.chart_type],
  );
  return result.rows[0] || null;
}

export async function deleteSavedReport(orgId: string, id: string): Promise<boolean> {
  const result = await query('DELETE FROM custom_reports WHERE organization_id = $1 AND id = $2', [orgId, id]);
  return (result.rowCount || 0) > 0;
}

// ─── Scheduled email delivery ──────────────────────────────
//
// A schedule pins a cadence and a recipient list to a saved report. The
// hourly sweep in reporting.delivery.ts picks up due rows, re-runs the
// report against live data, and emails the CSV. The schedule never stores
// results — only when to run and who to tell.

export const reportScheduleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  day_of_month: z.number().int().min(1).max(28).nullable().optional(),
  send_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Send time must be HH:MM (24-hour).'),
  recipient_ids: z.array(z.string().uuid()).min(1).max(20),
  enabled: z.boolean().default(true),
}).superRefine((val, ctx) => {
  if (val.frequency === 'weekly' && (val.day_of_week === null || val.day_of_week === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['day_of_week'], message: 'Weekly schedules need a day of the week.' });
  }
  if (val.frequency === 'monthly' && (val.day_of_month === null || val.day_of_month === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['day_of_month'], message: 'Monthly schedules need a day of the month (1-28).' });
  }
  if (val.frequency === 'daily' && (val.day_of_week !== null && val.day_of_week !== undefined || val.day_of_month !== null && val.day_of_month !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frequency'], message: 'Daily schedules take no day — only a time.' });
  }
});

export type ReportScheduleInput = z.infer<typeof reportScheduleSchema>;

export interface ReportSchedule {
  id: string;
  organization_id: string;
  custom_report_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  send_time: string;
  recipient_ids: string[];
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const SCHEDULE_SELECT = `id, organization_id, custom_report_id, frequency, day_of_week,
  day_of_month, send_time::text AS send_time, recipient_user_ids AS recipient_ids,
  enabled, last_run_at, next_run_at, last_error, created_by, created_at, updated_at`;

function toSchedule(row: any): ReportSchedule {
  return {
    ...row,
    send_time: String(row.send_time).slice(0, 5),
    recipient_ids: Array.isArray(row.recipient_ids) ? row.recipient_ids : [],
  };
}

/** Recipients must be active users of the same org — never free-form emails. */
export async function assertScheduleRecipients(orgId: string, recipientIds: string[]): Promise<void> {
  const unique = [...new Set(recipientIds)];
  const result = await query(
    `SELECT id FROM users WHERE organization_id = $1 AND status = 'active' AND id = ANY($2)`,
    [orgId, unique],
  );
  if (result.rows.length !== unique.length) {
    throw new Error('Recipients must be active members of your organisation.');
  }
}

export async function listReportSchedules(orgId: string, reportId: string): Promise<ReportSchedule[]> {
  const result = await query(
    `SELECT ${SCHEDULE_SELECT} FROM custom_report_schedules
     WHERE organization_id = $1 AND custom_report_id = $2 ORDER BY created_at`,
    [orgId, reportId],
  );
  return result.rows.map(toSchedule);
}

export async function createReportSchedule(
  orgId: string, reportId: string, userId: string, input: ReportScheduleInput, nextRunAt: Date,
): Promise<ReportSchedule> {
  await assertScheduleRecipients(orgId, input.recipient_ids);
  const result = await query(
    `INSERT INTO custom_report_schedules
       (organization_id, custom_report_id, frequency, day_of_week, day_of_month,
        send_time, recipient_user_ids, enabled, next_run_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::time, $7, $8, $9, $10)
     RETURNING ${SCHEDULE_SELECT}`,
    [orgId, reportId, input.frequency, input.day_of_week ?? null, input.day_of_month ?? null,
      input.send_time, [...new Set(input.recipient_ids)], input.enabled, nextRunAt.toISOString(), userId],
  );
  return toSchedule(result.rows[0]);
}

export async function updateReportSchedule(
  orgId: string, scheduleId: string, input: ReportScheduleInput, nextRunAt: Date,
): Promise<ReportSchedule | null> {
  await assertScheduleRecipients(orgId, input.recipient_ids);
  const result = await query(
    `UPDATE custom_report_schedules SET frequency = $3, day_of_week = $4, day_of_month = $5,
       send_time = $6::time, recipient_user_ids = $7, enabled = $8,
       next_run_at = $9, last_error = NULL, updated_at = NOW()
     WHERE organization_id = $1 AND id = $2
     RETURNING ${SCHEDULE_SELECT}`,
    [orgId, scheduleId, input.frequency, input.day_of_week ?? null, input.day_of_month ?? null,
      input.send_time, [...new Set(input.recipient_ids)], input.enabled, nextRunAt.toISOString()],
  );
  return result.rows[0] ? toSchedule(result.rows[0]) : null;
}

export async function deleteReportSchedule(orgId: string, scheduleId: string): Promise<boolean> {
  const result = await query('DELETE FROM custom_report_schedules WHERE organization_id = $1 AND id = $2', [orgId, scheduleId]);
  return (result.rowCount || 0) > 0;
}

export interface DueReportSchedule extends ReportSchedule {
  report_name: string;
  org_timezone: string | null;
}

/** Schedules whose next run has passed, with the report name and org timezone. */
export async function listDueReportSchedules(db: DbExecutor = query): Promise<DueReportSchedule[]> {
  const result = await db(
    `SELECT s.id, s.organization_id, s.custom_report_id, s.frequency, s.day_of_week,
            s.day_of_month, s.send_time::text AS send_time,
            s.recipient_user_ids AS recipient_ids,
            s.enabled, s.last_run_at, s.next_run_at, s.last_error,
            s.created_by, s.created_at, s.updated_at,
            cr.name AS report_name, o.timezone AS org_timezone
     FROM custom_report_schedules s
     JOIN custom_reports cr ON cr.id = s.custom_report_id
     JOIN organizations o ON o.id = s.organization_id
     WHERE s.enabled AND (s.next_run_at IS NULL OR s.next_run_at <= NOW())
     ORDER BY s.next_run_at NULLS FIRST`,
  );
  return result.rows.map((row: any) => ({ ...toSchedule(row), report_name: row.report_name, org_timezone: row.org_timezone || null }));
}

export async function markScheduleRun(
  scheduleId: string, nextRunAt: Date | null, error?: string | null, db: DbExecutor = query,
): Promise<void> {
  if (nextRunAt) {
    await db(
      `UPDATE custom_report_schedules
       SET last_run_at = NOW(), next_run_at = $2, last_error = $3, updated_at = NOW()
       WHERE id = $1`,
      [scheduleId, nextRunAt.toISOString(), error ?? null],
    );
  } else {
    await db(
      `UPDATE custom_report_schedules
       SET last_run_at = NOW(), last_error = $2, updated_at = NOW()
       WHERE id = $1`,
      [scheduleId, error ?? null],
    );
  }
}

/** One attempted sweep run for a schedule — what the dialog history reads. */
export interface ReportDelivery {
  id: string;
  status: 'sent' | 'failed';
  recipient_count: number;
  row_count: number;
  error: string | null;
  ran_at: string;
}

export async function recordScheduleDelivery(
  orgId: string,
  reportId: string,
  scheduleId: string,
  outcome: { status: 'sent' | 'failed'; recipientCount?: number; rowCount?: number; error?: string | null },
  db: DbExecutor = query,
): Promise<void> {
  await db(
    `INSERT INTO custom_report_deliveries
       (organization_id, custom_report_id, schedule_id, status, recipient_count, row_count, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [orgId, reportId, scheduleId, outcome.status, outcome.recipientCount ?? 0, outcome.rowCount ?? 0, outcome.error ?? null],
  );
}

/** Latest delivery attempts for one schedule, newest first (default 10, max 50). */
export async function listScheduleDeliveries(
  orgId: string,
  reportId: string,
  scheduleId: string,
  limit = 10,
  db: DbExecutor = query,
): Promise<ReportDelivery[]> {
  const safeLimit = Math.min(Math.max(limit || 10, 1), 50);
  const result = await db(
    `SELECT d.id, d.status, d.recipient_count, d.row_count, d.error, d.ran_at
     FROM custom_report_deliveries d
     JOIN custom_report_schedules s ON s.id = d.schedule_id
     WHERE d.organization_id = $1 AND d.custom_report_id = $2 AND d.schedule_id = $3
       AND s.organization_id = $1 AND s.custom_report_id = $2
     ORDER BY d.ran_at DESC
     LIMIT ${safeLimit}`,
    [orgId, reportId, scheduleId],
  );
  return result.rows;
}

/** Active org members a schedule may be sent to (id, name, email, role). */
export async function listScheduleRecipients(orgId: string): Promise<{ id: string; name: string; email: string; role: string }[]> {
  const result = await query(
    `SELECT u.id, COALESCE(NULLIF(TRIM(sp.first_name || ' ' || sp.last_name), ''), u.email) AS name,
            u.email, u.role
     FROM users u
     LEFT JOIN staff_profiles sp ON sp.user_id = u.id
     WHERE u.organization_id = $1 AND u.status = 'active'
     ORDER BY name`,
    [orgId],
  );
  return result.rows;
}
