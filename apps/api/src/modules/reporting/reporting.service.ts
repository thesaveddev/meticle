import { ReportingRepository } from './reporting.repository';
import { ReportData, ReportFilters, ReportSeries, ReportTableColumn, REPORT_REGISTRY } from './reporting.types';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626', high: '#F59E0B', medium: '#EAB308', low: '#3B82F6',
};
const STATUS_COLORS: Record<string, string> = {
  open: '#D97706', investigating: '#6366F1', resolved: '#16A34A', closed: '#6B7280',
  approved: '#16A34A', rejected: '#DC2626', pending: '#D97706',
  completed: '#16A34A', expired: '#DC2626', in_progress: '#0EA5E9', overdue: '#DC2626',
  administered: '#16A34A', missed: '#DC2626', refused: '#F59E0B', self_administered: '#6366F1',
};
const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: 'Admin', MANAGER: 'Manager', CARE_WORKER: 'Care Worker',
  COMPLIANCE_OFFICER: 'Compliance', SUPER_ADMIN: 'Super Admin',
};

type RepositoryMethod = (orgId: string, filters: ReportFilters) => Promise<any[]>;

const REPO_MAP: Record<string, RepositoryMethod> = {
  'staff-directory': ReportingRepository.staffDirectory,
  'staff-by-location': ReportingRepository.staffByLocation,
  'staff-by-role': ReportingRepository.staffByRole,
  'staff-compliance': ReportingRepository.staffCompliance,
  'training-matrix': ReportingRepository.trainingMatrix,
  'staff-documents': ReportingRepository.staffDocuments,
  'staff-skills': ReportingRepository.staffSkills,
  'su-directory': ReportingRepository.suDirectory,
  'su-by-location': ReportingRepository.suByLocation,
  'su-care-plans': ReportingRepository.suCarePlans,
  'su-outcomes': ReportingRepository.suOutcomes,
  'su-daily-notes': ReportingRepository.suDailyNotes,
  'shift-coverage': ReportingRepository.shiftCoverage,
  'shift-fill-rate': ReportingRepository.shiftFillRate,
  'overtime-analysis': ReportingRepository.overtimeAnalysis,
  'agency-usage': ReportingRepository.agencyUsage,
  'appointments-summary': ReportingRepository.appointmentsSummary,
  'room-checks': ReportingRepository.roomChecks,
  'satisfaction-surveys': ReportingRepository.satisfactionSurveys,
  'health-observations': ReportingRepository.healthObservations,
  'task-completion': ReportingRepository.taskCompletion,
  'expenses-summary': ReportingRepository.expensesSummary,
  'leave-by-type': ReportingRepository.leaveByType,
  'leave-by-month': ReportingRepository.leaveByMonth,
  'leave-by-department': ReportingRepository.leaveByDepartment,
  'leave-balances': ReportingRepository.leaveBalances,
  'incident-summary': ReportingRepository.incidentSummary,
  'incident-trends': ReportingRepository.incidentTrends,
  'incident-by-location': ReportingRepository.incidentByLocation,
  'compliance-overall': ReportingRepository.complianceOverall,
  'compliance-by-staff': ReportingRepository.complianceByStaff,
  'compliance-expiring': ReportingRepository.complianceExpiring,
  'training-completion': ReportingRepository.trainingCompletion,
  'training-overdue': ReportingRepository.trainingOverdue,
  'competency-scores': ReportingRepository.competencyScores,
  'mar-compliance': ReportingRepository.marCompliance,
  'mar-prn': ReportingRepository.marPrn,
  'outcomes-by-domain': ReportingRepository.outcomesByDomain,
  'outcomes-wellbeing': ReportingRepository.outcomesWellbeing,
  'outcomes-goal-trend': ReportingRepository.outcomesGoalTrend,
};

