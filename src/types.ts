export type Profile = any;
export type AccountType = 'personal' | 'funded' | 'demo' | 'other';
export type BrokerType = 'ninjatrader' | 'tradovate' | 'mt4' | 'mt5' | 'tradingview' | 'generic';

export enum AssetType {
  FUTURES = "Futures",
  FOREX = "Forex",
  CRYPTO = "Crypto",
  STOCK = "Stock",
  OPTIONS = "Options",
  OPTION = "Options" // Alias for single vs plural
}

export enum TradeAction {
  BUY = "Buy",
  SELL = "Sell"
}

export type Account = any;

export type TradeDirection = 'long' | 'short';
export type TradeStatus = 'open' | 'closed' | 'Win' | 'Loss' | 'Flat' | string;
export type AssetClassType = 'futures' | 'forex' | 'crypto' | 'stocks' | 'options';

export type Trade = any;

export interface DailyStats {
  id: string;
  user_id: string;
  account_id: string;
  date: string; // YYYY-MM-DD
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number; // 0-100
  net_pnl: number;
  profit_factor: number;
}

export interface ImportLog {
  id: string;
  user_id: string;
  account_id: string;
  source: string;
  file_name: string;
  total_trades: number;
  imported_trades: number;
  skipped_trades: number;
  status: 'success' | 'failed';
  created_at?: string;
}

export interface AICoachReport {
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  tacticalPlan: string[];
  setupFocus: { setup: string; reason: string }[];
  disciplineAdvice: string;
}

export type CoachGoal = 'general' | 'discipline' | 'habits' | 'breakdowns' | string;
