/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Trade } from "../types";
import { DollarSign, Percent, TrendingUp, TrendingDown, Target } from "lucide-react";

interface DashboardStatsProps {
  trades: Trade[];
}

export default function DashboardStats({ trades }: DashboardStatsProps) {
  // Calculate dynamic stats
  let totalNetPnl = 0;
  let winTrades = 0;
  let lossTrades = 0;
  let winSum = 0;
  let lossSum = 0;

  trades.forEach((t) => {
    totalNetPnl += t.netPnl;
    if (t.status === "Win") {
      winTrades++;
      winSum += t.netPnl;
    } else if (t.status === "Loss") {
      lossTrades++;
      lossSum += Math.abs(t.netPnl);
    }
  });

  const totalTradesCount = trades.length;
  const winRate = totalTradesCount > 0 ? (winTrades / totalTradesCount) * 100 : 0;
  const averageWin = winTrades > 0 ? winSum / winTrades : 0;
  const averageLoss = lossTrades > 0 ? lossSum / lossTrades : 0;

  // Format currency
  const formatValue = (num: number) => {
    const absVal = Math.abs(num).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${num < 0 ? "-" : ""}$${absVal}`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" id="stats-dashboard-grid">
      
      {/* CARD 1: P&L Total */}
      <div 
        id="stat-card-pnl"
        className="bg-[#1e152d] border border-white/5 p-4 rounded-xl flex items-center justify-between h-[92px] relative overflow-hidden transition-all duration-200 hover:border-white/10"
      >
        <div className="flex flex-col justify-between h-full z-10">
          <span className="text-[10px] text-[#ccc3db] font-semibold uppercase tracking-wider block font-display">
            P&L Total
          </span>
          <span className={`text-xl font-bold font-mono tracking-tight block ${
            totalNetPnl >= 0 ? "text-[#10b981]" : "text-[#f43f5e]"
          }`}>
            {totalNetPnl >= 0 ? "+" : ""}{formatValue(totalNetPnl)}
          </span>
          <span className="text-[9px] text-[#8e84a3] font-medium font-sans truncate">
            {totalNetPnl >= 0 ? "Retorno positivo" : "Retorno negativo"}
          </span>
        </div>
        
        {/* Neon small square icon cap */}
        <div className="w-[38px] h-[38px] rounded-lg bg-[#10b981]/10 flex items-center justify-center text-[#10b981] shrink-0">
          <DollarSign className="w-5 h-5 stroke-[2]" />
        </div>
      </div>

      {/* CARD 2: Win Rate */}
      <div 
        id="stat-card-winrate"
        className="bg-[#1e152d] border border-white/5 p-4 rounded-xl flex items-center justify-between h-[92px] relative overflow-hidden transition-all duration-200 hover:border-white/10"
      >
        <div className="flex flex-col justify-between h-full z-10">
          <span className="text-[10px] text-[#ccc3db] font-semibold uppercase tracking-wider block font-display">
            Win Rate
          </span>
          <span className="text-xl font-bold font-mono text-pink-400 tracking-tight block">
            {winRate.toFixed(1)}%
          </span>
          <span className="text-[9px] text-[#8e84a3] font-medium font-sans truncate">
            {winTrades} ganadores
          </span>
        </div>
        
        {/* Neon pink small square icon cap */}
        <div className="w-[38px] h-[38px] rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 shrink-0">
          <Target className="w-5 h-5 stroke-[2]" />
        </div>
      </div>

      {/* CARD 3: Trades */}
      <div 
        id="stat-card-trades-count"
        className="bg-[#1e152d] border border-white/5 p-4 rounded-xl flex items-center justify-between h-[92px] relative overflow-hidden transition-all duration-200 hover:border-white/10"
      >
        <div className="flex flex-col justify-between h-full z-10">
          <span className="text-[10px] text-[#ccc3db] font-semibold uppercase tracking-wider block font-display">
            Trades
          </span>
          <span className="text-xl font-bold font-mono text-[#c084fc] tracking-tight block">
            {totalTradesCount}
          </span>
          <span className="text-[9px] text-[#8e84a3] font-medium font-sans truncate">
            Total este mes
          </span>
        </div>
        
        {/* Neon lavender small square icon cap */}
        <div className="w-[38px] h-[38px] rounded-lg bg-[#c084fc]/10 flex items-center justify-center text-[#c084fc] shrink-0">
          <TrendingUp className="w-5 h-5 stroke-[2]" />
        </div>
      </div>

      {/* CARD 4: Ganancia Promedio */}
      <div 
        id="stat-card-avg-win"
        className="bg-[#1e152d] border border-white/5 p-4 rounded-xl flex items-center justify-between h-[92px] relative overflow-hidden transition-all duration-200 hover:border-white/10"
      >
        <div className="flex flex-col justify-between h-full z-10">
          <span className="text-[10px] text-[#ccc3db] font-semibold uppercase tracking-wider block font-display">
            Ganancia Avg
          </span>
          <span className="text-xl font-bold font-mono text-blue-400 tracking-tight block">
            {formatValue(averageWin)}
          </span>
          <span className="text-[9px] text-[#8e84a3] font-medium font-sans truncate">
            Por trade ganador
          </span>
        </div>
        
        {/* Neon blue small square icon cap */}
        <div className="w-[38px] h-[38px] rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
          <TrendingUp className="w-5 h-5 stroke-[2]" />
        </div>
      </div>

      {/* CARD 5: Pérdida Promedio */}
      <div 
        id="stat-card-avg-loss"
        className="bg-[#1e152d] border border-white/5 p-4 rounded-xl flex items-center justify-between h-[92px] relative overflow-hidden transition-all duration-200 hover:border-white/10"
      >
        <div className="flex flex-col justify-between h-full z-10">
          <span className="text-[10px] text-[#ccc3db] font-semibold uppercase tracking-wider block font-display">
            Pérdida Avg
          </span>
          <span className="text-xl font-bold font-mono text-amber-500 tracking-tight block">
            {formatValue(-averageLoss)}
          </span>
          <span className="text-[9px] text-[#8e84a3] font-medium font-sans truncate">
            Por trade perdedor
          </span>
        </div>
        
        {/* Neon amber small square icon cap */}
        <div className="w-[38px] h-[38px] rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
          <TrendingDown className="w-5 h-5 stroke-[2]" />
        </div>
      </div>

    </div>
  );
}
