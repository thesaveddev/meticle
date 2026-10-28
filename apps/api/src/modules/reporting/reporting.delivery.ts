// The sweep runs outside any request, so every read and write here goes
// through the superuser pool (the same convention as the other sweeps) —
// there is no request client to carry RLS session variables.
import { migrateQuery } from '../../shared/database';
import logger from '../../shared/utils/logger';
import { recordJobCompletion, recordJobStart } from '../../shared/jobs/heartbeat';
import { EmailService } from '../../shared/utils/email.service';
import { generateCsv } from './reporting.csv';
import {
  DueReportSchedule,
  customReportConfigSchema,
  getSavedReport,
  listDueReportSchedules,
  markScheduleRun,
  recordScheduleDelivery,
  runCustomReport,
} from './reporting.custom';

const JOB_NAME = 'custom_report_delivery';

export interface ScheduleCadence {
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week?: number | null;
  day_of_month?: number | null;
  send_time: string;
}

function tzParts(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** Milliseconds the tz wall clock runs ahead of UTC at this instant. */
function tzOffsetMs(timeZone: string, date: Date): number {
  const w = tzParts(timeZone, date);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) - date.getTime();
}

/** The UTC instant whose wall clock in `timeZone` reads the given fields. */
function wallToUtc(timeZone: string, year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(guess.getTime() - tzOffsetMs(timeZone, guess));
}

function safeTimeZone(tz: string | null | undefined): string {
  try {
    if (tz) new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    else throw new Error('empty');
    return tz;
  } catch {
    return 'UTC';
  }
}

/**
 * Next UTC instant strictly after `from` matching the cadence in the org's
 * timezone. Monthly days are capped at 28 by validation, so every month has
 * the day and a bounded scan always terminates.
 */
export function nextOccurrence(cadence: ScheduleCadence, timeZone: string, from: Date = new Date()): Date {
  const tz = safeTimeZone(timeZone);
  const [sendHour, sendMinute] = cadence.send_time.split(':').map(Number);
  const start = tzParts(tz, from);
  const startDay = Date.UTC(start.year, start.month - 1, start.day);
  for (let offset = 0; offset <= 370; offset++) {
    const day = new Date(startDay + offset * 86_400_000);
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    if (cadence.frequency === 'weekly' && day.getUTCDay() !== cadence.day_of_week) continue;
    if (cadence.frequency === 'monthly' && d !== cadence.day_of_month) continue;
    const candidate = wallToUtc(tz, y, m, d, sendHour, sendMinute);
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  throw new Error('Could not find the next scheduled run within a year.');
}

export function describeCadence(cadence: ScheduleCadence): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (cadence.frequency === 'daily') return `Daily at ${cadence.send_time}`;
  if (cadence.frequency === 'weekly') return `Weekly on ${days[cadence.day_of_week ?? 0]} at ${cadence.send_time}`;
  return `Monthly on day ${cadence.day_of_month} at ${cadence.send_time}`;
}

async function deliverSchedule(schedule: DueReportSchedule): Promise<{ recipients: number; rows: number }> {
  const saved = await getSavedReport(schedule.organization_id, schedule.custom_report_id, migrateQuery);
  if (!saved) throw new Error('The saved report for this schedule no longer exists.');
  const parsed = customReportConfigSchema.safeParse({
    name: saved.name, description: saved.description, dataset: saved.dataset,
    columns: saved.columns, filters: saved.filters, group_by: saved.group_by,
    aggregations: saved.aggregations, sort_by: saved.sort_by, sort_dir: saved.sort_dir,
    row_limit: saved.row_limit, chart_type: saved.chart_type,
  });
  if (!parsed.success) throw new Error('The saved report is no longer valid. Open it in the builder and save it again.');

  const data = await runCustomReport(schedule.organization_id, parsed.data, undefined, migrateQuery);
  const csv = generateCsv(data);
  const rows = data.table.rows.length;

  const orgResult = await migrateQuery('SELECT name FROM organizations WHERE id = $1', [schedule.organization_id]);
  const orgName = orgResult.rows[0]?.name || 'your organisation';

  const recipients = await migrateQuery(
    `SELECT u.email, COALESCE(NULLIF(TRIM(COALESCE(sp.first_name, '') || ' ' || COALESCE(sp.last_name, '')), ''), u.email) AS name
     FROM users u
     LEFT JOIN staff_profiles sp ON sp.user_id = u.id
     WHERE u.organization_id = $1 AND u.status = 'active' AND u.id = ANY($2)`,
    [schedule.organization_id, schedule.recipient_ids],
  );
  if (recipients.rows.length === 0) throw new Error('No active recipients left on this schedule.');

  const dateLabel = new Date().toISOString().split('T')[0];
  const filename = `${saved.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${dateLabel}.csv`;
  for (const r of recipients.rows) {
    await EmailService.sendScheduledReportEmail(
      r.email, r.name, orgName, saved.name, dateLabel, rows,
      schedule.custom_report_id, Buffer.from(csv, 'utf8'), filename,
    );
  }
  return { recipients: recipients.rows.length, rows };
}

/**
 * Hourly sweep: deliver every due schedule, advancing each one past its run
 * even on failure (with the error recorded) so a broken report cannot email
 * every hour forever. Heartbeat-stamped so a stopped sweep is noticed.
 */
export async function runDueReportSchedules(): Promise<{ checked: number; sent: number; failed: number }> {
  await recordJobStart(JOB_NAME);
  let checked = 0;
  let sent = 0;
  let failed = 0;
  try {
    const due = await listDueReportSchedules(migrateQuery);
    checked = due.length;
    for (const schedule of due) {
      try {
        const result = await deliverSchedule(schedule);
        await markScheduleRun(schedule.id, nextOccurrence(schedule, schedule.org_timezone || 'UTC'), null, migrateQuery);
        try {
          await recordScheduleDelivery(
            schedule.organization_id, schedule.custom_report_id, schedule.id,
            { status: 'sent', recipientCount: result.recipients, rowCount: result.rows }, migrateQuery,
          );
        } catch (histErr: any) {
          logger.error({ err: histErr?.message, scheduleId: schedule.id }, 'Could not record a sent delivery');
        }
        sent++;
        logger.info({ scheduleId: schedule.id, reportId: schedule.custom_report_id, ...result }, 'Scheduled report delivered');
      } catch (err: any) {
        failed++;
        const message = err?.message || 'Scheduled report delivery failed.';
        logger.error({ err: message, scheduleId: schedule.id }, 'Scheduled report delivery failed');
        try {
          await markScheduleRun(schedule.id, nextOccurrence(schedule, schedule.org_timezone || 'UTC'), message, migrateQuery);
        } catch (markErr: any) {
          logger.error({ err: markErr?.message, scheduleId: schedule.id }, 'Could not advance a failed schedule');
        }
        try {
          await recordScheduleDelivery(
            schedule.organization_id, schedule.custom_report_id, schedule.id,
            { status: 'failed', error: message }, migrateQuery,
          );
        } catch (histErr: any) {
          logger.error({ err: histErr?.message, scheduleId: schedule.id }, 'Could not record a failed delivery');
        }
      }
    }
    await recordJobCompletion(JOB_NAME, { checked, sent, failed });
  } catch (err: any) {
    await recordJobCompletion(JOB_NAME, { checked, sent, failed }, err?.message || 'Sweep failed.');
    throw err;
  }
  return { checked, sent, failed };
}
