/**
 * Core Type Definitions for Expense Tracker AI Frontend
 */

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  is_active?: boolean;
  created_at?: string;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Debit Card' | 'Credit Card' | 'Wallet' | 'Bank Transfer';
export type TransactionType = 'Expense' | 'Income';
export type TransactionSource = 'Manual' | 'SMS' | 'Notification' | 'Receipt';

export interface Account {
  id: string;
  name: string;
  type: 'Cash' | 'Bank' | 'Wallet' | 'Credit Card';
  balance: number;
  currency: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  is_custom?: boolean;
}

export interface Transaction {
  id: string;
  user_id?: string;
  account_id: string;
  category_id?: string | null;
  amount: number;
  merchant: string;
  type: TransactionType;
  notes?: string | null;
  payment_method: PaymentMethod;
  date: string;
  tags?: string[] | null;
  is_recurring?: boolean;
  raw_source?: TransactionSource;
  ref_number?: string | null;
  category?: Category | null;
  account?: Account | null;
}

export interface Budget {
  id: string;
  category_id?: string | null;
  amount: number;
  period: 'Monthly' | 'Weekly' | 'Yearly';
  start_date: string;
  end_date: string;
  spent?: number;
  percentage?: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  billing_period: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  next_billing_date: string;
  is_active: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'BudgetAlert' | 'SubscriptionRenewal' | 'DailyReminder' | 'System';
  is_read: boolean;
  created_at: string;
}

export interface AnalyticsSummary {
  today_spending: number;
  weekly_spending: number;
  monthly_spending: number;
  remaining_budget: number;
  category_breakdown: Array<{
    category_id: string;
    category_name: string;
    total: number;
    color: string;
  }>;
  recent_transactions: Transaction[];
  top_categories: Array<{
    name: string;
    amount: number;
    color: string;
  }>;
  ai_insights: Array<{
    id: string;
    title: string;
    description: string;
    actionable_tip?: string;
  }>;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  AddTransaction: { transaction?: Transaction } | undefined;
  ScanReceipt: undefined;
  AIAssistantChat: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Scan: undefined;
  Notifications: undefined;
  Settings: undefined;
};
