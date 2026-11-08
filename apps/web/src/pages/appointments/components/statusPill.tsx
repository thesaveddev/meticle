// Soft status pills shared by the list, the detail dialog and the week rows.
export const STATUS_PILL: Record<string, { bg: string; fg: string }> = {
  scheduled: { bg: 'notice.info.bg', fg: 'notice.info.fg' },
  completed: { bg: 'notice.success.bg', fg: 'notice.success.fg' },
  cancelled: { bg: 'notice.error.bg', fg: 'notice.error.fg' },
  no_show: { bg: 'action.hover', fg: 'text.secondary' },
}