function buildSummaryCards(rows: any[], reportId: string): { label: string; value: string | number; color?: string; trend?: { value: number; direction: 'up' | 'down' | 'flat' } }[] {
  if (rows.length === 0) return [{ label: 'No Data', value: 0, color: '#6B7280' }];

  const cards: { label: string; value: string | number; color?: string }[] = [];
  const total = rows.reduce((s, r) => s + (r.value || r.total || r.count || 0), 0);
  cards.push({ label: 'Total', value: total.toLocaleString(), color: '#0F4C81' });

  if (reportId === 'staff-compliance' || reportId === 'compliance-by-staff') {
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + (r.compliance_rate || 0), 0) / rows.length) : 0;
    cards.push({ label: 'Avg Compliance', value: `${avg}%`, color: avg >= 80 ? '#16A34A' : '#DC2626' });
    const belowThreshold = rows.filter(r => (r.compliance_rate || 0) < 80).length;
    if (belowThreshold > 0) cards.push({ label: 'Below Threshold', value: belowThreshold, color: '#DC2626' });
  }

  if (reportId === 'staff-compliance' || reportId === 'compliance-by-staff') {
    const totalRec = rows.reduce((s, r) => s + (r.total_records || 0), 0);
    const completed = rows.reduce((s, r) => s + (r.completed || 0), 0);
    if (totalRec > 0) cards.push({ label: 'Completion Rate', value: `${Math.round(completed / totalRec * 100)}%`, color: '#16A34A' });
  }

  if (reportId === 'shift-fill-rate') {
    const totalShifts = rows.reduce((s, r) => s + (r.total_shifts || 0), 0);
    const filled = rows.reduce((s, r) => s + (r.filled_shifts || 0), 0);
    if (totalShifts > 0) cards.push({ label: 'Fill Rate', value: `${Math.round(filled / totalShifts * 100)}%`, color: filled / totalShifts >= 0.8 ? '#16A34A' : '#DC2626' });
  }

  if (reportId === 'overtime-analysis') {
    const totalHours = rows.reduce((s, r) => s + parseFloat(r.total_hours || '0'), 0);
    cards.push({ label: 'OT Hours', value: `${totalHours.toFixed(1)}h`, color: '#D97706' });
  }

  if (reportId === 'incident-summary' || reportId === 'incident-trends' || reportId === 'incident-by-location') {
    const critical = rows.filter(r => r.severity === 'critical' || r.name === 'critical').reduce((s, r) => s + (r.value || 0), 0);
    const high = rows.filter(r => r.severity === 'high' || r.name === 'high').reduce((s, r) => s + (r.value || 0), 0);
    if (critical > 0) cards.push({ label: 'Critical', value: critical, color: '#DC2626' });
    if (high > 0) cards.push({ label: 'High', value: high, color: '#F59E0B' });
  }

  if (reportId === 'leave-by-type' || reportId === 'leave-by-month' || reportId === 'leave-by-department') {
    const approved = rows.reduce((s, r) => s + (r.approved || 0), 0);
    const pending = rows.reduce((s, r) => s + (r.pending || 0), 0);
    cards.push({ label: 'Approved', value: approved, color: '#16A34A' });
    if (pending > 0) cards.push({ label: 'Pending', value: pending, color: '#D97706' });
  }

  if (reportId === 'mar-compliance') {
    const administered = rows.filter(r => r.status === 'administered').reduce((s, r) => s + (r.value || 0), 0);
    const missed = rows.filter(r => r.status === 'missed').reduce((s, r) => s + (r.value || 0), 0);
    if (total > 0) cards.push({ label: 'Administration Rate', value: `${Math.round(administered / total * 100)}%`, color: '#16A34A' });
    if (missed > 0) cards.push({ label: 'Missed Doses', value: missed, color: '#DC2626' });
  }

  if (reportId === 'training-completion') {
    const avgRate = rows.length ? Math.round(rows.reduce((s, r) => s + (r.completion_rate || 0), 0) / rows.length) : 0;
    cards.push({ label: 'Avg Completion', value: `${avgRate}%`, color: avgRate >= 80 ? '#16A34A' : '#DC2626' });
  }

  if (reportId === 'training-overdue') {
    cards.push({ label: 'Overdue Records', value: rows.length, color: '#DC2626' });
  }

  if (reportId === 'outcomes-by-domain' || reportId === 'outcomes-wellbeing') {
    const average = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + Number(row.avg_progress ?? row.avg_score ?? row.value ?? 0), 0) / rows.length * 10) / 10
      : 0;
    cards.push({
      label: reportId === 'outcomes-wellbeing' ? 'Average Wellbeing' : 'Average Progress',
      value: reportId === 'outcomes-wellbeing' ? `${average}/10` : `${average}%`,
      color: average >= (reportId === 'outcomes-wellbeing' ? 6 : 60) ? '#16A34A' : '#D97706',
    });
  }

  if (reportId === 'outcomes-goal-trend') {
    const average = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + Number(row.avg_progress ?? row.value ?? 0), 0) / rows.length)
      : 0;
    cards.push({ label: 'Average Progress', value: `${average}%`, color: average >= 60 ? '#16A34A' : '#D97706' });
  }

  if (reportId === 'compliance-overall') {
    const avgRate = rows.length ? Math.round(rows.reduce((s, r) => s + (r.rate || 0), 0) / rows.length) : 0;
    cards.push({ label: 'Overall Rate', value: `${avgRate}%`, color: avgRate >= 80 ? '#16A34A' : '#DC2626' });
  }

  if (reportId === 'leave-balances') {
    const totalAlloc = rows.reduce((s, r) => s + parseFloat(r.allocated || '0'), 0);
    const totalTaken = rows.reduce((s, r) => s + parseFloat(r.taken || '0'), 0);
    cards.push({ label: 'Utilisation', value: totalAlloc > 0 ? `${Math.round(totalTaken / totalAlloc * 100)}%` : '0%', color: '#0EA5E9' });
  }

  if (reportId === 'compliance-expiring') {
    const expiring30 = rows.filter(r => r.days_until_expiry <= 30).length;
    const expiring60 = rows.filter(r => r.days_until_expiry > 30 && r.days_until_expiry <= 60).length;
    cards.push({ label: 'Expiring ≤30 days', value: expiring30, color: expiring30 > 0 ? '#DC2626' : '#16A34A' });
    cards.push({ label: 'Expiring 31-60 days', value: expiring60, color: expiring60 > 0 ? '#D97706' : '#16A34A' });
  }

  if (reportId === 'su-care-plans') {
    const overdue = rows.filter(r => r.overdue_review).length;
    const active = rows.filter(r => r.plan_status === 'active').length;
    cards.push({ label: 'Active Plans', value: active, color: '#16A34A' });
    if (overdue > 0) cards.push({ label: 'Overdue Review', value: overdue, color: '#DC2626' });
  }

  if (reportId === 'appointments-summary') {
    const completed = rows.filter(r => r.name === 'completed').reduce((s, r) => s + (r.value || 0), 0);
    if (total > 0) cards.push({ label: 'Attendance', value: `${Math.round(completed / total * 100)}%`, color: completed / total >= 0.8 ? '#16A34A' : '#D97706' });
    const noShow = rows.filter(r => r.name === 'no_show').reduce((s, r) => s + (r.value || 0), 0);
    if (noShow > 0) cards.push({ label: 'No-Shows', value: noShow, color: '#DC2626' });
  }

  if (reportId === 'room-checks') {
    const pass = rows.filter(r => r.status === 'pass').reduce((s, r) => s + (r.value || 0), 0);
    if (total > 0) cards.push({ label: 'Pass Rate', value: `${Math.round(pass / total * 100)}%`, color: pass / total >= 0.9 ? '#16A34A' : '#D97706' });
    const attention = rows.filter(r => r.status === 'needs_attention').reduce((s, r) => s + (r.value || 0), 0);
    if (attention > 0) cards.push({ label: 'Needs Attention', value: attention, color: '#D97706' });
  }

  if (reportId === 'satisfaction-surveys') {
    const responseCount = rows.reduce((s, r) => s + (r.value || 0), 0);
    const weighted = rows.reduce((s, r) => s + (r.avg_rating || 0) * (r.value || 0), 0);
    const avg = responseCount > 0 ? Math.round(weighted / responseCount * 10) / 10 : 0;
    cards.push({ label: 'Avg Rating', value: `${avg}/5`, color: avg >= 4 ? '#16A34A' : avg >= 3 ? '#D97706' : '#DC2626' });
    cards.push({ label: 'Responses', value: responseCount, color: '#7C3AED' });
  }

  if (reportId === 'health-observations') {
    const severe = rows.filter(r => r.severity === 'severe').reduce((s, r) => s + (r.value || 0), 0);
    const moderate = rows.filter(r => r.severity === 'moderate').reduce((s, r) => s + (r.value || 0), 0);
    if (severe > 0) cards.push({ label: 'Severe', value: severe, color: '#DC2626' });
    if (moderate > 0) cards.push({ label: 'Moderate', value: moderate, color: '#F59E0B' });
  }

  if (reportId === 'task-completion') {
    const completed = rows.filter(r => r.name === 'completed').reduce((s, r) => s + (r.value || 0), 0);
    const overdue = rows.reduce((s, r) => s + (r.overdue || 0), 0);
    if (total > 0) cards.push({ label: 'Completion Rate', value: `${Math.round(completed / total * 100)}%`, color: completed / total >= 0.7 ? '#16A34A' : '#D97706' });
    if (overdue > 0) cards.push({ label: 'Overdue', value: overdue, color: '#DC2626' });
  }

  if (reportId === 'expenses-summary') {
    const totalPence = rows.reduce((s, r) => s + Number(r.total_pence || 0), 0);
    cards.push({ label: 'Total Spend', value: `£${(totalPence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#0891B2' });
    cards.push({ label: 'Transactions', value: total, color: '#0891B2' });
  }

  if (cards.length === 1) {
    cards.push({ label: 'Records', value: rows.length, color: '#0F4C81' });
  }

  return cards;
}

function buildSeries(rows: any[], reportId: string): ReportSeries[] {
  if (rows.length === 0) return [];

  const first = rows[0];
  if ('name' in first && 'value' in first && !('severity' in first) && !('leave_type' in first) && !('status' in first)) {
    return rows.map(r => ({
      name: r.name || 'Unknown',
      value: r.value || r.count || 0,
      color: r.color || undefined,
    }));
  }

  if (reportId === 'incident-trends' || reportId === 'leave-by-month' || reportId === 'health-observations') {
    const grouped: Record<string, Record<string, number>> = {};
    const seriesKeys = new Set<string>();
    rows.forEach(r => {
      const key = r.name || r.month || r.week;
      if (!grouped[key]) grouped[key] = {};
      const seriesKey = r.severity || r.leave_type || 'total';
      seriesKeys.add(seriesKey);
      grouped[key][seriesKey] = (grouped[key][seriesKey] || 0) + (r.value || 0);
    });
    const result: ReportSeries[] = [];
    Object.entries(grouped).forEach(([name, values]) => {
      result.push({ name, ...values } as any);
    });
    (result as any).__seriesKeys = Array.from(seriesKeys);
    return result;
  }

  if (reportId === 'appointments-summary' || reportId === 'task-completion' || reportId === 'room-checks') {
    const grouped: Record<string, number> = {};
    rows.forEach(r => {
      grouped[r.name] = (grouped[r.name] || 0) + (r.value || 0);
    });
    return Object.entries(grouped).map(([name, value]) => ({
      name, value, color: STATUS_COLORS[name] || '#6B7280',
    }));
  }

  if (reportId === 'satisfaction-surveys') {
    const grouped: Record<string, number> = {};
    rows.forEach(r => {
      grouped[r.location_name || 'Unknown'] = (grouped[r.location_name || 'Unknown'] || 0) + (r.value || 0);
    });
    return Object.entries(grouped).map(([name, value]) => ({
      name, value, color: '#7C3AED',
    }));
  }

  if (reportId === 'expenses-summary') {
    const grouped: Record<string, number> = {};
    rows.forEach(r => {
      grouped[r.name] = (grouped[r.name] || 0) + Number(r.total_pence || 0);
    });
    return Object.entries(grouped).map(([name, value]) => ({
      name, value: Math.round(value / 100), color: undefined,
    }));
  }

  if (first.severity && !first.category && !first.status) {
    const grouped: Record<string, number> = {};
    rows.forEach(r => {
      grouped[r.name] = (grouped[r.name] || 0) + (r.value || 0);
    });
    return Object.entries(grouped).map(([name, value]) => ({
      name, value, color: SEVERITY_COLORS[name] || '#6B7280',
    }));
  }

  if (first.status && reportId === 'mar-compliance') {
    const grouped: Record<string, number> = {};
    rows.forEach(r => {
      grouped[r.status] = (grouped[r.status] || 0) + (r.value || 0);
    });
    return Object.entries(grouped).map(([name, value]) => ({
      name, value, color: STATUS_COLORS[name] || '#6B7280',
    }));
  }

  if (reportId === 'leave-by-type') {
    return rows.map(r => ({
      name: r.name || r.leave_type_name || 'Unknown',
      value: r.value || r.total || 0,
      color: r.color || undefined,
    }));
  }

  if (reportId === 'staff-by-role') {
    const roleColors = ['#0F4C81', '#6366F1', '#16A34A', '#D97706', '#DC2626', '#EC4899'];
    return rows.map((r, i) => ({
      name: r.name, value: r.value, color: roleColors[i % roleColors.length],
    }));
  }

  if (first.completion_rate !== undefined || first.compliance_rate !== undefined || first.fill_rate !== undefined || first.rate !== undefined) {
    return rows.map(r => ({
      name: r.name || `${r.first_name} ${r.last_name}`,
      value: r.completion_rate || r.compliance_rate || r.fill_rate || r.rate || r.value || 0,
      color: (r.completion_rate || r.compliance_rate || r.fill_rate || r.rate || 0) >= 80 ? '#16A34A' : '#DC2626',
    }));
  }

  if (first.shift_count !== undefined || first.total_shifts !== undefined) {
    const grouped: Record<string, number> = {};
    rows.forEach(r => {
      const key = r.status || r.name || r.location_name;
      grouped[key] = (grouped[key] || 0) + (r.shift_count || r.total_shifts || r.value || 0);
    });
    return Object.entries(grouped).map(([name, value]) => ({
      name, value, color: STATUS_COLORS[name] || '#6B7280',
    }));
  }

  return rows.map(r => ({
    name: r.name || r.first_name ? `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
    value: r.value || r.count || r.shift_count || r.total_shifts || 0,
    color: undefined,
  }));
}

