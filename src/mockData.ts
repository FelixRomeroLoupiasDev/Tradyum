/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Trade, AssetType, TradeAction } from "./types";

export const INITIAL_TRADES: Trade[] = [
  {
    id: "trade-1",
    date: "2026-05-04",
    time: "09:45",
    symbol: "TSLA",
    assetType: AssetType.STOCK,
    action: TradeAction.BUY,
    quantity: 50,
    entryPrice: 185.50,
    exitPrice: 191.20,
    commissions: 4.95,
    fees: 1.50,
    setups: ["Breakout", "VWAP Bounce"],
    mistakes: [],
    notes: "Perfect entry as Tesla broke out above the 5-minute opening range with institutional volume. Scaled out near daily resistance.",
    pnl: 285.00, // (191.20 - 185.50) * 50
    netPnl: 278.55,
    status: "Win"
  },
  {
    id: "trade-2",
    date: "2026-05-04",
    time: "14:20",
    symbol: "NVDA",
    assetType: AssetType.STOCK,
    action: TradeAction.BUY,
    quantity: 20,
    entryPrice: 910.00,
    exitPrice: 895.00,
    commissions: 4.95,
    fees: 1.20,
    setups: ["EMA Pullback"],
    mistakes: ["FOMO", "Chased Entry"],
    notes: "Chased Nvidia at the highs because of a Twitter spike thread. Ignored my stop-loss initially. Lost discipline and panic sold at the bottom.",
    pnl: -300.00, // (895 - 910) * 20
    netPnl: -306.15,
    status: "Loss"
  },
  {
    id: "trade-3",
    date: "2026-05-08",
    time: "10:15",
    symbol: "BTCUSDT",
    assetType: AssetType.CRYPTO,
    action: TradeAction.BUY,
    quantity: 0.5,
    entryPrice: 64200.00,
    exitPrice: 65800.00,
    commissions: 10.00,
    fees: 4.50,
    setups: ["Support Bounce", "Trend Follow"],
    mistakes: [],
    notes: "Bitcoin daily candle bouncing of the 50 EMA. Sized reasonably, letting trend do the heavy lifting. Clean execution.",
    pnl: 800.00, // (65800 - 64200) * 0.5
    netPnl: 785.50,
    status: "Win"
  },
  {
    id: "trade-4",
    date: "2026-05-12",
    time: "11:30",
    symbol: "AAPL Jun 180C",
    assetType: AssetType.OPTION,
    action: TradeAction.BUY,
    quantity: 10,
    entryPrice: 3.50,
    exitPrice: 5.10,
    commissions: 6.50,
    fees: 2.10,
    setups: ["Breakout"],
    mistakes: [],
    notes: "Purchased Apple contracts as it broke above the critical $178 psychological magnet. Massive option delta acceleration.",
    pnl: 1600.00, // (5.10 - 3.50) * 10 * 100
    netPnl: 1591.40,
    status: "Win"
  },
  {
    id: "trade-5",
    date: "2026-05-15",
    time: "08:15",
    symbol: "EURUSD",
    assetType: AssetType.FOREX,
    action: TradeAction.SELL, // Short trade
    quantity: 100000, // 1 lot
    entryPrice: 1.0820,
    exitPrice: 1.0855,
    commissions: 5.00,
    fees: 0.00,
    setups: ["Resistance Reject"],
    mistakes: ["Moved Stop Loss"],
    notes: "Short EURUSD at London open on visual resistance. Price hovered and began pushing up. Instead of taking small loss, I dragged stop-loss higher. Leaked pips.",
    pnl: -350.00, // (1.0820 - 1.0855) * 100000
    netPnl: -355.00,
    status: "Loss"
  },
  {
    id: "trade-6",
    date: "2026-05-16",
    time: "10:00",
    symbol: "AAPL Jun 180C",
    assetType: AssetType.OPTION,
    action: TradeAction.BUY,
    quantity: 5,
    entryPrice: 4.80,
    exitPrice: 4.10,
    commissions: 3.25,
    fees: 1.05,
    setups: ["EMA Pullback"],
    mistakes: ["Overtrading"],
    notes: "Exceeded my daily trade quota. Attempted to force another trade on AAPL options without clear support lines.",
    pnl: -350.00, // (4.10 - 4.80) * 5 * 100
    netPnl: -354.30,
    status: "Loss"
  },
  {
    id: "trade-7",
    date: "2026-05-20",
    time: "15:45",
    symbol: "COIN",
    assetType: AssetType.STOCK,
    action: TradeAction.BUY,
    quantity: 40,
    entryPrice: 212.00,
    exitPrice: 224.50,
    commissions: 4.95,
    fees: 1.80,
    setups: ["VWAP Bounce", "Trend Follow"],
    mistakes: [],
    notes: "Excellent trend ride on Coinbase. Held right through afternoon consolidation. Profit target hit near market close.",
    pnl: 500.00, // (224.50 - 212.00) * 40
    netPnl: 493.25,
    status: "Win"
  },
  {
    id: "trade-8",
    date: "2026-05-22",
    time: "09:35",
    symbol: "NVDA",
    assetType: AssetType.STOCK,
    action: TradeAction.SELL, // Short seller
    quantity: 15,
    entryPrice: 940.00,
    exitPrice: 924.00,
    commissions: 4.95,
    fees: 1.40,
    setups: ["Resistance Reject"],
    mistakes: [],
    notes: "Shorted NVDA on opening gap fade system. Got clear immediate momentum downward. Trimmed early, left some profit on the table but secure win.",
    pnl: 240.00, // (940.00 - 924.00) * 15
    netPnl: 233.65,
    status: "Win"
  },
  {
    id: "trade-9",
    date: "2026-05-22",
    time: "13:10",
    symbol: "SOLUSDT",
    assetType: AssetType.CRYPTO,
    action: TradeAction.BUY,
    quantity: 50,
    entryPrice: 145.00,
    exitPrice: 144.50,
    commissions: 2.50,
    fees: 0.90,
    setups: ["Breakout"],
    mistakes: ["Early Exit"],
    notes: "Breakout trade on Solana. Got nervous is it hovered near entry and scratched/exited manually for a minuscule loss. Seconds after exit, it spiked to $152.",
    pnl: -25.00,
    netPnl: -28.40,
    status: "Loss"
  },
  {
    id: "trade-10",
    date: "2026-05-24",
    time: "11:00",
    symbol: "SPY",
    assetType: AssetType.STOCK,
    action: TradeAction.BUY,
    quantity: 100,
    entryPrice: 512.20,
    exitPrice: 514.80,
    commissions: 4.95,
    fees: 2.30,
    setups: ["EMA Pullback", "VWAP Bounce"],
    mistakes: [],
    notes: "Clean dip-buy on SPY 50 EMA during standard bull flag pullback. Disciplined target taking.",
    pnl: 260.00, // (514.80 - 512.20) * 100
    netPnl: 252.75,
    status: "Win"
  }
];

export const POPULAR_SETUPS = [
  "Breakout",
  "EMA Pullback",
  "VWAP Bounce",
  "Support Bounce",
  "Resistance Reject",
  "Trend Follow",
  "MACD Crossover",
  "Golden Cross",
  "News Catalyst"
];

export const POPULAR_MISTAKES = [
  "FOMO",
  "Chased Entry",
  "Moved Stop Loss",
  "Over-leveraging",
  "Early Exit",
  "Overtrading",
  "Revenge Trade",
  "Ignored Pre-Market Plan"
];
