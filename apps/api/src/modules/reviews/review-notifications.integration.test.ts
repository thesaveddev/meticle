import { describe, it, expect, vi } from 'vitest'
import { createOrg, createUser, createLocation, createPerson } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { EmailService } from '../../shared/utils/email.service'
import { ReviewNotificationService } from './review-notifications.service'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

const emailSpy = vi.spyOn(EmailService, 'sendEmail').mockResolvedValue(undefined as any)

/**
 * Overdue care-plan, risk-assessment and DNACPR reviews are a CQC finding, so a
 * daily sweep is supposed to raise them for whoever can act. It had no test file,
 * and underneath that was worse than a gap: the sweep ran entirely on the
 * application role with no request behind it, so `app.current_org_id` was unset
 * and every table it reads is `FORCE ROW LEVEL SECURITY`. It enumerated zero
 * organisations, looped zero times, and reported success. The tests below call it
 * the way the scheduler does — outside any HTTP request — which is the only way
 * that failure could be seen.
 */
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function reviewSite(options: {
  reviewDate?: string
  planStatus?: string
  withLocation?: boolean
  withManager?: boolean
} = {}) {
  const {
    reviewDate = 'CURRENT_DATE - 3',
    planStatus = 'active',
    withLocation = true,
    withManager = true,
  } = options

  const org = await createOrg()
  const s = stamp()
  const admin = await createUser({ email: `review-admin-${s}@reviews-test.com`, role: 'ORG_ADMIN', organization_id: org.id })
  const manager = withManager
    ? await createUser({ email: `review-mgr-${s}@reviews-test.com`, role: 'MANAGER', organization_id: org.id })
    : null
  const location = withLocation
    ? await createLocation({ organization_id: org.id, name: `Oak House ${s}`, manager_id: manager?.id ?? null })
    : null
  const person = await createPerson({
    organization_id: org.id,
    location_id: location?.id ?? null,
    first_name: 'Ada',
    last_name: 'Lovelace',
  })
  const plan = await migrateQuery(
    `INSERT INTO care_plans (person_id, title, category, review_date, status)
     VALUES ($1, $2, 'personal_care', ${reviewDate}, $3) RETURNING id`,
    [person.id, `Monthly support plan ${s}`, planStatus],
  )

  return { org, admin, manager, location, person, planId: plan.rows[0].id, title: `Monthly support plan ${s}` }
}

async function notificationsFor(userId: string, planTitle: string) {
  const res = await migrateQuery(
    `SELECT title, message, type FROM notifications
     WHERE user_id = $1 AND message LIKE $2`,
    [userId, `%${planTitle}%`],
  )
  return res.rows
}

describe('Overdue review notifications', () => {
  it('raises an overdue care plan for the location manager and the organisation administrator', async () => {
    const site = await reviewSite()

    const count = await ReviewNotificationService.checkOverdueReviews(site.org.id)
    expect(count).toBe(2)

    const managerRows = await notificationsFor(site.manager!.id, site.title)
    expect(managerRows).toHaveLength(1)
    expect(managerRows[0]).toMatchObject({ title: 'Care plan review overdue', type: 'compliance' })
    expect(managerRows[0].message).toContain('Ada Lovelace')
    expect(managerRows[0].message).toContain('was due by')

    const adminRows = await notificationsFor(site.admin.id, site.title)
    expect(adminRows).toHaveLength(1)
    expect(adminRows[0].title).toBe('Care plan review overdue')

    // The manager is also in the organisation's manager list, and a second copy
    // to the same person is not an extra reminder — it is noise that teaches
    // people to ignore the bell.
    const allManagerRows = await migrateQuery(
      'SELECT id FROM notifications WHERE user_id = $1 AND title = $2',
      [site.manager!.id, 'Care plan review overdue'],
    )
    expect(allManagerRows.rows).toHaveLength(1)

    // Email goes to the same people, as a notification mail it can be turned off.
    expect(emailSpy).toHaveBeenCalledWith(
      site.manager!.email,
      expect.stringContaining('Overdue review'),
      expect.any(String),
      'notifications',
    )
  })

  it('leaves a review that is not due yet alone', async () => {
    const site = await reviewSite({ reviewDate: 'CURRENT_DATE + 10' })

    const count = await ReviewNotificationService.checkOverdueReviews(site.org.id)

    expect(count).toBe(0)
    expect(await notificationsFor(site.manager!.id, site.title)).toHaveLength(0)
    expect(await notificationsFor(site.admin.id, site.title)).toHaveLength(0)
  })

  it('ignores an archived plan, which is no longer the current record', async () => {
    const site = await reviewSite({ planStatus: 'archived' })

    const count = await ReviewNotificationService.checkOverdueReviews(site.org.id)

    expect(count).toBe(0)
    expect(await notificationsFor(site.admin.id, site.title)).toHaveLength(0)
  })

  it('still reaches the administrator when the resident has no location', async () => {
    const site = await reviewSite({ withLocation: false, withManager: false })

    const count = await ReviewNotificationService.checkOverdueReviews(site.org.id)

    expect(count).toBe(1)
    expect(await notificationsFor(site.admin.id, site.title)).toHaveLength(1)
  })

  it('sweeps one organisation when asked for one, so a re-run cannot touch another provider', async () => {
    const one = await reviewSite()
    const two = await reviewSite()

    const count = await ReviewNotificationService.checkOverdueReviews(one.org.id)

    expect(count).toBe(2)
    expect(await notificationsFor(one.admin.id, one.title)).toHaveLength(1)
    expect(await notificationsFor(two.admin.id, two.title)).toHaveLength(0)
    expect(await notificationsFor(two.manager!.id, two.title)).toHaveLength(0)
  })
})
