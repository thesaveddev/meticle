export interface ReportFilters {
  dateFrom?: string
  dateTo?: string
  location_id?: string
  department_id?: string
  role?: string
  status?: string
  severity?: string
  category?: string
  groupBy?: string
  interval?: 'day' | 'week' | 'month' | 'quarter' | 'year'
}

export interface ReportSummaryCard {
  label: string
  value: string | number
  color?: string
  trend?: { value: number; direction: 'up' | 'down' | 'flat' }
  subtitle?: string
}

export interface ReportSeries {
  name: string
  value: number
  color?: string
  [key: string]: any
}

export interface ReportTableColumn {
  key: string
  label: string
  type?: 'text' | 'number' | 'badge' | 'percent' | 'date' | 'currency' | 'progress'
  color?: string
}

export interface ReportTable {
  columns: ReportTableColumn[]
  rows: Record<string, any>[]
}

export interface ReportData {
  report: { id: string; title: string; category: string; generatedAt: string }
  summary: { cards: ReportSummaryCard[] }
  series: ReportSeries[]
  table: ReportTable
}

export interface ReportDefinition {
  id: string
  title: string
  description: string
  category: string
  icon: string
  color: string
  filters: string[]
  groupByOptions: string[]
  chartTypes: ('bar' | 'pie' | 'line' | 'area' | 'radar' | 'table')[]
  defaultChartType: string
}

