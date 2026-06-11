import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Star, 
  Tag, 
  Trash2, 
  X, 
  MessageSquare,
  Smile,
  ShieldCheck,
  CheckCircle,
  FileEdit,
  ArrowRightLeft
} from 'lucide-react';
import { Trade, Account, TradeDirection, AssetClassType } from '../types';

interface JournalViewProps {
  trades: Trade[];
  accounts: Account[];
  activeAccountId: string | null;
  onUpdateTradeDetails: (id: string, updates: Partial<Trade>) => Promise<void>;
  onDeleteTrade: (id: string) => Promise<void>;
}

export const JournalView: React.FC<JournalViewProps> = ({
  trades,
  accounts,
  activeAccountId,
  onUpdateTradeDetails,
  onDeleteTrade
}) => {
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // Filters State
  const [symbolFilter, setSymbolFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Editing state inside sidebar/drawer
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [lessonInput, setLessonInput] = useState('');

  const [savingStatus, setSavingStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');

  // List of standard emotions
  const availableEmotions = [
    'Pacientes', 'FOMO', 'Codiciosos', 'Disciplinados', 'Miedo', 'Venganza', 'Exceso', 'Calma'
  ];

  // 1. Filtering trades
  const filteredTrades = trades.filter((t) => {
    // Account active check
    if (activeAccountId && t.account_id !== activeAccountId) return false;

    // Symbol check
    if (symbolFilter.trim() && !t.symbol.toLowerCase().includes(symbolFilter.toLowerCase().trim())) return false;

    // Direction check
    if (directionFilter !== 'all' && t.direction !== directionFilter) return false;

    // Date checks
    if (dateFrom && t.exit_time.split('T')[0] < dateFrom) return false;
    if (dateTo && t.exit_time.split('T')[0] > dateTo) return false;

    return true;
  });

  // Sort trades newest first
  const sortedTrades = [...filteredTrades].sort((a, b) => new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime());

  // Click row to open details
  const handleSelectTrade = (tr: Trade) => {
    setSelectedTrade(tr);
    setNotes(tr.notes || '');
    setRating(tr.rating || null);
    setEmotions(tr.emotions || []);
    setLessons(tr.lessons || []);
    setScreenshotUrl(tr.screenshot_url || '');
    setTags(tr.tags || []);
    setTagInput('');
    setLessonInput('');
    setSavingStatus('idle');
  };

  const handleUpdateTrade = async () => {
    if (!selectedTrade) return;
    setSavingStatus('loading');
    try {
      await onUpdateTradeDetails(selectedTrade.id, {
        notes: notes.trim(),
        rating,
        emotions,
        lessons,
        screenshot_url: screenshotUrl.trim() || null,
        tags
      });
      setSavingStatus('success');
      // Update local reference
      setSelectedTrade({
        ...selectedTrade,
        notes: notes.trim(),
        rating,
        emotions,
        lessons,
        screenshot_url: screenshotUrl.trim() || null,
        tags
      });
    } catch (e) {
      console.error(e);
      setSavingStatus('failed');
    }
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const clean = tagInput.trim().toLowerCase();
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter(tg => tg !== t));
  };

  const handleAddLesson = () => {
    if (!lessonInput.trim()) return;
    setLessons([...lessons, lessonInput.trim()]);
    setLessonInput('');
  };

  const handleRemoveLesson = (index: number) => {
    setLessons(lessons.filter((_, idx) => idx !== index));
  };

  const toggleEmotion = (emotion: string) => {
    if (emotions.includes(emotion)) {
      setEmotions(emotions.filter(em => em !== emotion));
    } else {
      setEmotions([...emotions, emotion]);
    }
  };

  const handleDeleteTradeLocal = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este trade permanentemente de Supabase?')) {
      await onDeleteTrade(id);
      setSelectedTrade(null);
    }
  };

  return (
    <div id="journal-view-root" className="space-y-6">
      {/* View Head */}
      <div>
        <h2 id="journal-view-title" className="font-display font-semibold text-xl tracking-tight text-slate-100">
          Bitácora Detallada (Journal)
        </h2>
        <p id="journal-view-desc" className="text-xs text-slate-400 mt-1">
          Lista tus operaciones históricas con filtros avanzados para indagar en tu mentalidad y psicología.
        </p>
      </div>

      {/* Filters Bar */}
      <div id="filters-panel" className="bg-[#180e22] border border-[#c084fc]/15 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Symbol filter */}
        <div>
          <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5 px-0.5">Buscar Símbolo</label>
          <div className="relative">
            <input
              type="text"
              placeholder="ej. NQ, EURUSD, BTC"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] rounded-xl pl-9 pr-3.5 py-2 text-xs font-sans text-slate-200 focus:outline-none transition-all"
            />
            <Search className="w-4 h-4 text-purple-400/50 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Direction filter */}
        <div>
          <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5 px-0.5">Dirección de Trade</label>
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] rounded-xl px-3 py-2 text-xs font-sans text-slate-200 focus:outline-none transition-all cursor-pointer"
          >
            <option value="all">Todos los lados</option>
            <option value="long">Long (Largos)</option>
            <option value="short">Short (Cortos)</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5 px-0.5">Fecha Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] rounded-xl px-3 py-1.5 text-xs font-sans text-slate-200 focus:outline-none transition-all cursor-pointer"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5 px-0.5">Fecha Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] rounded-xl px-3 py-1.5 text-xs font-sans text-slate-200 focus:outline-none transition-all cursor-pointer"
          />
        </div>
      </div>

      {/* Main Splits Panel */}
      <div id="journal-view-splits-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Trades Table List */}
        <div className={`lg:col-span-2 bg-[#180e22] border border-[#c084fc]/15 rounded-2xl overflow-hidden`}>
          <div className="p-4 border-b border-[#c084fc]/10 bg-[#12071a]/40 flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-purple-300">Listado de Operaciones ({sortedTrades.length})</span>
            <span className="text-[10px] font-mono text-purple-400/50">Haz click en una fila para ver el detalle psicológico</span>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#c084fc]/10 text-[10px] font-mono text-purple-400/60 tracking-wider uppercase bg-[#12071a]/20">
                  <th className="p-3.5">F. Cierre</th>
                  <th className="p-3.5">Activo</th>
                  <th className="p-3.5">Dirección</th>
                  <th className="p-3.5">Cant.</th>
                  <th className="p-3.5">Precio E / S</th>
                  <th className="p-3.5 text-right">PnL Neto</th>
                </tr>
              </thead>
              <tbody>
                {sortedTrades.map((tr) => {
                  const isSelected = selectedTrade?.id === tr.id;
                  const dateForm = new Date(tr.exit_time).toLocaleDateString('es-ES', { month: '2-digit', day: '2-digit' });
                  return (
                    <tr
                      key={tr.id}
                      onClick={() => handleSelectTrade(tr)}
                      className={`border-b border-[#c084fc]/5 hover:bg-purple-950/25 text-xs font-mono cursor-pointer transition-all ${isSelected ? 'bg-[#c084fc]/10 hover:bg-[#c084fc]/15 border-l-4 border-l-[#c084fc]' : ''}`}
                    >
                      <td className="p-3.5 text-purple-400/60">{dateForm}</td>
                      <td className="p-3.5 font-bold text-slate-250 font-sans">{tr.symbol}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${tr.direction === 'long' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {tr.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3.5 text-purple-300/60">{tr.quantity}</td>
                      <td className="p-3.5 text-purple-400/40">
                        {tr.entry_price.toFixed(2)} → {tr.exit_price.toFixed(2)}
                      </td>
                      <td className={`p-3.5 font-bold text-right ${tr.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tr.net_pnl >= 0 ? '+' : ''}{tr.net_pnl.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {sortedTrades.length === 0 && (
              <div className="p-8 text-center text-xs text-purple-400/40 font-mono">
                Ninguna operación encontrada para los criterios indicados.
              </div>
            )}
          </div>
        </div>

        {/* Trade Details / Psychological Editor Drawer */}
        <div id="psychology-drawer" className="lg:col-span-1">
          {selectedTrade ? (
            <div className="bg-[#180e22] border border-[#c084fc]/15 rounded-2xl p-5 space-y-5 shadow-lg relative max-h-[650px] overflow-y-auto">
              {/* Drawer Top */}
              <div className="flex items-start justify-between pb-3 border-b border-purple-950/30">
                <div className="text-left">
                  <h3 className="font-display font-semibold text-slate-100 text-sm">Bitácora Detalle</h3>
                  <span className="text-[10px] font-mono text-[#ebd7ff] font-semibold">{selectedTrade.symbol} • Trade {selectedTrade.direction.toUpperCase()}</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleDeleteTradeLocal(selectedTrade.id)}
                    className="p-1.5 rounded-lg bg-[#12071a] border border-purple-950/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer text-slate-400"
                    title="Eliminar Trade de Supabase"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSelectedTrade(null)}
                    className="p-1.5 rounded-lg bg-[#12071a] border border-purple-950/40 hover:bg-purple-950/50 transition-colors cursor-pointer text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Exact financial metrics */}
              <div className="grid grid-cols-2 gap-3 bg-[#12071a] p-3.5 rounded-xl border border-purple-950/40 font-mono text-[11px] text-purple-300/60">
                <div>
                  <span className="text-[9px] text-purple-400/50 block uppercase font-bold">PnL Neto</span>
                  <span className={`text-sm font-bold ${selectedTrade.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedTrade.net_pnl >= 0 ? '+' : ''}{selectedTrade.net_pnl.toFixed(2)} USD
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-purple-400/50 block uppercase font-bold">Comisión</span>
                  <span className="text-xs font-semibold text-slate-200">{selectedTrade.commission.toFixed(2)} USD</span>
                </div>

                <div>
                  <span className="text-[9px] text-purple-400/50 block uppercase font-bold">Precio Entrada</span>
                  <span className="text-xs text-purple-300 font-bold">{selectedTrade.entry_price.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-purple-400/50 block uppercase font-bold">Precio Salida</span>
                  <span className="text-xs text-purple-300 font-bold">{selectedTrade.exit_price.toFixed(2)}</span>
                </div>
              </div>

              {/* 1-5 Star Selection */}
              <div className="text-left space-y-1.5">
                <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider px-0.5">Rating (Calidad del trade)</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((starNum) => (
                    <button
                      key={starNum}
                      type="button"
                      onClick={() => setRating(starNum)}
                      className="cursor-pointer transition-colors focus:outline-none"
                    >
                      <Star 
                        className={`w-5 h-5 ${
                          rating && rating >= starNum 
                            ? 'text-amber-400 fill-amber-400' 
                            : 'text-slate-600 hover:text-amber-300'
                        }`} 
                      />
                    </button>
                  ))}
                  {rating && (
                    <button
                      onClick={() => setRating(null)}
                      className="text-[9.5px] font-mono text-slate-500 hover:text-slate-400 underline ml-2"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Tag creation */}
              <div className="text-left space-y-2">
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider px-0.5">Etiquetas (Tags)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ej. pullback, ma-20, apex"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-200 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="bg-slate-950 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500/20 px-3.5 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((t, idx) => (
                    <span key={idx} className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      #{t}
                      <button onClick={() => handleRemoveTag(t)} className="text-slate-500 hover:text-rose-400">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Psychology emotions selectors */}
              <div className="text-left space-y-2">
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider px-0.5">Emociones Registradas</label>
                <div className="grid grid-cols-3 gap-2">
                  {availableEmotions.map((em, idx) => {
                    const isActive = emotions.includes(em);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleEmotion(em)}
                        className={`text-[10px] font-mono p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-blue-600/10 text-blue-400 border-blue-500'
                            : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        {em}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes Input */}
              <div className="text-left space-y-1.5">
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider px-0.5">Notas / Análisis de Bitácora</label>
                <textarea
                  placeholder="Escribe tu análisis técnico, qué hiciste bien o mal, contexto macro, etc..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-xs text-slate-200 h-24 focus:outline-none transition-all resize-none"
                />
              </div>

              {/* Lessons learned section */}
              <div className="text-left space-y-2">
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider px-0.5">Lecciones Aprendidas</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ej. No operar contra tendencia de alta temporalidad"
                    value={lessonInput}
                    onChange={(e) => setLessonInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLesson(); } }}
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-200 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddLesson}
                    className="bg-slate-950 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500/20 px-3.5 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <div className="space-y-1.5 pt-1">
                  {lessons.map((ls, idx) => (
                    <div key={idx} className="bg-slate-950 p-2 rounded-lg border border-slate-850 flex items-center justify-between text-[11px] text-slate-300">
                      <span className="text-left truncate flex-1 pr-2">💡 {ls}</span>
                      <button onClick={() => handleRemoveLesson(idx)} className="text-slate-500 hover:text-rose-400 font-mono">×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Screenshot url helper */}
              <div className="text-left space-y-1.5">
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider px-0.5">Enlace Screenshot (Captura)</label>
                <input
                  type="text"
                  placeholder="ej. https://imgur.com/screenshot"
                  value={screenshotUrl}
                  onChange={(e) => setScreenshotUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-200 transition-all font-mono"
                />
                {screenshotUrl && screenshotUrl.startsWith('http') && (
                  <div className="mt-2 border border-slate-800 rounded-lg overflow-hidden">
                    <img src={screenshotUrl} alt="Screenshot preview" className="w-full max-h-32 object-cover object-center" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>

              {/* Save Trigger */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  {savingStatus === 'loading' && <span className="text-[10px] font-mono text-slate-500 animate-pulse">Guardando en Supabase...</span>}
                  {savingStatus === 'success' && <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">✓ Guardado</span>}
                  {savingStatus === 'failed' && <span className="text-[10px] font-mono text-rose-400">✗ Fallo de Conexión</span>}
                </div>
                <button
                  type="button"
                  disabled={savingStatus === 'loading'}
                  onClick={handleUpdateTrade}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 px-5 rounded-xl cursor-pointer shadow-lg shadow-blue-500/10 transition-colors"
                >
                  Guardar Bitácora
                </button>
              </div>

            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h4 className="font-display font-medium text-slate-300 text-xs">Examen Psicológico de Trade</h4>
              <p className="text-[10.5px] text-slate-500 leading-normal max-w-xs mx-auto">
                Haz click sobre cualquier fila de la lista de operaciones para abrir el editor cognitivo. Podrás añadir notas del mercado, tus emociones del momento, rating de disciplina de trading de 1 a 5 estrellas y capturas técnicas.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
