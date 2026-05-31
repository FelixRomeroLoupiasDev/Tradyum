/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum AssetType {
  STOCK = "Stock",
  OPTION = "Option",
  CRYPTO = "Crypto",
  FOREX = "Forex",
  FUTURES = "Futures"
}

export enum TradeAction {
  BUY = "Buy",
  SELL = "Sell"
}

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  symbol: string;
  assetType: AssetType;
  action: TradeAction;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  commissions: number;
  fees: number;
  setups: string[]; // e.g., "Breakout", "EMA Pullback", etc.
  mistakes: string[]; // e.g., "FOMO", "Chased Entry", etc.
  notes: string;
  pnl: number; // Gross P&L details (Calculated)
  netPnl: number; // Net P&L details (Calculated as pnl - commissions - fees)
  status: "Win" | "Loss" | "Flat";
  accountId?: string;
  screenshot?: string;
}

export interface CalendarDaySummary {
  date: string; // YYYY-MM-DD
  pnl: number;
  netPnl: number;
  tradeCount: number;
  winCount: number;
}

export interface DashboardMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  flatTrades: number;
  winRate: number; // in %
  profitFactor: number;
  netPnl: number;
  grossPnl: number;
  avgWin: number;
  avgLoss: number;
  totalCommissions: number;
  totalFees: number;
}

export interface SetupPerformance {
  setup: string;
  tradeCount: number;
  winRate: number;
  netPnl: number;
}

export interface MistakeFrequency {
  mistake: string;
  count: number;
  totalCost: number; // Net P&L loss attributed to these trades
}

export type CoachGoal = "breakdowns" | "habits" | "discipline" | "general";

export interface AICoachReport {
  overallScore: number; // 0-100 score based on discipline
  summary: string;
  strengths: string[];
  weaknesses: string[];
  tacticalPlan: string[];
  setupFocus: { setup: string; reason: string }[];
  disciplineAdvice: string;
}

export interface Account {
  id: string;
  name: string;
  type: string; // e.g., "Fondeo" | "Demo" | "Real"
  balance: number;
  initialBalance: number;
  status: "Activa" | "Inactiva";
}

export interface JournalEntry {
  id: string;
  date: string;
  time: string;
  title: string;
  content: string;
  associatedSymbol?: string;
}

