-- Payroll and earnings reads are always scoped to one carer inside one
-- organisation (my-earnings, payslips, year-to-date, per-carer payroll
-- detail). The table only carried an (organization_id, status) index, so
-- every one of those lookups scanned all of the organisation's timesheet
-- rows. This index covers the carer-scoped read pattern directly.
CREATE INDEX IF NOT EXISTS idx_homecare_timesheets_staff_org
  ON homecare_timesheets(staff_id, organization_id);
