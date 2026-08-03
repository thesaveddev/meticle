import { Request, Response } from 'express';
import { HealthRepository } from './health.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';

export class HealthController {
  // === Health Observations ===
  static async getObservations(req: Request, res: Response) {
    const { personId } = req.params;
    const observations = await HealthRepository.findObservations(personId);
    res.json(observations);
  }

  static async createObservation(req: Request, res: Response) {
    const { personId } = req.params;
    const observation = await HealthRepository.createObservation({
      ...req.body,
      person_id: personId,
      recorded_by: req.user!.userId,
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'health_observation', entity_id: observation.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(observation);
  }

  static async deleteObservation(req: Request, res: Response) {
    const { personId, id } = req.params;
    await HealthRepository.deleteObservation(id, personId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'health_observation', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Observation deleted' });
  }

  static async updateObservation(req: Request, res: Response) {
    const { personId, id } = req.params;
    const updated = await HealthRepository.updateObservation(id, personId, req.body);
    if (!updated) throw new AppError(404, 'Observation not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'health_observation', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  // === Bowel Movements ===
  static async getBowelMovements(req: Request, res: Response) {
    const { personId } = req.params;
    const { dateFrom, dateTo } = req.query as any;
    const movements = await HealthRepository.findBowelMovements(personId, dateFrom, dateTo);
    res.json(movements);
  }

  static async createBowelMovement(req: Request, res: Response) {
    const { personId } = req.params;
    const movement = await HealthRepository.createBowelMovement({
      ...req.body,
      person_id: personId,
      recorded_by: req.user!.userId,
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'bowel_movement', entity_id: movement.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(movement);
  }

  static async deleteBowelMovement(req: Request, res: Response) {
    const { personId, id } = req.params;
    await HealthRepository.deleteBowelMovement(id, personId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'bowel_movement', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Bowel movement deleted' });
  }

  static async updateBowelMovement(req: Request, res: Response) {
    const { personId, id } = req.params;
    const updated = await HealthRepository.updateBowelMovement(id, personId, req.body);
    if (!updated) throw new AppError(404, 'Bowel movement not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'bowel_movement', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  // === Dental Records ===
  static async getDentalRecords(req: Request, res: Response) {
    const { personId } = req.params;
    const records = await HealthRepository.findDentalRecords(personId);
    res.json(records);
  }

  static async createDentalRecord(req: Request, res: Response) {
    const { personId } = req.params;
    const record = await HealthRepository.createDentalRecord({
      ...req.body,
      person_id: personId,
      recorded_by: req.user!.userId,
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'dental_record', entity_id: record.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(record);
  }

  static async deleteDentalRecord(req: Request, res: Response) {
    const { personId, id } = req.params;
    await HealthRepository.deleteDentalRecord(id, personId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'dental_record', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Dental record deleted' });
  }

  static async updateDentalRecord(req: Request, res: Response) {
    const { personId, id } = req.params;
    const updated = await HealthRepository.updateDentalRecord(id, personId, req.body);
    if (!updated) throw new AppError(404, 'Dental record not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'dental_record', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  // === Fluid Intake ===
  static async getFluidIntake(req: Request, res: Response) {
    const { personId } = req.params;
    const { date } = req.query as any;
    const intake = await HealthRepository.findFluidIntake(personId, date);
    res.json(intake);
  }

  static async getDailyFluidTotal(req: Request, res: Response) {
    const { personId } = req.params;
    const { date } = req.query as any;
    if (!date) throw new AppError(400, 'Date query param required');
    const total = await HealthRepository.getDailyFluidTotal(personId, date);
    res.json(total);
  }

  static async createFluidIntake(req: Request, res: Response) {
    const { personId } = req.params;
    const intake = await HealthRepository.createFluidIntake({
      ...req.body,
      person_id: personId,
      recorded_by: req.user!.userId,
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'fluid_intake', entity_id: intake.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(intake);
  }

  static async deleteFluidIntake(req: Request, res: Response) {
    const { personId, id } = req.params;
    await HealthRepository.deleteFluidIntake(id, personId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'fluid_intake', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Fluid intake deleted' });
  }

  static async updateFluidIntake(req: Request, res: Response) {
    const { personId, id } = req.params;
    const updated = await HealthRepository.updateFluidIntake(id, personId, req.body);
    if (!updated) throw new AppError(404, 'Fluid intake not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'fluid_intake', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }
}
