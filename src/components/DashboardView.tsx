import React from 'react';
import { 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Percent, 
  Calculator, 
  Activity, 
  Flame, 
  Zap, 
  FlameKindling,
  PieChart
} from 'lucide-react';
import { Trade, Account } from '../types';

interface DashboardViewProps {
  trades: Trade[];
  accounts: Account[];
  activeAccountId: string | null;
  onUpdateAccount?: (id: string, updates: Partial<Account>) => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  trades,
  accounts,
  activeAccountId,
  onUpdateAccount
}) => {
  // 1. Filter trades for the selected account
  const filteredTrades = activeAccountId 
    ? trades.filter(t => t.account_id === activeAccountId)
    : trades;

  // Chronologically sorted (oldest first)
  const cronTrades = [...filteredTrades].sort((a, b) => new Date(a.exit_time).getTime() - new Date(b.exit_time).getTime());

  // 2. Metrics Calculation
  const totalTradesCount = filteredTrades.length;
  const closedTrades = filteredTrades.filter(t => t.status === 'closed');
  const totalClosedCount = closedTrades.length;

  let totalNetPnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winsCount = 0;
  let lossCount = 0;
  let bestTradePnl = 0;
  let worstTradePnl = 0;

  closedTrades.forEach(t => {
    totalNetPnl += t.net_pnl;
    if (t.net_pnl > 0) {
      grossProfit += t.net_pnl;
      winsCount++;
      if (t.net_pnl > bestTradePnl) bestTradePnl = t.net_pnl;
    } else {
      grossLoss += Math.abs(t.net_pnl);
      lossCount++;
      if (t.net_pnl < worstTradePnl) worstTradePnl = t.net_pnl;
    }
  });

  const winRate = totalClosedCount > 0 ? (winsCount / totalClosedCount) * 100 : 0;
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : grossProfit > 0 ? 99.9 : 0;

  // Streaks
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  cronTrades.forEach(t => {
    if (t.net_pnl > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (t.net_pnl < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    }
  });

  // Equity Curve Formulation
  let cumulativePnl = 0;
  const equityCurveData = cronTrades.map((t, idx) => {
    cumulativePnl += t.net_pnl;
    return {
      tradeIndex: idx + 1,
      sim: `Trade #${idx + 1}`,
      fecha: new Date(t.exit_time).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      pnl: parseFloat(t.net_pnl.toFixed(2)),
      equity: parseFloat(cumulativePnl.toFixed(2)),
      symbol: t.symbol
    };
  });

  // Add initial entry point for chart
  const fullEquityData = [
    { tradeIndex: 0, sim: 'Inicio', fecha: '', pnl: 0, equity: 0, symbol: '' },
    ...equityCurveData
  ];

  // Symbol Breakdown Stats
  const symbolStatsMap: Record<string, { pnl: number; wins: number; total: number; symbol: string }> = {};
  filteredTrades.forEach(t => {
    if (!symbolStatsMap[t.symbol]) {
      symbolStatsMap[t.symbol] = { pnl: 0, wins: 0, total: 0, symbol: t.symbol };
    }
    symbolStatsMap[t.symbol].pnl += t.net_pnl;
    symbolStatsMap[t.symbol].total += 1;
    if (t.net_pnl > 0) symbolStatsMap[t.symbol].wins += 1;
  });

  const pnlBySymbolData = Object.values(symbolStatsMap)
    .map(st => ({
      name: st.symbol,
      pnl: parseFloat(st.pnl.toFixed(2)),
      winRate: parseFloat(((st.wins / st.total) * 100).toFixed(1)),
      total: st.total
    }))
    .sort((a, b) => b.pnl - a.pnl);

  const formattedTotalPnl = new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(totalNetPnl);
  const formattedBestTrade = new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(bestTradePnl);
  const formattedWorstTrade = new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(worstTradePnl);

  // Active account stats
  const activeAccount = accounts.find(a => a.id === activeAccountId);

  // Calculate today's PnL for active account
  const localToday = new Date();
  const yccc = localToday.getFullYear();
  const mccc = String(localToday.getMonth() + 1).padStart(2, '0');
  const dccc = String(localToday.getDate()).padStart(2, '0');
  const localTodayStr = `${yccc}-${mccc}-${dccc}`;

  const todayTrades = activeAccount 
    ? trades.filter(t => t.account_id === activeAccountId && t.exit_time && t.exit_time.split('T')[0] === localTodayStr)
    : [];

  const todayPnL = todayTrades.reduce((sum, t) => sum + (t.net_pnl || 0), 0);
  const limitValue = activeAccount?.daily_loss_limit !== undefined ? activeAccount.daily_loss_limit : -200;
  const absLimitValue = Math.abs(limitValue);

  // Calculate percentage of limit reached
  const currentLoss = todayPnL < 0 ? Math.abs(todayPnL) : 0;
  const progressPct = absLimitValue > 0 ? Math.min((currentLoss / absLimitValue) * 100, 100) : 0;

  // Status: VERDE (0-74%) / AMARILLO (75-99%) / ROJO (>=100% or is_blocked)
  let riskStatus: 'VERDE' | 'AMARILLO' | 'ROJO' = 'VERDE';
  if (activeAccount?.is_blocked || progressPct >= 100) {
    riskStatus = 'ROJO';
  } else if (progressPct >= 75) {
    riskStatus = 'AMARILLO';
  }

  return (
    <div id="dashboard-view-root" className="space-y-6">
      {/* View Header */}
      <div id="dashboard-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 id="dashboard-title" className="font-display font-semibold text-xl tracking-tight text-slate-100">
            Métricas de Rendimiento
          </h2>
          <p id="dashboard-subtitle" className="text-xs text-slate-400 mt-1">
            Análisis cuantitativo de tus operaciones cerradas{activeAccount ? ` para la cuenta "${activeAccount.name}"` : ' en todas tus cuentas'}.
          </p>
        </div>

        {activeAccount && (
          <div id="account-status-badge" className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2.5 px-4 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeAccount.color || '#3b82f6' }} />
            <div className="text-left leading-tight">
              <p className="text-xs font-semibold text-slate-300">{activeAccount.name}</p>
              <span className="text-[10px] font-mono text-slate-500 uppercase">{activeAccount.broker}</span>
            </div>
          </div>
        )}
      </div>

      {totalTradesCount === 0 ? (
        /* Empty State */
        <div id="dashboard-empty" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700/50">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-display font-medium text-slate-200">No hay trades cargados</h4>
            <p className="text-xs text-slate-400 leading-normal mt-1.5 max-w-sm mx-auto">
              Para ver el cálculo inteligente de tus rachas de pnl, win rate, curva de equidad y métricas, primero importa trades en la pestaña <strong>"Importar Operaciones"</strong>.
            </p>
          </div>
        </div>
      ) : (
        /* Metrics & Charts Container */
        <>
          {/* Bento-style Metrics Grid */}
          <div id="metrics-grid" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Net PnL Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">PnL Neto Total</span>
                <div className={`p-1.5 rounded-lg ${totalNetPnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {totalNetPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </div>
              </div>
              <div className="mt-4">
                <h3 className={`text-xl font-bold font-mono tracking-tight ${totalNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {totalNetPnl >= 0 ? '+' : ''}{formattedTotalPnl}
                </h3>
                <span className="text-[10px] text-slate-400 block mt-1">Con comisiones descontadas</span>
              </div>
              {/* background vector accent */}
              <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full opacity-5 pointer-events-none ${totalNetPnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            </div>

            {/* Win Rate Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Porcentaje Acierto (Win Rate)</span>
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-bold font-mono tracking-tight text-blue-400">
                  {winRate.toFixed(1)}%
                </h3>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Ganadores: {winsCount} / Totales: {totalClosedCount}
                </span>
              </div>
            </div>

            {/* Profit Factor Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Factor Beneficio (Profit Factor)</span>
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Calculator className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className={`text-xl font-bold font-mono tracking-tight ${profitFactor >= 1.5 ? 'text-emerald-400' : profitFactor >= 1.0 ? 'text-slate-200' : 'text-rose-400'}`}>
                  {profitFactor === 99.9 ? '∞' : profitFactor.toFixed(2)}
                </h3>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Bruto: +${grossProfit.toFixed(0)} / -${grossLoss.toFixed(0)}
                </span>
              </div>
            </div>

            {/* Total Trades Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">Trades Registrados</span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-bold font-mono tracking-tight text-slate-200">
                  {totalTradesCount}
                </h3>
                <span className="text-[10px] text-slate-400 block mt-1">Operaciones en la BD</span>
              </div>
            </div>
          </div>

          {/* Secondary stats bento */}
          <div id="secondary-stats-row" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Streaks */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Flame className="w-4 h-4" />
              </div>
              <div className="text-left font-mono">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Racha Ganadora Max</p>
                <h4 className="text-sm font-bold text-emerald-400">{maxWinStreak} trades</h4>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                <FlameKindling className="w-4 h-4" />
              </div>
              <div className="text-left font-mono">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Racha Perdedora Max</p>
                <h4 className="text-sm font-bold text-rose-400">{maxLossStreak} trades</h4>
              </div>
            </div>

            {/* Best / Worst Trade */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-left font-mono overflow-hidden">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">Mejor Trade</p>
                <h4 className="text-xs font-bold text-emerald-400 truncate">+{formattedBestTrade}</h4>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="text-left font-mono overflow-hidden">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">Peor Trade</p>
                <h4 className="text-xs font-bold text-rose-400 truncate">{formattedWorstTrade}</h4>
              </div>
            </div>
          </div>

          {/* Equity Curve & Symbol breakdown charts */}
          <div id="dashboard-charts-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cumulative Equity Curve Chart */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <h4 className="font-display font-medium text-slate-200">Curva de Equidad (Equity Curve)</h4>
                <p className="text-[11px] text-slate-400">Balance acumulado transaccionado a lo largo de las operaciones.</p>
              </div>

              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={fullEquityData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="tradeIndex" 
                      stroke="#475569" 
                      fontSize={10} 
                      fontFamily="JetBrains Mono"
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={10} 
                      fontFamily="JetBrains Mono"
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          if (data.tradeIndex === 0) return null;
                          return (
                            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-mono text-[11px] space-y-1 shadow-2xl">
                              <p className="text-slate-400 border-b border-slate-800 pb-1 mb-1 font-bold">Trade N°{data.tradeIndex}</p>
                              <div>
                                <span className="text-slate-500">Símbolo: </span>
                                <span className="text-slate-200 font-sans font-semibold">{data.symbol}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">PnL Trade: </span>
                                <span className={data.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                  {data.pnl >= 0 ? '+' : ''}{data.pnl} USD
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500">Equity: </span>
                                <span className="text-blue-400 font-semibold">${data.equity} USD</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.6} />
                    <Area 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#equityGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance by Symbol bar */}
            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h4 className="font-display font-medium text-slate-200">PnL por Símbolo</h4>
                  <p className="text-[11px] text-slate-400">Rendimiento agrupado por activo financiero.</p>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {pnlBySymbolData.map((st, idx) => {
                    const isProfit = st.pnl >= 0;
                    return (
                      <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div className="text-left font-mono">
                          <p className="text-xs font-bold text-slate-200">{st.name}</p>
                          <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
                            {st.total} trades • {st.winRate}% SR
                          </span>
                        </div>
                        <span className={`text-xs font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}{new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(st.pnl)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Extra visual pie/bar placeholder */}
              <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Total Activos: {pnlBySymbolData.length}</span>
                <span className={`flex items-center gap-1 ${totalNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Rendimiento Neto General
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
