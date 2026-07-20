export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  MANAGER = 'MANAGER',
  CARE_WORKER = 'CARE_WORKER',
  COMPLIANCE_OFFICER = 'COMPLIANCE_OFFICER'
}

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
