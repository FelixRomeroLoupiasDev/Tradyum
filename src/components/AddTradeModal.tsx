/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, FormEvent, DragEvent, ChangeEvent } from "react";
import { Trade, AssetType, TradeAction, Account } from "../types";
import { X, Camera, Image, UploadCloud, AlertCircle } from "lucide-react";

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrade: (trade: Trade) => void;
  accounts?: Account[];
}

export default function AddTradeModal({ isOpen, onClose, onAddTrade, accounts = [] }: AddTradeModalProps) {
  // Primary Form State
  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState<AssetType>(AssetType.FUTURES);
  const [direction, setDirection] = useState<TradeAction>(TradeAction.BUY); // Long (BUY), Short (SELL)
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [pnlValue, setPnlValue] = useState("");
  const [outcome, setOutcome] = useState("TP"); // "TP", "SL", "BE"
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [notes, setNotes] = useState("");

  // Screenshot capture state
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Drag & Drop triggers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen excede el límite de 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setScreenshotBase64(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const removeUploadedImage = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScreenshotBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!symbol) {
      alert("Por favor ingresa un símbolo.");
      return;
    }
    if (!pnlValue) {
      alert("Por favor ingresa un monto de P&L.");
      return;
    }

    const pnlAmt = parseFloat(pnlValue);
    if (isNaN(pnlAmt)) {
      alert("Por favor ingresa un valor numérico válido para el P&L.");
      return;
    }

    const quantityNum = Number(quantity) || 1;

    // Define standard execution time representing trading hours
    const time = "10:30";

    // Infer status for overall dashboard metrics
    let finalStatus: "Win" | "Loss" | "Flat" = "Flat";
    if (outcome === "TP") finalStatus = "Win";
    else if (outcome === "SL") finalStatus = "Loss";
    else if (outcome === "BE") finalStatus = "Flat";
    else {
      if (pnlAmt > 0.01) finalStatus = "Win";
      else if (pnlAmt < -0.01) finalStatus = "Loss";
    }

    // Determine implied entryPrice & exitPrice based on custom inputs to maintain full analytical charts math
    const entryPrice = 100;
    let exitPrice = 100;

    // Adjust options contracts leverage scale factor
    const contractsMultiplier = market === AssetType.OPTION ? 100 : 1;

    if (direction === TradeAction.BUY) {
      // Long: Pnl = (Exit - Entry) * Q * Multiplier
      exitPrice = entryPrice + pnlAmt / (quantityNum * contractsMultiplier);
    } else {
      // Short: Pnl = (Entry - Exit) * Q * Multiplier
      exitPrice = entryPrice - pnlAmt / (quantityNum * contractsMultiplier);
    }

    // High fidelity clean rounding
    const roundedExitPrice = parseFloat(exitPrice.toFixed(4));

    const newTrade: Trade = {
      id: `trade-${Date.now()}`,
      symbol: symbol.toUpperCase().trim(),
      date,
      time,
      assetType: market,
      action: direction,
      quantity: quantityNum,
      entryPrice,
      exitPrice: roundedExitPrice,
      commissions: 0,
      fees: 0,
      setups: [],
      mistakes: [],
      notes: notes.trim(),
      pnl: pnlAmt,
      netPnl: pnlAmt,
      status: finalStatus,
      accountId: selectedAccountId || undefined,
      screenshot: screenshotBase64 || undefined,
    };

    onAddTrade(newTrade);
    onClose();

    // Reset Form fields
    setSymbol("");
    setMarket(AssetType.FUTURES);
    setDirection(TradeAction.BUY);
    setSelectedAccountId("");
    setQuantity(1);
    setPnlValue("");
    setOutcome("TP");
    setNotes("");
    setScreenshotBase64(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#130f22]/85 backdrop-blur-md" id="nueva-operacion-modal">
      <div className="relative w-full max-w-[520px] bg-[#1e152d] border border-white/5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Block precisely matching high-fidelity details */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#130f22]/60">
          <div>
            <h3 className="text-base font-bold text-white font-display tracking-tight flex items-center gap-2">
              Nueva Operación
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Registra los detalles clave de tu transacción</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 px-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Form Grid */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            
            {/* Input 1: Símbolo */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5 block">
                Símbolo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={symbol}
                placeholder="NQ, ES, AAPL..."
                onChange={(e) => setSymbol(e.target.value)}
                required
                className="w-full bg-[#111317] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>

            {/* Input 2: Mercado Dropdown */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5 block">
                Mercado
              </label>
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value as AssetType)}
                className="w-full bg-[#111317] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '16px'
                }}
              >
                <option value={AssetType.FUTURES}>Futures</option>
                <option value={AssetType.STOCK}>Stocks</option>
                <option value={AssetType.OPTION}>Options</option>
                <option value={AssetType.CRYPTO}>Crypto</option>
                <option value={AssetType.FOREX}>Forex</option>
              </select>
            </div>

            {/* Input 3: Tipo (Long/Short) */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5 block">
                Tipo
              </label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as TradeAction)}
                className="w-full bg-[#111317] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '16px'
                }}
              >
                <option value={TradeAction.BUY}>Long</option>
                <option value={TradeAction.SELL}>Short</option>
              </select>
            </div>

            {/* Input 4: Cuenta */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5 block">
                Cuenta
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-[#111317] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Sin cuenta</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (${acc.balance.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </option>
                ))}
              </select>
            </div>

            {/* Input 5: Cantidad */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5 block">
                Cantidad
              </label>
              <input
                type="number"
                step="any"
                min="0.00001"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-[#111317] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>

            {/* Input 6: P&L ($) */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5 block">
                P&L ($) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={pnlValue}
                placeholder="145.00 o -50.00"
                onChange={(e) => setPnlValue(e.target.value)}
                required
                className="w-full bg-[#111317] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>

            {/* Input 7: Resultado */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5 block">
                Resultado
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full bg-[#111317] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '16px'
                }}
              >
                <option value="TP">✅ TP — Take Profit</option>
                <option value="SL">❌ SL — Stop Loss</option>
                <option value="BE">⚖️ BE — Break Even</option>
              </select>
            </div>

            {/* Input 8: Fecha */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5 block">
                Fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-[#111317] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
              />
            </div>

          </div>

          {/* Screenshot drag and drop container */}
          <div className="pt-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5 block">
              Captura del Trade (opcional)
            </label>
            
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-indigo-500 bg-indigo-500/5 shadow-inner"
                  : screenshotBase64 
                    ? "border-emerald-500/20 bg-emerald-500/2 shadow-inner"
                    : "border-white/5 hover:border-indigo-500/20 bg-[#111317]/50"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {screenshotBase64 ? (
                <div className="w-full flex flex-col items-center space-y-2 relative">
                  <div className="relative group max-w-[200px]">
                    <img 
                      src={screenshotBase64} 
                      alt="Captura cargada" 
                      className="max-h-24 w-auto rounded-lg shadow-md border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={removeUploadedImage}
                        className="bg-rose-600 text-white font-bold text-[9px] uppercase px-2 py-1 rounded"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    🟢 Captura vinculada con éxito
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="text-2xl block animate-bounce" role="img" aria-label="camera">📸</span>
                  <p className="text-xs text-slate-300 font-bold">Hacé clic o arrastrá una captura</p>
                  <p className="text-[9px] text-slate-500">PNG, JPG · Máx 5MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Textarea for Notes */}
          <div className="pt-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5 block">
              Notas / Análisis
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describí tu análisis, razón de entrada, emociones, lecciones..."
              className="w-full bg-[#111317] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
            />
          </div>

        </form>

        {/* Footer controls exact matching the mockup alignment */}
        <div className="p-4 border-t border-white/5 bg-[#130f22]/60 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4.5 py-2 bg-[#130f22] hover:bg-[#1e152d] border border-white/5 text-slate-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-98"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10 cursor-pointer transition-all"
          >
            Agregar Trade
          </button>
        </div>

      </div>
    </div>
  );
}
