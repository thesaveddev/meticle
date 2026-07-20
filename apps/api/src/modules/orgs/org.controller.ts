import { Request, Response } from 'express';
import { OrgRepository } from './org.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { NotificationsController } from '../notifications/notifications.controller';
import { AuditRepository } from '../audit/audit.repository';
import pool from '../../shared/database';
import {
  requireLocationInOrg,
  requireTeamInOrg,
  requireDepartmentInOrg,
  findOrgScoped,
} from '../../shared/database/tenant';
import { logWarn } from '../../shared/utils/logger';

export class OrgController {
  static async createOrganization(req: Request, res: Response) {
    const { name } = req.body;
    const org = await OrgRepository.createOrg(name);
    res.status(201).json(org);
  }

  static async createLocation(req: Request, res: Response) {
    const user = req.user!;
    const { orgId } = req.params;
    if (orgId !== user.organizationId) throw new AppError(403, 'Access denied');
    const { name, address } = req.body;
    const location = await OrgRepository.createLocation(orgId, name, address);
    res.status(201).json(location);
  }

  static async getOrganization(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    if (id !== user.organizationId) throw new AppError(403, 'Access denied');
    const org = await OrgRepository.getOrgById(id);
    if (!org) throw new AppError(404, 'Organization not found');
    res.json(org);
  }

