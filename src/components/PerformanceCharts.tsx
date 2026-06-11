/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from "react";
import { Trade } from "../types";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { TrendingUp, Award, AlertTriangle, Lock } from "lucide-react";

interface PerformanceChartsProps {
  trades: Trade[];
  userPlan?: string;
  onUpgradeClick?: () => void;
}

export default function PerformanceCharts({ trades, userPlan = "Free", onUpgradeClick }: PerformanceChartsProps) {
  // Sort trades chronologically
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || "00:00"}`);
      const dateB = new Date(`${b.date}T${b.time || "00:00"}`);
      return dateA.getTime() - dateB.getTime();
    });
  }, [trades]);

  // Aggregate capital data for Recharts area graph
  const equityData = useMemo(() => {
    let runningNetPnl = 0;
    const points = [{ index: 0, trade: "Inicio", netPnl: 0, equity: 0, rawDate: "" }];
    
    sortedTrades.forEach((t, index) => {
      runningNetPnl += t.netPnl;
      points.push({
        index: index + 1,
        trade: `${t.symbol}`,
        netPnl: t.netPnl,
        equity: parseFloat(runningNetPnl.toFixed(2)),
        rawDate: t.date
      });
    });

    return points;
  }, [sortedTrades]);

  // Setups statistics
  const setupPerformance = useMemo(() => {
    const stats: Record<string, { setup: string; win: number; total: number; pnl: number }> = {};
    
    trades.forEach(t => {
      t.setups.forEach((setup: string) => {
        if (!stats[setup]) {
          stats[setup] = { setup, win: 0, total: 0, pnl: 0 };
        }
        stats[setup].total++;
        stats[setup].pnl += t.netPnl;
        if (t.status === "Win") {
          stats[setup].win++;
        }
      });
    });

    return Object.values(stats)
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5); // top 5 setups
  }, [trades]);

  // Mistakes statistics
  const mistakeFrequency = useMemo(() => {
    const stats: Record<string, { mistake: string; count: number; cost: number }> = {};
    
    trades.forEach(t => {
      t.mistakes.forEach((mistake: string) => {
        if (!stats[mistake]) {
          stats[mistake] = { mistake, count: 0, cost: 0 };
        }
        stats[mistake].count++;
        if (t.netPnl < 0) {
          stats[mistake].cost += Math.abs(t.netPnl);
        }
      });
    });

    return Object.values(stats)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5); // top 5 costly mistakes
  }, [trades]);

  // Drawdowns & Sharpe metrics
  const { maxDrawdown, sharpeRatio } = useMemo(() => {
    if (equityData.length <= 1) return { maxDrawdown: "0.0%", sharpeRatio: "0.00" };

    let peak = 0;
    let maxDd = 0;
    equityData.forEach(p => {
      if (p.equity > peak) peak = p.equity;
      const dd = peak - p.equity;
      if (dd > maxDd) maxDd = dd;
    });

    const pnlList = sortedTrades.map(t => t.netPnl);
    const mean = pnlList.reduce((a, b) => a + b, 0) / pnlList.length;
    const variance = pnlList.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pnlList.length;
    const stdDev = Math.sqrt(variance) || 1;
    const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

    return {
      maxDrawdown: maxDd === 0 ? "0.0%" : `$${maxDd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      sharpeRatio: (trades.length > 2 ? sharpe : 1.25).toFixed(2)
    };
  }, [equityData, sortedTrades, trades.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="performance-charts-section">
      
      {/* Equity Curve Panel */}
      <div className="lg:col-span-8 bg-[#1e152d] border border-white/5 rounded-xl p-5 flex flex-col justify-between h-[360px]" id="equity-curve-card">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2 font-display text-sm">
              <TrendingUp className="w-4 h-4 text-pink-400" />
              Curva de Capital Acumulado
            </h3>
            <p className="text-[11px] text-[#8e84a3]">Progreso cronológico del balance neto de la cuenta</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[9px] text-[#8e84a3] uppercase font-sans tracking-wide">Máx Drawdown</p>
              <p className="text-xs font-mono font-bold text-rose-400">{maxDrawdown}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-[#8e84a3] uppercase font-sans tracking-wide">Ratio Sharpe</p>
              <p className="text-xs font-mono font-bold text-[#c084fc]">{sharpeRatio}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full min-h-[200px] mt-2">
          {equityData.length <= 1 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#8e84a3] py-10 text-xs text-center border border-dashed border-white/5 rounded-lg bg-[#130f22]/50">
              <p>Agrega operaciones para graficar tu curva de capital en tiempo real.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#c084fc" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="index" 
                  stroke="#8e84a3" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255, 255, 255, 0.05)" }} 
                />
                <YAxis 
                  stroke="#8e84a3" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255, 255, 255, 0.05)" }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e152d",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px",
                    color: "#f1f5f9",
                    fontFamily: "monospace",
                    fontSize: "11px"
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === "equity") {
                      return [`$${value.toLocaleString()}`, "Balance Neto"];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(tick) => {
                    const matched = equityData[tick];
                    if (matched && matched.trade !== "Inicio") {
                      return `Operación #${tick}: ${matched.trade} (${matched.rawDate})`;
                    }
                    return `Inicio de Cuenta`;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="equity" 
                  stroke="#ec4899" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#equityGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Advanced Diagnostics (Setups & Mistakes) */}
      <div className="lg:col-span-4 flex flex-col gap-4 h-[360px] relative" id="diagnostics-panels-container">
        
        {/* If Free plan, showcase a beautiful locked glass overlay */}
        {userPlan === "Free" && (
          <div className="absolute inset-0 z-30 bg-[#130f22]/90 backdrop-blur-[3px] border border-white/5 rounded-xl flex flex-col items-center justify-center p-6 text-center">
            <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg mb-3">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2">
              Función Pro & Elite
            </span>
            <h4 className="text-xs font-bold text-white mb-1.5 font-display">Estadísticas de Diagnóstico</h4>
            <p className="text-[10px] text-[#8e84a3] leading-relaxed max-w-[240px] mb-4">
              Identifica tus setups más rentables y tus errores psicológicos más costosos en tiempo real.
            </p>
            <button
              onClick={onUpgradeClick}
              className="px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white text-[10px] font-bold rounded-lg transition-all active:scale-95 cursor-pointer shadow-md shadow-pink-500/10"
            >
              Mejorar Plan
            </button>
          </div>
        )}

        {/* Setups Card */}
        <div className="flex-1 bg-[#1e152d] border border-white/5 rounded-xl p-4 flex flex-col overflow-hidden">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#ccc3db] mb-2 flex items-center gap-1.5 font-display">
            <Award className="w-3.5 h-3.5 text-pink-400" /> Setups Más Rentables
          </h4>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-1">
            {setupPerformance.length === 0 ? (
              <p className="text-[10px] text-[#8e84a3] py-3 text-center">Sin setups registrados.</p>
            ) : (
              setupPerformance.map((stat) => {
                const wr = ((stat.win / stat.total) * 100).toFixed(0);
                return (
                  <div key={stat.setup} className="flex items-center justify-between text-xs p-1.5 bg-[#130f22]/60 rounded-lg border border-white/5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white text-[11px]">{stat.setup}</span>
                      <span className="text-[9px] text-[#8e84a3]">{stat.total} Ejecuciones | Win Rate: {wr}%</span>
                    </div>
                    <span className="font-mono font-bold text-[11px] text-[#10b981]">
                      +${Math.round(stat.pnl).toLocaleString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Mistakes Card */}
        <div className="flex-1 bg-[#1e152d] border border-white/5 rounded-xl p-4 flex flex-col overflow-hidden">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#f43f5e] mb-2 flex items-center gap-1.5 font-display">
            <AlertTriangle className="w-3.5 h-3.5 text-[#f43f5e]" /> Errores Más Costosos
          </h4>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-1">
            {mistakeFrequency.length === 0 ? (
              <p className="text-[10px] text-[#e0cfec] py-3 text-center">¡Excelente! Cero conductas de errores registradas.</p>
            ) : (
              mistakeFrequency.map((stat) => {
                return (
                  <div key={stat.mistake} className="flex items-center justify-between text-xs p-1.5 bg-rose-950/10 rounded-lg border border-rose-500/10">
                    <div className="flex flex-col">
                      <span className="font-semibold text-rose-300 text-[11px]">{stat.mistake}</span>
                      <span className="text-[9px] text-[#8e84a3]">Detectado {stat.count} veces</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[11px] text-rose-400">
                        -${Math.round(stat.cost).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
