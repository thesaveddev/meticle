import { Request, Response } from 'express';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';
import logger from '../../shared/utils/logger';
import { SERVICE_TYPES } from '../../shared/validation/schemas';

export class OrganizationController {
  static async updateOrganization(req: Request, res: Response) {
    const user = req.user!;
    const orgId = req.params.id || user.organizationId;

    if (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new AppError(403, 'Only administrators can update organisation details');
    }

    // ORG_ADMIN can only update their own org
    if (user.role === 'ORG_ADMIN' && user.organizationId !== orgId) {
      throw new AppError(403, 'You can only update your own organisation');
    }

    const { name, service_types, primary_service_type, onboarding_completed } = req.body;

    const current = await pool.query(
      'SELECT service_types, primary_service_type, onboarding_completed FROM organizations WHERE id = $1',
      [orgId],
    );
    if (current.rows.length === 0) throw new AppError(404, 'Organisation not found');

    const nextServiceTypes = service_types ?? current.rows[0].service_types ?? [];
    const nextPrimary = primary_service_type ?? current.rows[0].primary_service_type;
    if (!Array.isArray(nextServiceTypes) || nextServiceTypes.length === 0) {
      throw new AppError(400, 'Select at least one service type before completing onboarding');
    }
    if (!nextServiceTypes.every((type: string) => (SERVICE_TYPES as readonly string[]).includes(type))) {
      throw new AppError(400, 'Invalid service type');
    }
    if (nextPrimary && !nextServiceTypes.includes(nextPrimary)) {
      throw new AppError(400, 'Primary service type must be one of the selected service types');
    }
    if (onboarding_completed === true && !nextPrimary) {
      throw new AppError(400, 'Choose a primary service type before completing onboarding');
    }

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name); }
    if (service_types !== undefined) { sets.push(`service_types = $${idx++}`); params.push(service_types); }
    if (primary_service_type !== undefined) { sets.push(`primary_service_type = $${idx++}`); params.push(primary_service_type); }
    if (onboarding_completed !== undefined) { sets.push(`onboarding_completed = $${idx++}`); params.push(onboarding_completed); }
    if (sets.length === 0) {
      throw new AppError(400, 'No fields to update');
    }

    sets.push(`updated_at = NOW()`);
    params.push(orgId);

    const result = await pool.query(
      `UPDATE organizations SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, service_types, primary_service_type, onboarding_completed, default_hourly_rate_pence, default_mileage_rate_pence`,
      params,
    );


    if (result.rows.length === 0) {
      throw new AppError(404, 'Organisation not found');
    }

    AuditRepository.log({
      user_id: user.userId,
      action: 'UPDATE_ORGANIZATION',
      entity_type: 'organization',
      entity_id: orgId,
      new_data: req.body,
      ip_address: req.ip,
    }).catch((err: any) => logger.warn({ err }, 'Audit log failed'));

    res.json(result.rows[0]);
  }
}