function buildTable(rows: any[], reportId: string): { columns: ReportTableColumn[]; rows: Record<string, any>[] } {
  if (rows.length === 0) return { columns: [], rows: [] };

  const columnDefs: Record<string, ReportTableColumn[]> = {
    'staff-directory': [
      { key: 'last_name', label: 'Name', type: 'text', },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'role', label: 'Role', type: 'badge' },
      { key: 'position', label: 'Position', type: 'text' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'department_name', label: 'Department', type: 'text' },
      { key: 'compliance_rate', label: 'Compliance', type: 'percent' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
    'staff-by-location': [
      { key: 'name', label: 'Location', type: 'text' },
      { key: 'value', label: 'Staff Count', type: 'number' },
    ],
    'staff-by-role': [
      { key: 'name', label: 'Role', type: 'badge' },
      { key: 'value', label: 'Count', type: 'number' },
    ],
    'staff-compliance': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'role', label: 'Role', type: 'badge' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'department_name', label: 'Department', type: 'text' },
      { key: 'total_records', label: 'Records', type: 'number' },
      { key: 'completed', label: 'Completed', type: 'number' },
      { key: 'compliance_rate', label: 'Rate', type: 'percent' },
    ],
    'training-matrix': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'module_name', label: 'Module', type: 'text' },
      { key: 'module_category', label: 'Category', type: 'text' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'completed_at', label: 'Completed', type: 'date' },
      { key: 'expires_at', label: 'Expires', type: 'date' },
      { key: 'location_name', label: 'Location', type: 'text' },
    ],
    'staff-documents': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'document_type', label: 'Document', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'expiry_date', label: 'Expiry', type: 'date' },
      { key: 'expiry_status', label: 'Status', type: 'badge' },
      { key: 'location_name', label: 'Location', type: 'text' },
    ],
    'staff-skills': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'skill_name', label: 'Skill', type: 'text' },
      { key: 'skill_category', label: 'Category', type: 'text' },
      { key: 'proficiency_level', label: 'Proficiency', type: 'text' },
      { key: 'location_name', label: 'Location', type: 'text' },
    ],
    'su-directory': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'care_level', label: 'Care Level', type: 'text' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'key_worker_first', label: 'Key Worker', type: 'text' },
      { key: 'created_at', label: 'Since', type: 'date' },
    ],
    'su-by-location': [
      { key: 'name', label: 'Location', type: 'text' },
      { key: 'value', label: 'Count', type: 'number' },
    ],
    'su-care-plans': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'plan_status', label: 'Plan Status', type: 'badge' },
      { key: 'plan_updated', label: 'Last Updated', type: 'date' },
      { key: 'overdue_review', label: 'Overdue', type: 'badge' },
    ],
    'su-outcomes': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'total_goals', label: 'Goals', type: 'number' },
      { key: 'completed_goals', label: 'Completed', type: 'number' },
      { key: 'avg_progress', label: 'Avg Progress', type: 'percent' },
      { key: 'avg_wellbeing', label: 'Wellbeing', type: 'number' },
    ],
    'su-daily-notes': [
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'note_count', label: 'Notes', type: 'number' },
      { key: 'mood_flagged', label: 'Mood Flagged', type: 'number' },
      { key: 'safeguarding_flags', label: 'Safeguarding', type: 'number' },
    ],
    'health-observations': [
      { key: 'name', label: 'Month', type: 'text' },
      { key: 'category', label: 'Category', type: 'badge' },
      { key: 'severity', label: 'Severity', type: 'badge' },
      { key: 'value', label: 'Observations', type: 'number' },
    ],
    'shift-coverage': [
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'shift_type', label: 'Type', type: 'text' },
      { key: 'shift_count', label: 'Shifts', type: 'number' },
      { key: 'total_hours', label: 'Hours', type: 'number' },
    ],
    'shift-fill-rate': [
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'total_shifts', label: 'Total', type: 'number' },
      { key: 'filled_shifts', label: 'Filled', type: 'number' },
      { key: 'open_shifts', label: 'Open', type: 'number' },
      { key: 'fill_rate', label: 'Fill Rate', type: 'percent' },
    ],
    'overtime-analysis': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'department_name', label: 'Department', type: 'text' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'overtime_shifts', label: 'OT Shifts', type: 'number' },
      { key: 'total_hours', label: 'Hours', type: 'number' },
    ],
    'agency-usage': [
      { key: 'agency_name', label: 'Agency', type: 'text' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'agency_shifts', label: 'Shifts', type: 'number' },
      { key: 'total_hours', label: 'Hours', type: 'number' },
    ],
    'appointments-summary': [
      { key: 'name', label: 'Status', type: 'badge' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'value', label: 'Appointments', type: 'number' },
    ],
    'leave-by-type': [
      { key: 'name', label: 'Leave Type', type: 'text' },
      { key: 'total_hours', label: 'Hours', type: 'number' },
      { key: 'approved', label: 'Approved', type: 'number' },
      { key: 'rejected', label: 'Rejected', type: 'number' },
      { key: 'pending', label: 'Pending', type: 'number' },
      { key: 'value', label: 'Total Requests', type: 'number' },
    ],
    'leave-by-month': [
      { key: 'name', label: 'Month', type: 'text' },
      { key: 'leave_type', label: 'Type', type: 'text' },
      { key: 'total_hours', label: 'Hours', type: 'number' },
      { key: 'value', label: 'Requests', type: 'number' },
    ],
    'leave-by-department': [
      { key: 'name', label: 'Department', type: 'text' },
      { key: 'total_hours', label: 'Hours', type: 'number' },
      { key: 'approved', label: 'Approved', type: 'number' },
      { key: 'pending', label: 'Pending', type: 'number' },
      { key: 'value', label: 'Total Requests', type: 'number' },
    ],
    'leave-balances': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'department_name', label: 'Department', type: 'text' },
      { key: 'leave_type_name', label: 'Type', type: 'text' },
      { key: 'allocated', label: 'Allocated', type: 'number' },
      { key: 'taken', label: 'Taken', type: 'number' },
      { key: 'remaining', label: 'Remaining', type: 'number' },
    ],
    'incident-summary': [
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'name', label: 'Severity', type: 'badge' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'value', label: 'Count', type: 'number' },
    ],
    'incident-trends': [
      { key: 'name', label: 'Month', type: 'text' },
      { key: 'severity', label: 'Severity', type: 'badge' },
      { key: 'value', label: 'Count', type: 'number' },
    ],
    'incident-by-location': [
      { key: 'name', label: 'Location', type: 'text' },
      { key: 'severity', label: 'Severity', type: 'badge' },
      { key: 'value', label: 'Count', type: 'number' },
    ],
    'compliance-overall': [
      { key: 'name', label: 'Category', type: 'text' },
      { key: 'completed', label: 'Completed', type: 'number' },
      { key: 'overdue', label: 'Overdue', type: 'number' },
      { key: 'value', label: 'Total', type: 'number' },
      { key: 'rate', label: 'Rate', type: 'percent' },
    ],
    'compliance-by-staff': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'role', label: 'Role', type: 'badge' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'department_name', label: 'Department', type: 'text' },
      { key: 'total_records', label: 'Records', type: 'number' },
      { key: 'completed', label: 'Completed', type: 'number' },
      { key: 'compliance_rate', label: 'Rate', type: 'percent' },
    ],
    'compliance-expiring': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'document_type', label: 'Document', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'expiry_date', label: 'Expiry', type: 'date' },
      { key: 'days_until_expiry', label: 'Days Left', type: 'number' },
      { key: 'location_name', label: 'Location', type: 'text' },
    ],
    'room-checks': [
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'value', label: 'Checks', type: 'number' },
      { key: 'cleanliness_avg', label: 'Cleanliness', type: 'number' },
      { key: 'safety_avg', label: 'Safety', type: 'number' },
    ],
    'training-completion': [
      { key: 'name', label: 'Module', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'total_records', label: 'Total', type: 'number' },
      { key: 'completed', label: 'Completed', type: 'number' },
      { key: 'expired', label: 'Expired', type: 'number' },
      { key: 'in_progress', label: 'In Progress', type: 'number' },
      { key: 'completion_rate', label: 'Rate', type: 'percent' },
    ],
    'training-overdue': [
      { key: 'last_name', label: 'Name', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'module_name', label: 'Module', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'expires_at', label: 'Expired On', type: 'date' },
      { key: 'days_overdue', label: 'Days Overdue', type: 'number' },
      { key: 'location_name', label: 'Location', type: 'text' },
    ],
    'competency-scores': [
      { key: 'last_name', label: 'Staff', type: 'text' },
      { key: 'first_name', label: '', type: 'text' },
      { key: 'template_name', label: 'Template', type: 'text' },
      { key: 'cqc_domain', label: 'CQC Domain', type: 'badge' },
      { key: 'score', label: 'Score', type: 'number' },
      { key: 'assessed_at', label: 'Assessed', type: 'date' },
      { key: 'location_name', label: 'Location', type: 'text' },
    ],
    'mar-compliance': [
      { key: 'name', label: 'Month', type: 'text' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'value', label: 'Count', type: 'number' },
    ],
    'mar-prn': [
      { key: 'medication_name', label: 'Medication', type: 'text' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'value', label: 'PRN Uses', type: 'number' },
    ],
    'outcomes-by-domain': [
      { key: 'name', label: 'CQC Domain', type: 'badge' },
      { key: 'completed', label: 'Completed', type: 'number' },
      { key: 'active', label: 'Active', type: 'number' },
      { key: 'value', label: 'Total', type: 'number' },
      { key: 'avg_progress', label: 'Avg Progress', type: 'percent' },
    ],
    'outcomes-wellbeing': [
      { key: 'name', label: 'Domain', type: 'text' },
      { key: 'value', label: 'Avg Score', type: 'number' },
      { key: 'entries', label: 'Entries', type: 'number' },
      { key: 'min_score', label: 'Min', type: 'number' },
      { key: 'max_score', label: 'Max', type: 'number' },
    ],
    'outcomes-goal-trend': [
      { key: 'week', label: 'Week', type: 'text' },
      { key: 'value', label: 'Avg Progress', type: 'percent' },
      { key: 'updates', label: 'Updates', type: 'number' },
    ],
    'satisfaction-surveys': [
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'value', label: 'Responses', type: 'number' },
      { key: 'avg_rating', label: 'Avg Rating', type: 'number' },
      { key: 'satisfied_count', label: 'Satisfied (4+)', type: 'number' },
    ],
    'task-completion': [
      { key: 'name', label: 'Status', type: 'badge' },
      { key: 'priority', label: 'Priority', type: 'badge' },
      { key: 'value', label: 'Tasks', type: 'number' },
      { key: 'completed_count', label: 'Completed', type: 'number' },
      { key: 'overdue', label: 'Overdue', type: 'number' },
    ],
    'expenses-summary': [
      { key: 'name', label: 'Category', type: 'badge' },
      { key: 'location_name', label: 'Location', type: 'text' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'value', label: 'Transactions', type: 'number' },
      { key: 'total_pence', label: 'Total', type: 'currency' },
    ],
  };

  const cols = columnDefs[reportId] || Object.keys(rows[0]).map(k => ({ key: k, label: k, type: 'text' as const }));

  const formattedRows = rows.map(r => {
    const row: Record<string, any> = {};
    cols.forEach(c => {
      let val = r[c.key];
      if (c.key === 'role' && ROLE_LABELS[val]) val = ROLE_LABELS[val];
      if (c.type === 'date' && val) {
        val = new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      if (c.type === 'currency' && val !== null && val !== undefined) {
        val = Number(val) / 100;
      }
      row[c.key] = val;
    });
    return row;
  });

  return { columns: cols, rows: formattedRows };
}

export async function getReportData(reportId: string, orgId: string, filters: ReportFilters): Promise<ReportData> {
  const def = REPORT_REGISTRY.find(r => r.id === reportId);
  if (!def) throw new Error(`Unknown report: ${reportId}`);

  const repoFn = REPO_MAP[reportId];
  if (!repoFn) throw new Error(`No repository method for: ${reportId}`);

  const rows = await repoFn(orgId, filters);

  return {
    report: {
      id: reportId,
      title: def.title,
      category: def.category,
      generatedAt: new Date().toISOString(),
    },
    summary: {
      cards: buildSummaryCards(rows, reportId),
    },
    series: buildSeries(rows, reportId),
    table: buildTable(rows, reportId),
  };
}
