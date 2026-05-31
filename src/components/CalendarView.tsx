/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Trade } from "../types";
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from "lucide-react";

interface CalendarViewProps {
  trades: Trade[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export default function CalendarView({ trades, selectedDate, onSelectDate }: CalendarViewProps) {
  // Navigation: base default in April 2026 or May 2026
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(4); // 4 = May 2026, 3 = April 2026

  const monthNamesSpanish = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
    onSelectDate(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
    onSelectDate(null);
  };

  const handleGoToToday = () => {
    // Standard simulation day in May 2026
    setCurrentYear(2026);
    setCurrentMonth(4); // May
    onSelectDate("2026-05-24");
  };

  // Days in month calculation
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    // Get day index of the 1st of the month
    // Sunday is 0, Monday is 1, so let's adjust to standard European layout (Monday starts!)
    const day = new Date(year, month, 1).getDay();
    // adjust Sun (0) to index (6), Mon (1) to index (0)
    return day === 0 ? 6 : day - 1;
  };

  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDayOffset = getFirstDayOffset(currentYear, currentMonth);

  const cells: { dateStr: string | null; dayNum: number | null }[] = [];

  // Padding cells before Month starts
  for (let i = 0; i < firstDayOffset; i++) {
    cells.push({ dateStr: null, dayNum: null });
  }

  // Real Days cells
  for (let d = 1; d <= totalDays; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    const monthIndexFormatted = currentMonth + 1;
    const monthStr = monthIndexFormatted < 10 ? `0${monthIndexFormatted}` : `${monthIndexFormatted}`;
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
    cells.push({ dateStr, dayNum: d });
  }

  // Padding cells after month ends to complete grid rows
  const remainingCellsCount = 42 - cells.length; // standard 6-row layout
  for (let i = 0; i < remainingCellsCount && cells.length < 42; i++) {
    cells.push({ dateStr: null, dayNum: null });
  }

  // Filter trades for the selected active month
  const targetMonthPrefix = `${currentYear}-${(currentMonth + 1).toString().padStart(2, "0")}`;
  const monthTrades = trades.filter(t => t.date.startsWith(targetMonthPrefix));

  // Calendar aggregations
  const monthlyNet = monthTrades.reduce((acc, curr) => acc + curr.netPnl, 0);
  const totalMonthTradesCount = monthTrades.length;

  // Find unique winning days vs losing days count
  const dailyPnLs: Record<string, number> = {};
  monthTrades.forEach(t => {
    if (!dailyPnLs[t.date]) dailyPnLs[t.date] = 0;
    dailyPnLs[t.date] += t.netPnl;
  });

  const winningDaysCount = Object.values(dailyPnLs).filter(pnl => pnl > 0.01).length;

  const getDayTradesSummary = (dateStr: string) => {
    const dayTrades = trades.filter(t => t.date === dateStr);
    if (dayTrades.length === 0) return null;

    let netPnl = 0;
    let wins = 0;
    dayTrades.forEach(t => {
      netPnl += t.netPnl;
      if (t.status === "Win") wins++;
    });

    return {
      netPnl,
      totalCount: dayTrades.length,
      wins,
      isProfit: netPnl >= 0
    };
  };

  // Selected Day specific info
  const selectedDayTrades = selectedDate ? trades.filter(t => t.date === selectedDate) : [];
  const selectedDayNetPnl = selectedDayTrades.reduce((acc, curr) => acc + curr.netPnl, 0);

  return (
    <div className="space-y-6 w-full" id="calendar-view-container">
      
      {/* Calendar Header Card */}
      <div className="bg-[#1e152d] border border-white/5 p-5 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-blue-500 tracking-widest block">Ledger de Tiempos</span>
            <span className="text-lg font-bold font-display text-white">Calendario de Trading</span>
            <p className="text-xs text-slate-400 mt-0.5">Visualiza tus ganancias día por día</p>
          </div>

          {/* Month Controller */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1 px-2.5 bg-slate-900 border border-slate-850 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white min-w-[100px] text-center font-display font-semibold uppercase tracking-wider">
              {monthNamesSpanish[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 px-2.5 bg-slate-900 border border-slate-850 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleGoToToday}
              className="px-3 py-1 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-xs font-semibold rounded text-slate-100 transition-colors cursor-pointer ml-1"
            >
              Hoy
            </button>
          </div>
        </div>

        {/* Main interactive grid and Detail splitting */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Calendar Plate (8 Left grid columns) */}
          <div className="lg:col-span-8 space-y-2">
            
            {/* Week Headers in Spanish layout (Start with Lunes) */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono font-bold text-slate-500 pb-2 border-b border-white/5 uppercase">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mié</div>
              <div>Jue</div>
              <div>Vie</div>
              <div>Sáb</div>
              <div>Dom</div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 mt-2" id="calendar-days-active-grid">
              {cells.map((cell, idx) => {
                if (cell.dayNum === null || !cell.dateStr) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="aspect-square bg-slate-950/20 rounded-md border border-transparent"
                    />
                  );
                }

                const summary = getDayTradesSummary(cell.dateStr);
                const isSelected = selectedDate === cell.dateStr;

                let dayBg = "bg-slate-950/40 border-white/5 hover:border-slate-800 hover:bg-slate-900/40";
                let fontColor = "text-slate-400";

                if (summary) {
                  if (summary.isProfit) {
                    dayBg = isSelected
                      ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500"
                      : "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15";
                    fontColor = "text-emerald-400";
                  } else {
                    dayBg = isSelected
                      ? "bg-rose-500/10 border-rose-500 ring-1 ring-rose-500"
                      : "bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15";
                    fontColor = "text-rose-400";
                  }
                } else if (isSelected) {
                  dayBg = "bg-[#2563eb]/10 border-[#2563eb] ring-1 ring-[#2563eb]";
                  fontColor = "text-[#3b82f6]";
                }

                return (
                  <button
                    key={cell.dateStr}
                    onClick={() => onSelectDate(isSelected ? null : cell.dateStr)}
                    className={`aspect-square rounded-md p-1 border text-left flex flex-col justify-between transition-all duration-150 cursor-pointer ${dayBg}`}
                  >
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {cell.dayNum}
                    </span>
                    {summary && (
                      <div className="text-right leading-none pr-0.5">
                        <span className={`text-[9px] font-mono font-bold block ${fontColor}`}>
                          {summary.isProfit ? "+" : ""}${Math.round(summary.netPnl)}
                        </span>
                        <span className="text-[7px] text-slate-500 font-sans uppercase">
                          {summary.totalCount} Op
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

          </div>

          {/* Right Selected Spec Panel (4 Right grid columns) */}
          <div className="lg:col-span-4 bg-[#130f22] border border-white/5 rounded-xl p-4 flex flex-col justify-between" id="calendar-day-inspector">
            <div>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500 block">Detalle de Operación</span>
              <span className="text-sm font-bold text-slate-200 mt-1 block">Selecciona un día</span>
              <p className="text-xs text-slate-400 mt-1.5 leading-normal">
                Haz clic en un día con operaciones para ver los detalles y revisar las ejecuciones del ledger en esa fecha.
              </p>

              {selectedDate ? (
                <div className="mt-4 p-3 bg-slate-950/50 rounded-lg border border-white/5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-mono text-slate-300 font-bold">{selectedDate}</span>
                    <span className={`text-xs font-mono font-bold ${selectedDayNetPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {selectedDayNetPnl >= 0 ? "+" : ""}${selectedDayNetPnl.toFixed(2)}
                    </span>
                  </div>

                  {selectedDayTrades.length === 0 ? (
                    <span className="text-[11px] text-slate-500 block">Sin ejecuciones este día.</span>
                  ) : (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {selectedDayTrades.map(t => (
                        <div key={t.id} className="text-xs bg-slate-900 duration-150 hover:bg-slate-850 p-2 rounded border border-white/5 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white font-mono text-[11px]">{t.symbol}</span>
                            <span className="text-[9px] text-slate-500 uppercase">{t.action === "Buy" ? "LONG" : "SHORT"} | {t.assetType}</span>
                          </div>
                          <span className={`font-mono font-semibold text-[11px] ${t.netPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {t.netPnl >= 0 ? "+" : ""}${t.netPnl.toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-8 py-6 border border-dashed border-white/5 rounded-lg text-center bg-slate-950/10">
                  <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
                  <span className="text-[11px] text-slate-500 block mt-2">Ningún día seleccionado actualmente</span>
                </div>
              )}
            </div>

            {selectedDate && (
              <button
                onClick={() => onSelectDate(null)}
                className="w-full mt-4 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Limpiar Selección de Día
              </button>
            )}
          </div>
        </div>

        {/* Calendar Footer Widgets Grid (Exactly like Screenshot 5 bottom section) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-white/5">
          {/* Box 1: P&L del Mes */}
          <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl">
            <span className="text-[9px] text-slate-500 uppercase block tracking-wider font-semibold">P&L del Mes</span>
            <span className={`text-lg font-bold font-mono block mt-1 ${
              monthlyNet >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}>
              {monthlyNet >= 0 ? "+" : ""}${monthlyNet.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Box 2: Operaciones del Mes */}
          <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl">
            <span className="text-[9px] text-slate-500 uppercase block tracking-wider font-semibold">Operaciones del Mes</span>
            <span className="text-lg font-bold font-mono text-slate-200 block mt-1">
              {totalMonthTradesCount}
            </span>
          </div>

          {/* Box 3: Días Ganadores */}
          <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl">
            <span className="text-[9px] text-slate-500 uppercase block tracking-wider font-semibold">Días Ganadores</span>
            <span className="text-lg font-bold font-mono text-emerald-400 block mt-1">
              {winningDaysCount}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