  static async updateOrganization(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    if (id !== user.organizationId) throw new AppError(403, 'Access denied');
    const updates = req.body;
    const org = await OrgRepository.updateOrg(id, updates);

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'UPDATE_ORGANIZATION',
      entity_type: 'organization',
      entity_id: id,
      new_data: updates,
      ip_address: req.ip,
    }).catch(logWarn('audit update organization'));

    res.json(org);
  }

  static async getLocationsByOrg(req: Request, res: Response) {
    const user = req.user!;
    const { orgId } = req.params;
    if (orgId !== user.organizationId) throw new AppError(403, 'Access denied');
    const locations = await OrgRepository.getLocationsByOrg(orgId);
    res.json(locations);
  }

  static async createDepartment(req: Request, res: Response) {
    const user = req.user!;
    const { locationId } = req.params;
    await requireLocationInOrg(user, locationId);
    const { name } = req.body;
    const department = await OrgRepository.createDepartment(locationId, name);

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'CREATE_DEPARTMENT',
      entity_type: 'department',
      new_data: { name, location_id: locationId },
      ip_address: req.ip,
    }).catch(logWarn('audit create department'));

    res.status(201).json(department);
  }

  static async getDepartmentsByLocation(req: Request, res: Response) {
    const user = req.user!;
    const { locationId } = req.params;
    await requireLocationInOrg(user, locationId);
    const departments = await OrgRepository.getDepartmentsByLocation(locationId);
    res.json(departments);
  }

  static async updateDepartment(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    await requireDepartmentInOrg(user, id);
    const { name } = req.body;
    const department = await OrgRepository.updateDepartment(id, name);
    res.json(department);
  }

  static async deleteDepartment(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    await requireDepartmentInOrg(user, id);
    await OrgRepository.deleteDepartment(id);

    AuditRepository.log({
      user_id: user.userId,
      action: 'DELETE_DEPARTMENT',
      entity_type: 'department',
      entity_id: id,
      ip_address: req.ip,
    }).catch(logWarn('audit delete department'));

    res.json({ message: 'Department deleted' });
  }

  static async getDepartmentById(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const department = await OrgRepository.getDepartmentById(id);
    if (!department) throw new AppError(404, 'Department not found');
    // Verify the department's location is in the user's org
    await requireDepartmentInOrg(user, id);
    res.json(department);
  }

  static async getTeams(req: Request, res: Response) {
    const user = req.user!;
    const { orgId } = req.params;
    if (orgId !== user.organizationId) throw new AppError(403, 'Access denied');
    const teams = await OrgRepository.getTeamsByOrg(orgId);
    res.json(teams);
  }

  static async createTeam(req: Request, res: Response) {
    const user = req.user!;
    const { orgId } = req.params;
    if (orgId !== user.organizationId) throw new AppError(403, 'Access denied');
    const { name, description } = req.body;
    const team = await OrgRepository.createTeam(orgId, name, description);

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'CREATE_TEAM',
      entity_type: 'team',
      new_data: { name, description, organization_id: orgId },
      ip_address: req.ip,
    }).catch(logWarn('audit create team'));

    res.status(201).json(team);
  }

  static async updateTeam(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    await requireTeamInOrg(user, id);
    const { name, description } = req.body;
    const team = await OrgRepository.updateTeam(id, name, description);
    res.json(team);
  }

  static async deleteTeam(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    await requireTeamInOrg(user, id);
    await OrgRepository.deleteTeam(id);

    AuditRepository.log({
      user_id: user.userId,
      action: 'DELETE_TEAM',
      entity_type: 'team',
      entity_id: id,
      ip_address: req.ip,
    }).catch(logWarn('audit delete team'));

    res.json({ message: 'Team deleted' });
  }

  static async getTeamMembers(req: Request, res: Response) {
    const user = req.user!;
    const { teamId } = req.params;
    await requireTeamInOrg(user, teamId);
    const members = await OrgRepository.getTeamMembers(teamId);
    res.json(members);
  }

  static async addTeamMember(req: Request, res: Response) {
    const user = req.user!;
    const { teamId } = req.params;
    await requireTeamInOrg(user, teamId);
    const { userId, role } = req.body;
    const member = await OrgRepository.addTeamMember(teamId, userId, role);
    // Notify the assigned user
    const teamRes = await pool.query('SELECT name FROM teams WHERE id = $1', [teamId]);
    const teamName = teamRes.rows[0]?.name || 'a team';
    NotificationsController.createNotification(
      userId,
      'Team Assigned',
      `You have been assigned to the ${teamName} team.`,
      'info'
    ).catch(logWarn('team assigned notification'));

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'ADD_TEAM_MEMBER',
      entity_type: 'team_member',
      entity_id: member?.id,
      new_data: { team_id: teamId, user_id: userId, role },
      ip_address: req.ip,
    }).catch(logWarn('audit add team member'));

    res.status(201).json(member);
  }

  static async removeTeamMember(req: Request, res: Response) {
    const user = req.user!;
    const { teamId, userId } = req.params;
    await requireTeamInOrg(user, teamId);
    await OrgRepository.removeTeamMember(teamId, userId);
    // Notify the removed user
    const teamRes = await pool.query('SELECT name FROM teams WHERE id = $1', [teamId]);
    const teamName = teamRes.rows[0]?.name || 'a team';
    NotificationsController.createNotification(
      userId,
      'Team Removed',
      `You have been removed from the ${teamName} team.`,
      'info'
    ).catch(logWarn('team removed notification'));

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'REMOVE_TEAM_MEMBER',
      entity_type: 'team_member',
      new_data: { team_id: teamId, user_id: userId },
      ip_address: req.ip,
    }).catch(logWarn('audit remove team member'));

    res.json({ message: 'Team member removed' });
  }

  static async updateBranding(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    if (id !== user.organizationId) throw new AppError(403, 'Access denied');
    const { logo_url, primary_color, secondary_color, accent_color } = req.body;
    const org = await OrgRepository.updateOrg(id, { logo_url, primary_color, secondary_color, accent_color });
    res.json(org);
  }

  static async getSubscription(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    if (id !== user.organizationId) throw new AppError(403, 'Access denied');
    const org = await OrgRepository.getOrgById(id);
    if (!org) throw new AppError(404, 'Organization not found');
    res.json({
      plan: org.plan,
      subscriptionStatus: org.subscription_status,
      trialEndsAt: org.trial_ends_at,
      daysRemaining: org.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0,
    });
  }
}
