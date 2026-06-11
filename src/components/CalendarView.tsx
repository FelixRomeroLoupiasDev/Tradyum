import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown,
  Award,
  CircleDot
} from 'lucide-react';
import { Trade, Account } from '../types';

interface CalendarViewProps {
  trades: Trade[];
  accounts: Account[];
  activeAccountId: string | null;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  trades,
  accounts,
  activeAccountId
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Filter trades for active account
  const filteredTrades = activeAccountId 
    ? trades.filter(t => t.account_id === activeAccountId)
    : trades;

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  // Month Names
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Navigate Months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Days of Week header
  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Helper: Find days info in current month
  const getDaysInMonth = (year: number, month: number): Date[] => {
    const date = new Date(year, month, 1);
    const days: Date[] = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const monthDays = getDaysInMonth(currentYear, currentMonth);

  // Pad the start of calendar grid to align with Week Day
  // JS Day is 0 (Sun) to 6 (Sat). We want 0 (Mon) to 6 (Sun)
  const getOffsetIndex = (dayIndex: number): number => {
    if (dayIndex === 0) return 6; // Sunday moved to index 6
    return dayIndex - 1;          // Monday mapped from 1 to 0
  };

  const firstDayOffset = getOffsetIndex(monthDays[0].getDay());

  // Generate calendar grid array
  const gridCells: (Date | null)[] = Array(firstDayOffset).fill(null).concat(monthDays);

  // Group trades by date (YYYY-MM-DD local timezone)
  const groupTradesByDate = (tradeList: Trade[]): Record<string, Trade[]> => {
    const grouped: Record<string, Trade[]> = {};
    tradeList.forEach(t => {
      if (!t.exit_time) return;
      const dateLocal = t.exit_time.split('T')[0]; // Simple YYYY-MM-DD ISO extraction
      if (!grouped[dateLocal]) {
        grouped[dateLocal] = [];
      }
      grouped[dateLocal].push(t);
    });
    return grouped;
  };

  const tradesByDate = groupTradesByDate(filteredTrades);

  // Compute month performance totals
  let monthPnl = 0;
  let monthTradesCount = 0;
  let monthWinningDays = 0;
  let monthLosingDays = 0;

  monthDays.forEach(day => {
    const dateStr = day.toISOString().split('T')[0];
    const dayTrades = tradesByDate[dateStr] || [];
    if (dayTrades.length > 0) {
      monthTradesCount += dayTrades.length;
      let dayPnl = 0;
      dayTrades.forEach(t => dayPnl += t.net_pnl);
      monthPnl += dayPnl;
      if (dayPnl > 0) monthWinningDays++;
      else if (dayPnl < 0) monthLosingDays++;
    }
  });

  return (
    <div id="calendar-view-root" className="space-y-6">
      {/* Calendar Header Metrics Panel */}
      <div id="calendar-head" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 id="calendar-heading" className="font-display font-semibold text-xl tracking-tight text-slate-100">
            Calendario Mensual
          </h2>
          <p id="calendar-desc" className="text-xs text-slate-400 mt-1">
            Mapa de calor histórico de tu rentabilidad diaria para rastrear consistencia de operaciones.
          </p>
        </div>

        {/* Month selector controls */}
        <div id="month-carousel" className="flex items-center gap-2 bg-[#180e22] border border-[#c084fc]/15 p-1.5 rounded-xl">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-[#12071a] text-purple-400 hover:text-[#ebd7ff] cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span id="carousel-current-month" className="text-xs font-semibold font-display text-[#ebd7ff] px-3 min-w-[100px] text-center">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-[#12071a] text-purple-400 hover:text-[#ebd7ff] cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Month metrics card */}
      <div id="calendar-stats-row" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#180e22] border border-[#c084fc]/15 p-4 rounded-xl font-mono text-left">
          <p className="text-[10px] text-purple-400/50 uppercase tracking-wide">PnL del Mes</p>
          <h4 className={`text-sm font-bold mt-1 ${monthPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {monthPnl >= 0 ? '+' : ''}{new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(monthPnl)}
          </h4>
        </div>

        <div className="bg-[#180e22] border border-[#c084fc]/15 p-4 rounded-xl font-mono text-left">
          <p className="text-[10px] text-purple-400/50 uppercase tracking-wide">Días Verdes</p>
          <h4 className="text-sm font-bold text-emerald-400 mt-1">{monthWinningDays} días</h4>
        </div>

        <div className="bg-[#180e22] border border-[#c084fc]/15 p-4 rounded-xl font-mono text-left">
          <p className="text-[10px] text-purple-400/50 uppercase tracking-wide">Días Rojos</p>
          <h4 className="text-sm font-bold text-rose-400 mt-1">{monthLosingDays} días</h4>
        </div>

        <div className="bg-[#180e22] border border-[#c084fc]/15 p-4 rounded-xl font-mono text-left">
          <p className="text-[10px] text-purple-400/50 uppercase tracking-wide">Operaciones Totales</p>
          <h4 className="text-sm font-bold text-fuchsia-400 mt-1">{monthTradesCount} trades</h4>
        </div>
      </div>

      {/* Main Calendar Grid Canvas */}
      <div id="calendar-grid-card" className="bg-[#180e22] border border-[#c084fc]/15 rounded-2xl p-5">
        {/* Days of Week Row Header */}
        <div className="grid grid-cols-7 gap-2 pb-3 mb-2 border-b border-[#c084fc]/10 font-mono text-[11px] text-purple-400/60 text-center font-semibold">
          {daysOfWeek.map((day, dIdx) => (
            <div key={dIdx}>{day}</div>
          ))}
        </div>

        {/* Days cells layout */}
        <div className="grid grid-cols-7 gap-2">
          {gridCells.map((day, cellIdx) => {
            if (!day) {
              return (
                <div 
                  key={`pad-${cellIdx}`} 
                  className="aspect-[4/3] bg-[#12071a]/20 border border-purple-950/40 rounded-xl"
                />
              );
            }

            const dayNum = day.getDate();
            const dateStr = day.toISOString().split('T')[0];
            const dayTrades = tradesByDate[dateStr] || [];

            let dayNetPnl = 0;
            let wins = 0;
            dayTrades.forEach(tr => {
              dayNetPnl += tr.net_pnl;
              if (tr.net_pnl > 0) wins++;
            });

            const hasTrades = dayTrades.length > 0;
            const isGreen = dayNetPnl > 0;
            const isRed = dayNetPnl < 0;

            const winRate = hasTrades ? (wins / dayTrades.length) * 100 : 0;

            return (
              <div
                key={`day-${dayNum}`}
                className={`aspect-[4/3] relative rounded-xl border flex flex-col justify-between p-2 pt-1.5 transition-all text-left ${
                  hasTrades
                    ? isGreen
                      ? 'bg-emerald-500/10 border-emerald-500/30 group hover:border-emerald-500'
                      : isRed
                        ? 'bg-rose-500/10 border-rose-500/30 group hover:border-rose-500'
                        : 'bg-[#2a1640] border-purple-500/30 group hover:border-purple-500'
                    : 'bg-[#12071a]/40 border-purple-950/40 hover:bg-[#1d0f2b]/60 text-purple-400/40'
                }`}
              >
                {/* Day Number */}
                <span className={`text-[11px] font-mono font-semibold ${hasTrades ? 'text-slate-300' : 'text-purple-400/50'}`}>
                  {dayNum}
                </span>

                {/* Performance Value */}
                {hasTrades ? (
                  <div className="text-right">
                    <p className={`text-[10px] md:text-[11px] font-bold font-mono tracking-tight leading-none ${isGreen ? 'text-emerald-400' : isRed ? 'text-rose-400' : 'text-slate-300'}`}>
                      {isGreen ? '+' : ''}{dayNetPnl.toFixed(0)}
                    </p>
                    <span className="text-[8px] font-mono text-purple-400/50 block mt-0.5">
                      {dayTrades.length} Tr • {winRate.toFixed(0)}%
                    </span>
                  </div>
                ) : null}

                {/* Popup Tooltip Hover Indicator */}
                {hasTrades && (
                  <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 bg-[#12071a] border border-[#c084fc]/30 p-2.5 rounded-lg z-20 min-w-[140px] text-[10px] leading-normal font-mono shadow-2xl mb-1 text-slate-300">
                    <p className="text-purple-300 border-b border-[#c084fc]/15 pb-1 font-bold mb-1">
                      {dayNum} {monthNames[currentMonth]}
                    </p>
                    <div>
                      Trades: <span className="text-fuchsia-400 font-semibold">{dayTrades.length}</span>
                    </div>
                    <div>
                      Win Rate: <span className="text-emerald-400 font-semibold">{winRate.toFixed(1)}%</span>
                    </div>
                    <div>
                      PnL Diario:{' '}
                      <span className={dayNetPnl >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                        {dayNetPnl >= 0 ? '+' : ''}{dayNetPnl.toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
