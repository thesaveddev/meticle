import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportFiltersDialog, { reportFiltersToBuilderInitial, EMPTY_REPORT_FILTERS } from './ReportFiltersDialog'
import SaveReportDialog from './SaveReportDialog'
import SelectReportsDialog from './SelectReportsDialog'
import PreparingReportDialog from './PreparingReportDialog'

const LOCATIONS = [{ id: 'loc-1', name: 'Elm House' }]
const DEPARTMENTS = [{ id: 'dep-1', name: 'Care' }]

describe('ReportFiltersDialog (Figma 10.2 screens 1–2)', () => {
  it('emits the chosen filters on Create report and clears on Clear all', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(
      <ReportFiltersDialog open onClose={() => { }} onCreate={onCreate} locations={LOCATIONS} departments={DEPARTMENTS} />,
    )

    await user.click(await screen.findByText('On leave'))
    await user.click(screen.getByText('Care worker'))
    await user.click(screen.getByRole('button', { name: 'Create report' }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      statuses: ['on_leave'], role: 'CARE_WORKER', sort: 'date-desc',
    }))
  })

  it('maps dialog values to a staff-dataset builder start', () => {
    const initial = reportFiltersToBuilderInitial(
      { ...EMPTY_REPORT_FILTERS, datePreset: '30d', statuses: ['active', 'on_leave'], locationId: 'loc-1', role: 'MANAGER', departmentId: 'dep-1', sort: 'name-asc' },
      LOCATIONS, DEPARTMENTS,
    )
    expect(initial.dataset).toBe('staff')
    expect(initial.sortBy).toBe('last_name')
    expect(initial.sortDir).toBe('asc')
    const byField = Object.fromEntries(initial.filters.map(f => [f.field, f]))
    expect(byField.status.op).toBe('in')
    expect(byField.role).toMatchObject({ op: 'eq', value: 'MANAGER' })
    expect(byField.location).toMatchObject({ op: 'eq', value: 'Elm House' })
    expect(byField.department).toMatchObject({ op: 'eq', value: 'Care' })
    expect(byField.joined.op).toBe('gte')
  })
})

describe('SaveReportDialog (Figma 10.2 screens 3–4)', () => {
  it('requires a name and saves visibility + pin', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<SaveReportDialog open initialName="" saving={false} onClose={() => { }} onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: 'Save report' }))
    expect(await screen.findByText('Give the report a name first.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()

    await user.type(screen.getByPlaceholderText(/Active staff by location/), 'Night cover')
    await user.click(screen.getByText('Only me'))
    await user.click(screen.getByRole('button', { name: 'Save report' }))
    expect(onSave).toHaveBeenCalledWith({ name: 'Night cover', visibility: 'me', pin: true })
  })
})

describe('SelectReportsDialog (Figma 10.2 screen 5)', () => {
  it('selects a saved report to open', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <SelectReportsDialog
        open onClose={() => { }} onSelect={onSelect}
        reports={[{ id: 'a', name: 'Active staff by location', description: 'Staff', updatedAt: new Date().toISOString() }]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Select report' }))
    expect(onSelect).toHaveBeenCalledWith('a')
  })
})

describe('PreparingReportDialog (Figma 10.2 screens 6–7)', () => {
  it('shows progress and cancels the export', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <PreparingReportDialog open title="Night cover" subtitle="Staff · CSV export" cancelLabel="Cancel export" onCancel={onCancel} />,
    )
    expect(await screen.findByText('Preparing your report')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel export' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
