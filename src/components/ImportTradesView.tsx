import { useState, useMemo, useRef, DragEvent, ChangeEvent } from "react";
import { Trade, Account, AssetType, TradeAction } from "../types";
import { 
  BrokerPlatform, 
  parseCSVToTrades, 
  detectHeaders, 
  MappedFields, 
  tokenizeCSV 
} from "../utils/csvParser";
import { 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  ArrowRight, 
  Layers, 
  Trash2, 
  Sparkles, 
  CheckCheck, 
  AlertCircle,
  HelpCircle,
  Wallet
} from "lucide-react";

interface ImportTradesViewProps {
  accounts: Account[];
  existingTrades: Trade[];
  onImport: (importedTrades: Trade[], mode: "append" | "replace", accountId: string, skipDuplicates: boolean) => void;
  onCancel?: () => void;
  progressPct: number; // to disable imports if daily limit is reached
}

export default function ImportTradesView({
  accounts,
  existingTrades,
  onImport,
  onCancel,
  progressPct
}: ImportTradesViewProps) {
  const [platform, setPlatform] = useState<BrokerPlatform>("ninjatrader");
  const [csvText, setCsvText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [detectedMap, setDetectedMap] = useState<MappedFields | null>(null);
  
  // Custom mapping state for generic platform
  const [customMap, setCustomMap] = useState<MappedFields>({
    dateTimeCol: "",
    symbolCol: "",
    pnlCol: "",
    actionCol: "",
    qtyCol: "",
    commCol: ""
  });

  const [parsedResult, setParsedResult] = useState<Trade[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [targetAccountId, setTargetAccountId] = useState<string>(() => {
    return accounts[0]?.id || "fondeo";
  });
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [imageParseError, setImageParseError] = useState("");

  // Parse and preview current CSV
  const handleCSVLoad = (text: string, name: string) => {
    setCsvText(text);
    setFileName(name);
    setImageParseError("");

    const rows = tokenizeCSV(text);
    if (rows.length > 0) {
      const headers = rows[0];
      setAvailableHeaders(headers);
      
      const { bestMap } = detectHeaders(headers);
      setDetectedMap(bestMap);
      setCustomMap(bestMap);
    }
    
    // Clear preview so they click "Vista previa"
    setParsedResult([]);
    setParseErrors([]);
  };

  // Parse picture using Gemini Flash Multimodal OCR API
  const handleImageLoad = async (dataUrl: string, mimeType: string, name: string) => {
    setIsParsingImage(true);
    setFileName(name);
    setImageParseError("");
    setParsedResult([]);
    setParseErrors([]);

    try {
      const response = await fetch("/api/ai/parse-image-trades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          base64Data: dataUrl,
          mimeType: mimeType
        })
      });

      if (!response.ok) {
        throw new Error("Respuesta de API incorrecta. Verificá tu servidor.");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.trades && Array.isArray(data.trades)) {
        const formatted = data.trades.map((t: any, index: number) => {
          const pnl = parseFloat(t.pnl) || 0;
          const comm = parseFloat(t.commissions) || 0;
          const netPnl = pnl - comm;
          const status = netPnl > 0.01 ? "Win" : netPnl < -0.01 ? "Loss" : "Flat";
          
          let parsedAsset = AssetType.FUTURES;
          if (t.assetType === "crypto") parsedAsset = AssetType.CRYPTO;
          else if (t.assetType === "forex") parsedAsset = AssetType.FOREX;
          else if (t.assetType === "stock") parsedAsset = AssetType.STOCK;
          else if (t.assetType === "options") parsedAsset = AssetType.OPTION;

          return {
            id: `img_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
            date: t.date || new Date().toISOString().split("T")[0],
            time: t.time || "12:00",
            symbol: (t.symbol || "UNKNOWN").toUpperCase(),
            assetType: parsedAsset,
            action: t.action?.toUpperCase() === "SELL" ? TradeAction.SELL : TradeAction.BUY,
            quantity: parseInt(t.quantity) || 1,
            entryPrice: 0,
            exitPrice: 0,
            commissions: comm,
            fees: 0,
            setups: ["IA Screenshot"],
            mistakes: [],
            notes: `Procesado por IA de imagen: ${name}`,
            pnl: pnl,
            netPnl: netPnl,
            status: status
          };
        });

        setParsedResult(formatted);
        if (data.isDemo) {
          setParseErrors(["Gemini API Key ausente: Utilizando simulación heurística para demostración de captura de pantalla."]);
        }
      } else {
        throw new Error("No se detectaron trades claros en la imagen o formato incorrecto.");
      }
    } catch (err: any) {
      console.error(err);
      setImageParseError(err.message || "Error procesando imagen de trades.");
      setFileName("");
    } finally {
      setIsParsingImage(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith(".csv")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target && typeof event.target.result === "string") {
            handleCSVLoad(event.target.result, file.name);
          }
        };
        reader.readAsText(file);
      } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target && typeof event.target.result === "string") {
            handleImageLoad(event.target.result, file.type || "image/png", file.name);
          }
        };
        reader.readAsDataURL(file);
      } else {
        alert("Formato de archivo no soportado. Subís un archivo CSV o de imagen (PNG, JPG, etc.).");
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith(".csv")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target && typeof event.target.result === "string") {
            handleCSVLoad(event.target.result, file.name);
          }
        };
        reader.readAsText(file);
      } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target && typeof event.target.result === "string") {
            handleImageLoad(event.target.result, file.type || "image/png", file.name);
          }
        };
        reader.readAsDataURL(file);
      } else {
        alert("Formato de archivo no soportado. Sube un archivo CSV o de imagen (PNG, JPG, etc.).");
      }
    }
  };

  const executePreview = () => {
    if (!csvText) return;
    const mapToUse = platform === "generic" ? customMap : undefined;
    const { trades: parsed, errors } = parseCSVToTrades(csvText, platform, mapToUse);
    setParsedResult(parsed);
    setParseErrors(errors);
  };

  // Find if a parsed trade is a potential duplicate of an existing trade
  const checkDuplicate = (trade: Trade) => {
    return existingTrades.some(t => {
      // If of the same account, symbol, date and same pnl
      const sameAcc = t.accountId === targetAccountId;
      const sameDate = t.date === trade.date;
      const sameSym = t.symbol.toUpperCase() === trade.symbol.toUpperCase();
      const samePnl = Math.abs((t.pnl || t.netPnl || 0) - (trade.pnl || 0)) < 0.1;
      return sameAcc && sameDate && sameSym && samePnl;
    });
  };

  // Stats computed from parsed trades
  const stats = useMemo(() => {
    if (parsedResult.length === 0) return null;
    
    let totalPnl = 0;
    let minDate = parsedResult[0].date;
    let maxDate = parsedResult[0].date;

    parsedResult.forEach((t) => {
      totalPnl += t.pnl;
      if (t.date < minDate) minDate = t.date;
      if (t.date > maxDate) maxDate = t.date;
    });

    const duplicateCount = parsedResult.filter(checkDuplicate).length;

    return {
      count: parsedResult.length,
      totalPnl,
      minDate,
      maxDate,
      duplicateCount
    };
  }, [parsedResult, targetAccountId, existingTrades]);

  const handleImportClick = () => {
    if (parsedResult.length === 0) return;
    if (progressPct >= 100) {
      alert("No podés importar operaciones porque has alcanzado tu límite de pérdida diaria de hoy — modo solo lectura activo.");
      return;
    }
    onImport(parsedResult, importMode, targetAccountId, skipDuplicates);
  };

  return (
    <div className="bg-[#140f26]/90 border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6" id="view-import-trades">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-600/10 rounded-xl text-indigo-400">
              <Upload className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-white font-display">Sincronizador automático de Trades</h2>
          </div>
          <p className="text-xs text-indigo-200/60 mt-1">
            Sincronizá tu historial vía exportaciones de brokers (NinjaTrader, Tradovate, MetaTrader, TradingView) o cargá una captura de pantalla (JPG/PNG).
          </p>
        </div>
        
        {progressPct >= 100 && (
          <div className="bg-rose-500/15 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold max-w-sm animate-pulse">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>Control de riesgo activo: Operaciones bloqueadas por límite máximo alcanzado.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left config side (columns 5) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Platform selection card */}
          <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-4">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              1. Seleccioná tu plataforma o broker
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "ninjatrader", label: "NinjaTrader" },
                { id: "tradovate", label: "Tradovate" },
                { id: "metatrader", label: "MetaTrader 4/5" },
                { id: "tradingview", label: "TradingView" },
                { id: "generic", label: "Otro (Genérico)" }
              ].map((plat) => (
                <button
                  key={plat.id}
                  onClick={() => {
                    setPlatform(plat.id as BrokerPlatform);
                    setParsedResult([]);
                  }}
                  className={`px-3 py-2.5 text-xs font-semibold rounded-lg text-center transition-all border ${
                    platform === plat.id
                      ? "bg-indigo-600/10 text-indigo-300 border-indigo-500/30 shadow-md"
                      : "bg-[#16122d] text-slate-400 border-white/5 hover:border-white/10 hover:text-white"
                  }`}
                >
                  {plat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drag & drop upload area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => { if (!isParsingImage) fileInputRef.current?.click(); }}
            className={`cursor-pointer group flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center transition-all min-h-[160px] relative ${
              isDragging
                ? "border-indigo-500 bg-indigo-500/10 text-white"
                : fileName
                ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-slate-300"
                : "border-slate-800 bg-[#0d0a16]/50 hover:bg-[#140f28]/60 hover:border-slate-705 text-slate-400"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, image/*, .png, .jpg, .jpeg, .webp, .gif"
              onChange={handleFileChange}
              className="hidden"
            />
            {isParsingImage ? (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
                <div>
                  <p className="text-xs font-bold text-indigo-300">
                    Procesando imagen con IA de Gemini...
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Detectando trades y estructuras del screenshot
                  </p>
                </div>
              </div>
            ) : fileName ? (
              <div className="space-y-2">
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 inline-block">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white max-w-[240px] truncate mx-auto">
                    {fileName}
                  </p>
                  <p className="text-[10px] text-emerald-400 mt-0.5 font-medium">
                    {fileName.endsWith(".csv") ? "¡Archivo CSV cargado con éxito!" : "¡Captura de pantalla procesada con éxito!"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-indigo-600/5 text-indigo-400 group-hover:bg-indigo-600/10 rounded-xl inline-block transition-all">
                  <Upload className="w-7 h-7 stroke-[2]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">
                    Arrastrá tu CSV o Imagen acá o hacé click para seleccionar
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Soporta archivos .csv o capturas de pantalla (.jpg, .png, .webp)
                  </p>
                </div>
              </div>
            )}
          </div>

          {imageParseError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-400 mt-2 font-mono">
              ⚠️ Error de lectura: {imageParseError}
            </div>
          )}

          {/* Dynamic column mapping fields for Generic mode */}
          {platform === "generic" && availableHeaders.length > 0 && (
            <div className="bg-[#0b0816]/70 border border-white/5 rounded-xl p-4 space-y-3.5 animate-in slide-in-from-top-3 duration-250">
              <div className="flex items-center gap-1.5 pb-2 border-b border-white/5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">Mapeo Manual de Columnas</span>
              </div>
              
              <div className="space-y-2.5 text-xs">
                {/* Date/Time mapper */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400 font-medium shrink-0">Fecha / Hora *</span>
                  <select
                    value={customMap.dateTimeCol}
                    onChange={(e) => setCustomMap({ ...customMap, dateTimeCol: e.target.value })}
                    className="bg-slate-950/70 border border-white/10 rounded px-2.5 py-1 text-white text-xs max-w-[160px] truncate"
                  >
                    <option value="">Seleccionar...</option>
                    {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Symbol mapper */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400 font-medium shrink-0">Símbolo o Activo *</span>
                  <select
                    value={customMap.symbolCol}
                    onChange={(e) => setCustomMap({ ...customMap, symbolCol: e.target.value })}
                    className="bg-slate-950/70 border border-white/10 rounded px-2.5 py-1 text-white text-xs max-w-[160px] truncate"
                  >
                    <option value="">Seleccionar...</option>
                    {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* P&L Net mapping */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400 font-medium shrink-0">Ganancia/Pérdida (PnL) *</span>
                  <select
                    value={customMap.pnlCol}
                    onChange={(e) => setCustomMap({ ...customMap, pnlCol: e.target.value })}
                    className="bg-slate-950/70 border border-white/10 rounded px-2.5 py-1 text-white text-xs max-w-[160px] truncate"
                  >
                    <option value="">Seleccionar...</option>
                    {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Optionals toggle bar */}
                <div className="pt-1.5 border-t border-white/5 space-y-2 text-[11px]">
                  <p className="text-slate-500 font-bold italic">Opcionales (mejoran análisis)</p>
                  
                  {/* Action mapper */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">Acción (Compra/Venta)</span>
                    <select
                      value={customMap.actionCol || ""}
                      onChange={(e) => setCustomMap({ ...customMap, actionCol: e.target.value })}
                      className="bg-slate-950/50 border border-white/10 rounded px-2 py-0.5 text-white text-[11px] max-w-[165px]"
                    >
                      <option value="">Ninguno</option>
                      {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Qty mapper */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">Cantidad (Contratos/Lotes)</span>
                    <select
                      value={customMap.qtyCol || ""}
                      onChange={(e) => setCustomMap({ ...customMap, qtyCol: e.target.value })}
                      className="bg-slate-950/50 border border-white/10 rounded px-2 py-0.5 text-white text-[11px] max-w-[165px]"
                    >
                      <option value="">Ninguno</option>
                      {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Commission mapper */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">Comisiones</span>
                    <select
                      value={customMap.commCol || ""}
                      onChange={(e) => setCustomMap({ ...customMap, commCol: e.target.value })}
                      className="bg-slate-950/50 border border-white/10 rounded px-2 py-0.5 text-white text-[11px] max-w-[165px]"
                    >
                      <option value="">Ninguno</option>
                      {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action to preview */}
          <button
            disabled={!csvText}
            onClick={executePreview}
            className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
              csvText
                ? "bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white cursor-pointer shadow-lg shadow-indigo-600/10"
                : "bg-[#18142b] text-slate-500 cursor-not-allowed"
            }`}
          >
            Vista Previa de Trades
          </button>
        </div>

        {/* Right side data list & importer confirm (columns 7) */}
        <div className="lg:col-span-7 space-y-4">
          {parsedResult.length === 0 ? (
            <div className="bg-[#0b0816]/40 border border-slate-900 rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[380px]">
              <HelpCircle className="w-10 h-10 text-slate-600 animate-pulse mb-3" />
              <p className="text-xs font-bold text-slate-300">No hay trades cargados en la vista previa</p>
              <p className="text-[11px] text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                Seleccioná tu broker, arrastrá tu exportación de trades y hacé click en el botón "Vista Previa" para analizarlos.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Target Account selector & Import choices block */}
              <div className="bg-slate-950/50 border border-white/5 rounded-xl p-4.5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Account Selection */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-indigo-400" /> Cuenta destino:
                  </label>
                  <select
                    value={targetAccountId}
                    onChange={(e) => setTargetAccountId(e.target.value)}
                    className="w-full bg-[#16122d] border border-white/10 rounded-lg py-2 px-3 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type} - Bal: ${acc.balance.toFixed(0)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Import method choice */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    Modo del Período detectado:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => setImportMode("append")}
                      className={`py-2 px-2.5 rounded-lg border text-center font-bold tracking-tight transition-all ${
                        importMode === "append"
                          ? "bg-indigo-600/10 text-indigo-300 border-indigo-500/30"
                          : "bg-[#16122d] text-slate-400 border-white/5 hover:border-white/10 hover:text-white"
                      }`}
                      title="Suma los trades sin alterar los ya agregados del período"
                    >
                      Sumar a existentes
                    </button>
                    <button
                      onClick={() => setImportMode("replace")}
                      className={`py-2 px-2.5 rounded-lg border text-center font-bold tracking-tight transition-all ${
                        importMode === "replace"
                          ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                          : "bg-[#16122d] text-slate-450 border-white/5 hover:border-white/10 hover:text-white"
                      }`}
                      title="Elimina trades existentes de la cuenta en ese rango de fechas antes de adherir los nuevos"
                    >
                      Reemplazar Período
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats summary banner */}
              {stats && (
                <div className="bg-[#1f1737] border border-indigo-505/20 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-white">
                      Resumen del Sincronizador de Períodos:
                    </p>
                    <div className="text-[11px] text-indigo-200/70 space-y-0.5">
                      <p>
                        📅 Se detectaron <span className="text-white font-bold">{stats.count}</span> trades entre <span className="text-indigo-300 font-bold">{stats.minDate}</span> y <span className="text-indigo-300 font-bold">{stats.maxDate}</span>
                      </p>
                      <p>
                        💵 Ganancia acumulada de estos trades:{" "}
                        <span className={`font-bold ${stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {stats.totalPnl >= 0 ? `$${stats.totalPnl.toFixed(2)}` : `-$${Math.abs(stats.totalPnl).toFixed(2)}`}
                        </span>
                      </p>
                      {stats.duplicateCount > 0 && (
                        <p className="text-amber-400 flex items-center gap-1 font-semibold text-[10px]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Se detectaron {stats.duplicateCount} posibles duplicados en esta cuenta.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Duplicate skip config */}
                  {stats.duplicateCount > 0 && (
                    <div className="flex items-center gap-1.5 self-center">
                      <input
                        type="checkbox"
                        id="skip-dupes-check"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded border-white/10 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 bg-slate-900 w-3.5 h-3.5 cursor-pointer"
                      />
                      <label htmlFor="skip-dupes-check" className="text-[11px] text-slate-300 font-bold select-none cursor-pointer">
                        Omitir duplicados marcados (Recomendado)
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Preview scroll list */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  Lista de vista previa de trades detectados
                </span>
                
                <div className="bg-[#0b0817] border border-white/5 rounded-xl overflow-hidden max-h-[290px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1b1733] text-slate-400 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3.5 text-[10px] uppercase">Fecha/Hora</th>
                        <th className="py-2.5 px-2 text-[10px] uppercase">Instrumento</th>
                        <th className="py-2.5 px-2 text-[10px] uppercase">Acción/Col</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase text-right">Monto (PnL)</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {parsedResult.map((trade, idx) => {
                        const isDup = checkDuplicate(trade);
                        let rowClass = "text-slate-350 bg-slate-950/15";
                        let tagLabel = "Listo";
                        let tagClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                        
                        if (isDup) {
                          rowClass = "bg-amber-950/10 text-amber-100";
                          tagLabel = skipDuplicates ? "Omitido" : "Duplicado";
                          tagClass = "bg-amber-500/10 text-amber-400 border border-amber-500/25";
                        }

                        return (
                          <tr key={trade.id || idx} className={`${rowClass} hover:bg-white/2 transition-colors`}>
                            <td className="py-2 px-3.5 text-slate-300">
                              <span className="block font-semibold">{trade.date}</span>
                              <span className="text-[10px] text-slate-450">{trade.time}</span>
                            </td>
                            <td className="py-2 px-2">
                              <span className="bg-[#24203a] text-slate-100 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                {trade.symbol}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-[11px] font-sans">
                              {trade.action === TradeAction.BUY ? (
                                <span className="text-emerald-500 font-bold">COMPRA ({trade.quantity})</span>
                              ) : (
                                <span className="text-rose-500 font-bold font-sans">VENTA ({trade.quantity})</span>
                              )}
                            </td>
                            <td className={`py-2 px-3 text-right font-extrabold ${trade.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {trade.pnl >= 0 ? `$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase ${tagClass}`}>
                                {tagLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Parse error notifications lists */}
              {parseErrors.length > 0 && (
                <div className="bg-rose-950/20 border border-rose-500/10 rounded-xl p-3 text-[11px] text-rose-300 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Hubo advertencias al procesar:
                  </p>
                  <ul className="list-disc pl-4.5 space-y-0.5 font-mono">
                    {parseErrors.slice(0, 4).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {parseErrors.length > 4 && <li>Y {parseErrors.length - 4} fallas de formato más.</li>}
                  </ul>
                </div>
              )}

              {/* Double Confirm actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="bg-[#121021] hover:bg-slate-900 border border-white/5 py-2 px-4 rounded-lg text-xs font-semibold text-slate-300 active:scale-95 transition-all cursor-pointer"
                  >
                    Volver Al Dashboard
                  </button>
                )}
                
                <button
                  disabled={progressPct >= 100}
                  onClick={handleImportClick}
                  className={`py-2 px-6 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 ${
                    progressPct >= 100
                      ? "bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed shadow-none"
                      : "bg-[#2563eb] hover:bg-blue-700 active:scale-95 text-white shadow-blue-500/10 cursor-pointer"
                  }`}
                >
                  <CheckCheck className="w-4 h-4" /> Importar {parsedResult.filter(t => !checkDuplicate(t) || !skipDuplicates).length} Trades
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
