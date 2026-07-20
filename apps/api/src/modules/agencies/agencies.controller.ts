import { Request, Response } from 'express';
import { AgenciesRepository } from './agencies.repository';
import { AppError } from '../../shared/middleware/error.middleware';

export class AgenciesController {
  // ── Agencies CRUD ──
  static async getAll(req: Request, res: Response) {
    const user = req.user!;
    const agencies = await AgenciesRepository.getAll(user.organizationId!);
    res.json(agencies);
  }

  static async getById(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const agency = await AgenciesRepository.getById(id, user.organizationId!);
    if (!agency) throw new AppError(404, 'Agency not found');
    res.json(agency);
  }

  static async create(req: Request, res: Response) {
    const user = req.user!;
    const { name, contact_name, contact_phone, contact_email, address, notes, status, contract_start_date, contract_end_date } = req.body;
    if (!name || !name.trim()) throw new AppError(400, 'Agency name is required');
    const agency = await AgenciesRepository.create(
      { name: name.trim(), contact_name, contact_phone, contact_email, address, notes, status, contract_start_date, contract_end_date },
      user.organizationId!
    );
    res.status(201).json(agency);
  }

  static async update(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { name, contact_name, contact_phone, contact_email, address, notes, status, contract_start_date, contract_end_date } = req.body;
    const agency = await AgenciesRepository.update(id, { name, contact_name, contact_phone, contact_email, address, notes, status, contract_start_date, contract_end_date }, user.organizationId!);
    if (!agency) throw new AppError(404, 'Agency not found');
    res.json(agency);
  }

  static async delete(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const deleted = await AgenciesRepository.delete(id, user.organizationId!);
    if (!deleted) throw new AppError(404, 'Agency not found');
    res.json({ message: 'Agency deleted' });
  }

  // ── Workers ──
  static async getWorkers(req: Request, res: Response) {
    const user = req.user!;
    const { agencyId } = req.params;
    const workers = await AgenciesRepository.getWorkers(agencyId, user.organizationId!);
    res.json(workers);
  }

  static async getAllWorkers(req: Request, res: Response) {
    const user = req.user!;
    const workers = await AgenciesRepository.getAllWorkers(user.organizationId!);
    res.json(workers);
  }

  static async getWorkerById(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const worker = await AgenciesRepository.getWorkerById(id, user.organizationId!);
    if (!worker) throw new AppError(404, 'Worker not found');
    res.json(worker);
  }

  static async createWorker(req: Request, res: Response) {
    const user = req.user!;
    const { agency_id, first_name, last_name, role, phone, email, dbs_check_date, dbs_expiry_date, mandatory_training_completed, status, rating, notes } = req.body;
    if (!agency_id || !first_name || !last_name) throw new AppError(400, 'Agency ID, first name, and last name are required');
    const worker = await AgenciesRepository.createWorker(
      { agency_id, first_name, last_name, role, phone, email, dbs_check_date, dbs_expiry_date, mandatory_training_completed, status, rating, notes },
      user.organizationId!
    );
    res.status(201).json(worker);
  }

  static async updateWorker(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { first_name, last_name, role, phone, email, dbs_check_date, dbs_expiry_date, mandatory_training_completed, status, rating, notes } = req.body;
    const worker = await AgenciesRepository.updateWorker(id, { first_name, last_name, role, phone, email, dbs_check_date, dbs_expiry_date, mandatory_training_completed, status, rating, notes }, user.organizationId!);
    if (!worker) throw new AppError(404, 'Worker not found');
    res.json(worker);
  }

  static async deleteWorker(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const deleted = await AgenciesRepository.deleteWorker(id, user.organizationId!);
    if (!deleted) throw new AppError(404, 'Worker not found');
    res.json({ message: 'Worker deleted' });
  }

  // ── Rates ──
  static async getRates(req: Request, res: Response) {
    const user = req.user!;
    const { agencyId } = req.params;
    const rates = await AgenciesRepository.getRates(agencyId, user.organizationId!);
    res.json(rates);
  }

  static async getAllRates(req: Request, res: Response) {
    const user = req.user!;
    const rates = await AgenciesRepository.getAllRates(user.organizationId!);
    res.json(rates);
  }

  static async upsertRate(req: Request, res: Response) {
    const user = req.user!;
    const { agency_id, shift_type, rate_per_hour, effective_from, effective_to } = req.body;
    if (!agency_id || !shift_type || !rate_per_hour) throw new AppError(400, 'Agency ID, shift type, and rate per hour are required');
    const rate = await AgenciesRepository.upsertRate({ agency_id, shift_type, rate_per_hour, effective_from, effective_to }, user.organizationId!);
    res.status(201).json(rate);
  }

  static async deleteRate(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const deleted = await AgenciesRepository.deleteRate(id, user.organizationId!);
    if (!deleted) throw new AppError(404, 'Rate not found');
    res.json({ message: 'Rate deleted' });
  }

  // ── Shift History ──
  static async getShiftHistory(req: Request, res: Response) {
    const user = req.user!;
    const { agency_id, status, date_from, date_to } = req.query;
    const history = await AgenciesRepository.getShiftHistory(user.organizationId!, {
      agency_id: agency_id as string | undefined,
      status: status as string | undefined,
      date_from: date_from as string | undefined,
      date_to: date_to as string | undefined,
    });
    res.json(history);
  }

  // ── Analytics ──
  static async getSavings(req: Request, res: Response) {
    const user = req.user!;
    const { date_from, date_to } = req.query;
    const savings = await AgenciesRepository.getSavings(user.organizationId!, date_from as string | undefined, date_to as string | undefined);
    res.json(savings);
  }

  static async getSavingsByMonth(req: Request, res: Response) {
    const user = req.user!;
    const { months } = req.query;
    const data = await AgenciesRepository.getSavingsByMonth(user.organizationId!, parseInt(months as string) || 6);
    res.json(data);
  }

  static async getSavingsByAgency(req: Request, res: Response) {
    const user = req.user!;
    const data = await AgenciesRepository.getSavingsByAgency(user.organizationId!);
    res.json(data);
  }
}
