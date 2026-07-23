import { Request, Response } from 'express';
import {
  createExpense, getExpenses, getExpense, updateExpense, deleteExpense, getExpenseStats,
  getPettyCashBalances, topUpPettyCash, reconcilePettyCash, getPettyCashTransactions,
} from './expenses.service';

export class ExpensesController {
  static async create(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const expense = await createExpense(orgId, userId, {
      service_user_id: req.body.serviceUserId,
      location_id: req.body.locationId,
      category: req.body.category,
      amount_pence: req.body.amountPence,
      description: req.body.description,
      receipt_url: req.body.receiptUrl,
      incurred_date: req.body.incurredDate,
    });
    res.status(201).json(expense);
  }

  static async list(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const expenses = await getExpenses(orgId, {
      service_user_id: req.query.serviceUserId as string,
      location_id: req.query.locationId as string,
      category: req.query.category as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(expenses);
  }

  static async get(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const expense = await getExpense(orgId, req.params.id);
    res.json(expense);
  }

  static async update(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const expense = await updateExpense(orgId, req.params.id, {
      service_user_id: req.body.serviceUserId,
      location_id: req.body.locationId,
      category: req.body.category,
      amount_pence: req.body.amountPence,
      description: req.body.description,
      receipt_url: req.body.receiptUrl,
      incurred_date: req.body.incurredDate,
    });
    res.json(expense);
  }

  static async remove(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    await deleteExpense(orgId, req.params.id);
    res.status(204).send();
  }

  static async stats(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const stats = await getExpenseStats(orgId, req.query.from as string, req.query.to as string);
    res.json(stats);
  }

  static async getBalances(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const balances = await getPettyCashBalances(orgId, req.query.locationId as string);
    res.json(balances);
  }

  static async topUp(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const result = await topUpPettyCash(orgId, userId, req.body.locationId, req.body.amountPence, req.body.notes);
    res.status(201).json(result);
  }

  static async reconcile(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const result = await reconcilePettyCash(orgId, userId, req.body.locationId, req.body.actualBalancePence, req.body.notes);
    res.json(result);
  }

  static async getTransactions(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const transactions = await getPettyCashTransactions(orgId, {
      location_id: req.query.locationId as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(transactions);
  }
}