export const REPORT_REGISTRY: ReportDefinition[] = [
  // ─── Staff ─────────────────────────────────────────────
  {
    id: 'staff-directory', title: 'Staff Directory', description: 'Complete staff list with roles, departments, and status',
    category: 'staff', icon: 'People', color: '#0F4C81',
    filters: ['dateRange', 'location', 'department', 'role', 'status'],
    groupByOptions: ['role', 'department', 'location', 'status'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'table',
  },
  {
    id: 'staff-by-location', title: 'Staff by Location', description: 'Headcount distribution across locations',
    category: 'staff', icon: 'LocationOn', color: '#0F4C81',
    filters: ['dateRange', 'location', 'department', 'role'],
    groupByOptions: ['location', 'department', 'role'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'staff-by-role', title: 'Staff by Role', description: 'Role distribution across the organisation',
    category: 'staff', icon: 'Badge', color: '#0F4C81',
    filters: ['dateRange', 'location', 'department'],
    groupByOptions: ['role', 'department', 'location'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'pie',
  },
  {
    id: 'staff-compliance', title: 'Staff Compliance Status', description: 'Per-staff compliance rate and requirements status',
    category: 'staff', icon: 'CheckCircle', color: '#0F4C81',
    filters: ['dateRange', 'location', 'department', 'role', 'status'],
    groupByOptions: ['department', 'location', 'role'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'table',
  },
  {
    id: 'training-matrix', title: 'Training Matrix', description: 'Staff x module completion matrix',
    category: 'staff', icon: 'School', color: '#0F4C81',
    filters: ['dateRange', 'location', 'department', 'role', 'status'],
    groupByOptions: ['module', 'department', 'location'],
    chartTypes: ['bar', 'table'], defaultChartType: 'table',
  },
  {
    id: 'staff-documents', title: 'Staff Documents & DBS', description: 'Document expiry status and DBS check dates',
    category: 'staff', icon: 'Description', color: '#0F4C81',
    filters: ['location', 'department', 'role', 'status'],
    groupByOptions: ['document_type', 'department', 'location'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'table',
  },
  {
    id: 'staff-skills', title: 'Skills & Qualifications', description: 'Skills inventory across all staff',
    category: 'staff', icon: 'Star', color: '#0F4C81',
    filters: ['location', 'department', 'role'],
    groupByOptions: ['skill', 'department', 'location'],
    chartTypes: ['bar', 'table'], defaultChartType: 'table',
  },

  // ─── People ─────────────────────────────────────────────
  {
    id: 'su-directory', title: 'Person Directory', description: 'Active people with demographics and care level',
    category: 'people', icon: 'Group', color: '#8B5CF6',
    filters: ['dateRange', 'location', 'status'],
    groupByOptions: ['location', 'status', 'care_level'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'table',
  },
  {
    id: 'su-by-location', title: 'People by Location', description: 'Person distribution across locations',
    category: 'people', icon: 'LocationOn', color: '#8B5CF6',
    filters: ['dateRange', 'location', 'status'],
    groupByOptions: ['location', 'status'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'su-care-plans', title: 'Care Plan Summary', description: 'Care plan status and last review dates',
    category: 'people', icon: 'Assignment', color: '#8B5CF6',
    filters: ['location', 'status'],
    groupByOptions: ['location', 'status'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'table',
  },
  {
    id: 'su-outcomes', title: 'Person Outcomes', description: 'Goals, wellbeing scores, and clinical assessments',
    category: 'people', icon: 'Psychology', color: '#8B5CF6',
    filters: ['dateRange', 'location', 'status'],
    groupByOptions: ['location', 'cqc_domain'],
    chartTypes: ['bar', 'pie', 'radar', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'su-daily-notes', title: 'Daily Notes Summary', description: 'Note frequency, mood trends, and safeguarding flags',
    category: 'people', icon: 'Note', color: '#8B5CF6',
    filters: ['dateRange', 'location'],
    groupByOptions: ['location', 'month'],
    chartTypes: ['bar', 'line', 'table'], defaultChartType: 'line',
  },

  // ─── Scheduling ─────────────────────────────────────────
  {
    id: 'shift-coverage', title: 'Shift Coverage', description: 'Shifts by location, date, and status',
    category: 'scheduling', icon: 'CalendarMonth', color: '#D97706',
    filters: ['dateRange', 'location', 'department', 'status'],
    groupByOptions: ['location', 'department', 'status', 'month'],
    chartTypes: ['bar', 'line', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'shift-fill-rate', title: 'Shift Fill Rate', description: 'Filled vs open shifts by location',
    category: 'scheduling', icon: 'FactCheck', color: '#D97706',
    filters: ['dateRange', 'location'],
    groupByOptions: ['location', 'month'],
    chartTypes: ['bar', 'line', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'overtime-analysis', title: 'Overtime Analysis', description: 'Overtime hours by staff and location',
    category: 'scheduling', icon: 'Schedule', color: '#D97706',
    filters: ['dateRange', 'location', 'department', 'role'],
    groupByOptions: ['staff', 'location', 'month'],
    chartTypes: ['bar', 'line', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'agency-usage', title: 'Agency Usage', description: 'Agency worker shifts and costs',
    category: 'scheduling', icon: 'Business', color: '#D97706',
    filters: ['dateRange', 'location'],
    groupByOptions: ['agency', 'location', 'month'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'bar',
  },

  // ─── Leave ──────────────────────────────────────────────
  {
    id: 'leave-by-type', title: 'Leave by Type', description: 'Leave breakdown by type with approval rates',
    category: 'leave', icon: 'BeachAccess', color: '#0EA5E9',
    filters: ['dateRange', 'location', 'department', 'role'],
    groupByOptions: ['leave_type', 'department', 'location'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'pie',
  },
  {
    id: 'leave-by-month', title: 'Leave Trends', description: 'Leave requests over time by type',
    category: 'leave', icon: 'TrendingUp', color: '#0EA5E9',
    filters: ['dateRange', 'location', 'department'],
    groupByOptions: ['month', 'leave_type'],
    chartTypes: ['line', 'area', 'bar', 'table'], defaultChartType: 'line',
  },
  {
    id: 'leave-by-department', title: 'Leave by Department', description: 'Leave usage comparison across departments',
    category: 'leave', icon: 'AccountTree', color: '#0EA5E9',
    filters: ['dateRange', 'location'],
    groupByOptions: ['department', 'month'],
    chartTypes: ['bar', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'leave-balances', title: 'Leave Balance Utilisation', description: 'Allocated vs taken vs remaining balances',
    category: 'leave', icon: 'Balance', color: '#0EA5E9',
    filters: ['location', 'department', 'role'],
    groupByOptions: ['staff', 'department', 'location'],
    chartTypes: ['bar', 'table'], defaultChartType: 'table',
  },

  // ─── Incidents ──────────────────────────────────────────
  {
    id: 'incident-summary', title: 'Incident Summary', description: 'Incidents by severity, category, and status',
    category: 'incidents', icon: 'WarningAmber', color: '#DC2626',
    filters: ['dateRange', 'location', 'severity', 'category', 'status'],
    groupByOptions: ['severity', 'category', 'status', 'location'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'incident-trends', title: 'Incident Trends', description: 'Incident frequency over time',
    category: 'incidents', icon: 'ShowChart', color: '#DC2626',
    filters: ['dateRange', 'location', 'severity', 'category'],
    groupByOptions: ['month', 'severity', 'category'],
    chartTypes: ['line', 'area', 'bar', 'table'], defaultChartType: 'line',
  },
  {
    id: 'incident-by-location', title: 'Incidents by Location', description: 'Geographic distribution of incidents',
    category: 'incidents', icon: 'LocationOn', color: '#DC2626',
    filters: ['dateRange', 'severity', 'category'],
    groupByOptions: ['location', 'severity'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'bar',
  },

  // ─── Compliance ─────────────────────────────────────────
  {
    id: 'compliance-overall', title: 'Compliance by Category', description: 'Compliance rates across all requirement categories',
    category: 'compliance', icon: 'Assessment', color: '#16A34A',
    filters: ['dateRange', 'location', 'department'],
    groupByOptions: ['category', 'department', 'location'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'compliance-by-staff', title: 'Compliance by Staff', description: 'Individual staff compliance records and rates',
    category: 'compliance', icon: 'Person', color: '#16A34A',
    filters: ['location', 'department', 'role', 'status'],
    groupByOptions: ['department', 'location', 'role'],
    chartTypes: ['bar', 'table'], defaultChartType: 'table',
  },
  {
    id: 'compliance-expiring', title: 'Expiring Documents', description: 'Documents expiring within configurable window',
    category: 'compliance', icon: 'Timer', color: '#16A34A',
    filters: ['location', 'department'],
    groupByOptions: ['document_type', 'department', 'location'],
    chartTypes: ['bar', 'pie', 'table'], defaultChartType: 'table',
  },

  // ─── Training ───────────────────────────────────────────
  {
    id: 'training-completion', title: 'Training Completion Rates', description: 'Module completion rates across staff',
    category: 'training', icon: 'MenuBook', color: '#6366F1',
    filters: ['dateRange', 'location', 'department', 'role'],
    groupByOptions: ['module', 'department', 'location'],
    chartTypes: ['bar', 'line', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'training-overdue', title: 'Overdue Training', description: 'Staff with overdue or expiring training modules',
    category: 'training', icon: 'ReportProblem', color: '#6366F1',
    filters: ['location', 'department', 'role'],
    groupByOptions: ['module', 'department', 'location'],
    chartTypes: ['bar', 'table'], defaultChartType: 'table',
  },
  {
    id: 'competency-scores', title: 'Competency Assessment Scores', description: 'Assessment score distributions and trends',
    category: 'training', icon: 'EmojiEvents', color: '#6366F1',
    filters: ['dateRange', 'location', 'department', 'role'],
    groupByOptions: ['template', 'department', 'location'],
    chartTypes: ['bar', 'line', 'table'], defaultChartType: 'bar',
  },

  // ─── eMAR ───────────────────────────────────────────────
  {
    id: 'mar-compliance', title: 'MAR Administration Compliance', description: 'Medication administration rates and missed doses',
    category: 'emedication', icon: 'Medication', color: '#EC4899',
    filters: ['dateRange', 'location'],
    groupByOptions: ['location', 'month', 'status'],
    chartTypes: ['bar', 'line', 'pie', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'mar-prn', title: 'PRN Medication Usage', description: 'PRN medication frequency and patterns',
    category: 'emedication', icon: 'Science', color: '#EC4899',
    filters: ['dateRange', 'location'],
    groupByOptions: ['location', 'month'],
    chartTypes: ['bar', 'line', 'table'], defaultChartType: 'bar',
  },

  // ─── Outcomes ───────────────────────────────────────────
  {
    id: 'outcomes-by-domain', title: 'Outcomes by CQC Domain', description: 'Goal completion rates by CQC domain',
    category: 'outcomes', icon: 'Psychology', color: '#7C3AED',
    filters: ['dateRange', 'location'],
    groupByOptions: ['domain', 'location', 'month'],
    chartTypes: ['bar', 'radar', 'table'], defaultChartType: 'bar',
  },
  {
    id: 'outcomes-wellbeing', title: 'Wellbeing Scores', description: 'Wellbeing domain averages and distributions',
    category: 'outcomes', icon: 'Favorite', color: '#7C3AED',
    filters: ['dateRange', 'location'],
    groupByOptions: ['domain', 'location', 'month'],
    chartTypes: ['bar', 'radar', 'line', 'table'], defaultChartType: 'radar',
  },
  {
    id: 'outcomes-goal-trend', title: 'Goal Progress Trend', description: 'Goal progress over time with weekly granularity',
    category: 'outcomes', icon: 'TrendingUp', color: '#7C3AED',
    filters: ['dateRange', 'location'],
    groupByOptions: ['week', 'domain'],
    chartTypes: ['line', 'area', 'bar', 'table'], defaultChartType: 'line',
  },
]

export const CATEGORIES = [
  { id: 'staff', label: 'Staff', color: '#0F4C81', icon: 'People' },
  { id: 'people', label: 'People', color: '#8B5CF6', icon: 'Group' },
  { id: 'scheduling', label: 'Scheduling', color: '#D97706', icon: 'CalendarMonth' },
  { id: 'leave', label: 'Leave', color: '#0EA5E9', icon: 'BeachAccess' },
  { id: 'incidents', label: 'Incidents', color: '#DC2626', icon: 'WarningAmber' },
  { id: 'compliance', label: 'Compliance', color: '#16A34A', icon: 'Assessment' },
  { id: 'training', label: 'Training', color: '#6366F1', icon: 'School' },
  { id: 'emedication', label: 'eMAR', color: '#EC4899', icon: 'Medication' },
  { id: 'outcomes', label: 'Outcomes', color: '#7C3AED', icon: 'Psychology' },
] as const
