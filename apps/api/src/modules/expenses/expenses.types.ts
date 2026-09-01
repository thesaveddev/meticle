export enum ExpenseMoneySource {
  HOUSE = 'house',
  PERSON = 'person',
}

export enum ExpenseCategory {
  FOOD = 'food',
  CLOTHING = 'clothing',
  ACTIVITIES = 'activities',
  TRANSPORT = 'transport',
  PERSONAL = 'personal',
  HEALTH = 'health',
  OTHER = 'other',
}

export enum PettyCashTransactionType {
  TOP_UP = 'top_up',
  RECONCILIATION = 'reconciliation',
  ADJUSTMENT = 'adjustment',
}

export interface Expense {
  id: string;
  organization_id: string;
  person_id?: string;
  person_name?: string;
  money_source: ExpenseMoneySource;
  payment_method?: string;
  location_id?: string;
  location_name?: string;
  category: ExpenseCategory;
  amount_pence: number;
  description?: string;
  receipt_url?: string;
  incurred_date: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  is_voided?: boolean;
  void_reason?: string;
  voided_by?: string;
  voided_by_name?: string;
  voided_at?: string;
  updated_by?: string;
}

export interface ExpenseInput {
  person_id?: string;
  location_id?: string;
  money_source: ExpenseMoneySource;
  payment_method?: string;
  category: ExpenseCategory;
  amount_pence: number;
  description?: string;
  receipt_url?: string;
  incurred_date: string;
}

export interface PettyCashBalance {
  id: string;
  organization_id: string;
  location_id: string;
  location_name?: string;
  current_balance_pence: number;
  last_reconciled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PettyCashTransaction {
  id: string;
  organization_id: string;
  location_id: string;
  location_name?: string;
  type: PettyCashTransactionType;
  amount_pence: number;
  previous_balance_pence: number;
  new_balance_pence: number;
  notes?: string;
  performed_by?: string;
  performed_by_name?: string;
  created_at: string;
}

export interface ExpenseStats {
  total_expenses: number;
  total_amount_pounds: number;
  by_category: { category: ExpenseCategory; count: number; total_pounds: number }[];
  by_person: { person_id: string; person_name: string; count: number; total_pounds: number }[];
  by_location: { location_id: string; location_name: string; total_pounds: number }[];
  period_start: string;
  period_end: string;
}
