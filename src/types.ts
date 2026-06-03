export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  timezone: string;
}

export type AccountType = 'personal' | 'funded' | 'demo' | 'other';
export type BrokerType = 'ninjatrader' | 'tradovate' | 'mt4' | 'mt5' | 'tradingview' | 'generic';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  broker: BrokerType;
  account_number?: string;
  currency: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  color?: string;
  api_key?: string;
  api_secret?: string;
}

export type TradeDirection = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';
export type AssetClassType = 'futures' | 'forex' | 'crypto' | 'stocks' | 'options';

export interface Trade {
  id: string;
  user_id: string;
  account_id: string;
  broker_trade_id?: string | null;
  symbol: string;
  asset_class: AssetClassType;
  direction: TradeDirection;
  entry_price: number;
  exit_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  quantity: number;
  entry_time: string; // ISO String
  exit_time: string;  // ISO String
  gross_pnl: number;
  commission: number;
  net_pnl: number;
  status: TradeStatus;
  import_source: 'manual' | 'csv' | 'tradovate_api';
  raw_data?: any;
  notes?: string;
  tags?: string[];
  rating?: number | null; // 1-5 stars
  emotions?: string[];
  lessons?: string[];
  screenshot_url?: string | null;
}

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
