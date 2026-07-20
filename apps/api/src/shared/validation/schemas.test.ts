import { describe, it, expect } from 'vitest';
import {
  createOrganizationSchema,
  createLocationSchema,
  createStaffProfileSchema,
  createShiftSchema,
  inviteStaffSchema,
  uploadDocumentSchema,
  registerSchema,
  loginSchema,
  updateStaffRoleSchema,
  updateStaffStatusSchema,
  updateStaffDepartmentSchema,
  reviewLeaveRequestSchema,
  updatePlanSchema,
  createManagerDelegationSchema,
} from './schemas';

describe('validation schemas', () => {
  describe('createOrganizationSchema', () => {
    it('should accept valid data', () => {
      const result = createOrganizationSchema.safeParse({ name: 'Test Org' });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = createOrganizationSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing name', () => {
      const result = createOrganizationSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('createLocationSchema', () => {
    it('should accept valid data', () => {
      const result = createLocationSchema.safeParse({ name: 'Main Office', address: '123 Street' });
      expect(result.success).toBe(true);
    });

    it('should accept data without address', () => {
      const result = createLocationSchema.safeParse({ name: 'Main Office' });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = createLocationSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('createStaffProfileSchema', () => {
    it('should accept valid data', () => {
      const result = createStaffProfileSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid uuid', () => {
      const result = createStaffProfileSchema.safeParse({
        user_id: 'not-a-uuid',
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createShiftSchema', () => {
    it('should accept valid data', () => {
      const result = createShiftSchema.safeParse({
        location_id: '123e4567-e89b-12d3-a456-426614174000',
        start_time: '2025-01-01T08:00:00Z',
        end_time: '2025-01-01T20:00:00Z',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('inviteStaffSchema', () => {
    it('should accept valid data', () => {
      const result = inviteStaffSchema.safeParse({ email: 'test@example.com', role: 'MANAGER' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = inviteStaffSchema.safeParse({ email: 'not-an-email', role: 'MANAGER' });
      expect(result.success).toBe(false);
    });
  });

  describe('uploadDocumentSchema', () => {
    it('should accept valid data', () => {
      const result = uploadDocumentSchema.safeParse({
        staffId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'DBS',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('registerSchema', () => {
    it('should accept valid registration', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123!',
        role: 'CARE_WORKER',
        name: 'John Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const result = registerSchema.safeParse({
        password: 'Password123!',
        role: 'CARE_WORKER',
        name: 'John Doe',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: 'pass' });
      expect(result.success).toBe(true);
    });

    it('should reject missing password', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateStaffRoleSchema', () => {
    it('should accept valid role', () => {
      const result = updateStaffRoleSchema.safeParse({ role: 'MANAGER' });
      expect(result.success).toBe(true);
    });

    it('should reject empty role', () => {
      const result = updateStaffRoleSchema.safeParse({ role: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateStaffStatusSchema', () => {
    it('should accept active', () => {
      const result = updateStaffStatusSchema.safeParse({ status: 'active' });
      expect(result.success).toBe(true);
    });

    it('should accept deactivated', () => {
      const result = updateStaffStatusSchema.safeParse({ status: 'deactivated' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = updateStaffStatusSchema.safeParse({ status: 'unknown' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateStaffDepartmentSchema', () => {
    it('should accept uuid', () => {
      const result = updateStaffDepartmentSchema.safeParse({ department_id: '123e4567-e89b-12d3-a456-426614174000' });
      expect(result.success).toBe(true);
    });

    it('should accept null (unassign)', () => {
      const result = updateStaffDepartmentSchema.safeParse({ department_id: null });
      expect(result.success).toBe(true);
    });
  });

  describe('reviewLeaveRequestSchema', () => {
    it('should accept approved', () => {
      const result = reviewLeaveRequestSchema.safeParse({ status: 'approved' });
      expect(result.success).toBe(true);
    });

    it('should accept rejected', () => {
      const result = reviewLeaveRequestSchema.safeParse({ status: 'rejected' });
      expect(result.success).toBe(true);
    });

    it('should reject unknown status', () => {
      const result = reviewLeaveRequestSchema.safeParse({ status: 'pending' });
      expect(result.success).toBe(false);
    });
  });

  describe('updatePlanSchema', () => {
    it('should accept starter', () => {
      const result = updatePlanSchema.safeParse({ plan: 'starter' });
      expect(result.success).toBe(true);
    });

    it('should accept professional', () => {
      const result = updatePlanSchema.safeParse({ plan: 'professional' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid plan', () => {
      const result = updatePlanSchema.safeParse({ plan: 'enterprise' });
      expect(result.success).toBe(false);
    });
  });

  describe('createManagerDelegationSchema', () => {
    it('should accept valid delegation', () => {
      const result = createManagerDelegationSchema.safeParse({
        primary_manager_id: '123e4567-e89b-12d3-a456-426614174000',
        delegate_manager_id: '223e4567-e89b-12d3-a456-426614174001',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing delegate', () => {
      const result = createManagerDelegationSchema.safeParse({
        primary_manager_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(false);
    });
  });
});
