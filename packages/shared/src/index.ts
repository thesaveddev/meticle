// UserRole lives in ./roles so the generated page-access table can type its roles
// as the enum; imported here for local use and re-exported so every consumer's
// import path is unchanged.
import { UserRole } from './roles';
export * from './roles';

export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled'
}

export enum Plan {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
}

export type HomecareVisitStatus = 'scheduled' | 'en_route' | 'checked_in' | 'completed' | 'missed' | 'cancelled';
export type HomecarePackageStatus = 'draft' | 'active' | 'paused' | 'ended';

export interface Organization {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  onboardingStep: number;
  onboardingCompleted: boolean;
  createdAt: Date;
}

// Every page's access, derived from the router by scripts/design/route-access.mjs.
// It lives here rather than in either app because both need the same answer: the
// web app routes on it and the API's Mica offers pages from it.
export * from './pageAccess.generated';

// The link to one saved record, and the query parameter each page reads to open
// it. Shared for the same reason as the table above: the API composes the link
// and the page reads it, so the two ends must not be able to disagree.
export * from './micaDeepLinks';
