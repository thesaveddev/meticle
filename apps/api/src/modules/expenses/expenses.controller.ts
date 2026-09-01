import { Request, Response } from 'express';
import {
  createExpense, getExpenses, getExpense, updateExpense, voidExpense, getExpenseStats,
  getPettyCashBalances, topUpPettyCash, reconcilePettyCash, getPettyCashTransactions, dailyCashCheck, getDailyCashChecks, getExpenseReport,
} from './expenses.service';

export class ExpensesController {
  static async create(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const expense = await createExpense(orgId, userId, {
      person_id: req.body.personId,
      location_id: req.body.locationId,
      money_source: req.body.moneySource,
      payment_method: req.body.paymentMethod,
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
      person_id: req.query.personId as string,
      location_id: req.query.locationId as string,
      money_source: req.query.moneySource as string,
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
    const userId = req.user!.userId;
    // Only description and category may be edited after creation
    const expense = await updateExpense(orgId, req.params.id, {
      category: req.body.category,
      description: req.body.description,
    }, userId);
    res.json(expense);
  }

  static async void(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const { reason } = req.body;
    if (!reason || reason.trim().length < 3) {
      res.status(400).json({ error: 'A reason is required to void an expense entry' });
      return;
    }
    const expense = await voidExpense(orgId, req.params.id, userId, reason.trim());
    res.json(expense);
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
    const result = await topUpPettyCash(orgId, userId, req.body, req.body.amountPence, req.body.notes);
    res.status(201).json(result);
  }

  static async reconcile(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const result = await reconcilePettyCash(orgId, userId, req.body, req.body.actualBalancePence, req.body.notes);
    res.json(result);
  }

  static async dailyCashCheck(req: Request, res: Response) {
    const result = await dailyCashCheck(req.user!.organizationId!, req.user!.userId, req.body);
    res.status(201).json(result);
  }

  static async getDailyCashChecks(req: Request, res: Response) {
    res.json(await getDailyCashChecks(req.user!.organizationId!, req.query as any));
  }

  static async report(req: Request, res: Response) {
    const report = await getExpenseReport(req.user!.organizationId!, req.query as any);
    res.json(report);
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
