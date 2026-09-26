/**
 * Open calls has two audiences and they used to overlap. A manager of a
 * domiciliary agency was shown the marketplace — the same shifts they are asked
 * to approve claims on — because the only condition was the organisation type.
 * These tests pin the split down.
 */
import { canApproveOpenCalls, canClaimOpenCalls } from '../openCalls'
import type { MobileUser, SessionOrganisation } from '../../types'

const carer: MobileUser = { id: 'u1', email: 'carer@example.com', role: 'CARE_WORKER' }
const manager: MobileUser = { id: 'u2', email: 'manager@example.com', role: 'MANAGER' }
const admin: MobileUser = { id: 'u3', email: 'admin@example.com', role: 'ORG_ADMIN' }
const compliance: MobileUser = { id: 'u4', email: 'comp@example.com', role: 'COMPLIANCE_OFFICER' }

const domiciliary: SessionOrganisation = { id: 'o1', name: 'Brightwater', service_types: ['domiciliary'] }
const liveIn: SessionOrganisation = { id: 'o2', name: 'Brightwater', service_types: ['live_in'] }
const supported: SessionOrganisation = { id: 'o3', name: 'Bridge House', service_types: ['supported_living'] }
const unstated: SessionOrganisation = { id: 'o4', name: 'Mystery' }

describe('canApproveOpenCalls', () => {
  it('is the roles that run a location', () => {
    expect(canApproveOpenCalls(manager)).toBe(true)
    expect(canApproveOpenCalls(admin)).toBe(true)
  })

  it('is not a care worker, and not nobody', () => {
    expect(canApproveOpenCalls(carer)).toBe(false)
    expect(canApproveOpenCalls(compliance)).toBe(false)
    expect(canApproveOpenCalls(null)).toBe(false)
    expect(canApproveOpenCalls(undefined)).toBe(false)
  })
})

describe('canClaimOpenCalls', () => {
  it('lets a care worker in a domiciliary agency pick shifts up', () => {
    expect(canClaimOpenCalls(carer, domiciliary)).toBe(true)
    expect(canClaimOpenCalls(carer, liveIn)).toBe(true)
  })

  it('hides the marketplace from a manager, even in the agency that runs it', () => {
    // The whole point: the people who approve these claims are not offered them.
    expect(canClaimOpenCalls(manager, domiciliary)).toBe(false)
    expect(canClaimOpenCalls(admin, domiciliary)).toBe(false)
  })

  it('hides it from supported living, which does not use open calls', () => {
    expect(canClaimOpenCalls(carer, supported)).toBe(false)
  })

  it('hides it from anyone whose organisation has not said it is domiciliary', () => {
    expect(canClaimOpenCalls(carer, unstated)).toBe(false)
    expect(canClaimOpenCalls(carer, null)).toBe(false)
    expect(canClaimOpenCalls(carer, undefined)).toBe(false)
  })

  it('hides it from a role that is neither carer nor manager', () => {
    expect(canClaimOpenCalls(compliance, domiciliary)).toBe(false)
  })

  it('never gives the marketplace and the queue to the same person', () => {
    const everyone: [MobileUser, SessionOrganisation | null | undefined][] = [
      [carer, domiciliary], [carer, supported], [carer, null],
      [manager, domiciliary], [admin, domiciliary], [compliance, domiciliary],
    ]
    for (const [user, organization] of everyone) {
      expect(canClaimOpenCalls(user, organization) && canApproveOpenCalls(user)).toBe(false)
    }
  })
})
