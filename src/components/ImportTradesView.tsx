import { useState, useMemo, useRef, DragEvent, ChangeEvent, FormEvent } from "react";
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
  Wallet,
  Key,
  ShieldAlert,
  Download,
  Info
} from "lucide-react";

// Importar los adaptadores desarrollados de Tradyum Integrations
// @ts-ignore
import { importFromNinjaTrader } from "../integrations/ninjatrader/index.js";
// @ts-ignore
import { importFromTradovate } from "../integrations/tradovate/index.js";
// @ts-ignore
import { importFromMT4 } from "../integrations/mt4/index.js";
// @ts-ignore
import { importFromMT5 } from "../integrations/mt5/index.js";
// @ts-ignore
import { importFromTradingView } from "../integrations/tradingview/index.js";

interface ImportTradesViewProps {
  accounts: Account[];
  existingTrades: Trade[];
  onImport: (importedTrades: Trade[], mode: "append" | "replace", accountId: string, skipDuplicates: boolean) => void;
  onCancel?: () => void;
  progressPct: number; // para deshabilitar si el límite de pérdida diaria está activo
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
  
  // Mapeador personalizado genérico
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

  // Estados de Tradovate API
  const [tradovateUser, setTradovateUser] = useState("");
  const [tradovatePass, setTradovatePass] = useState("");
  const [tradovateAppId, setTradovateAppId] = useState("");
  const [tradovateAppVersion, setTradovateAppVersion] = useState("1.0.0");
  const [tradovateAppName, setTradovateAppName] = useState("TradyumApp");
  const [tradovateIsLive, setTradovateIsLive] = useState(false);
  const [isSyncingTradovate, setIsSyncingTradovate] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [imageParseError, setImageParseError] = useState("");

  /**
   * Mapeador: Convierte el esquema genérico normalizado de Tradyum Integrations
   * al tipo específico TypeScript `Trade` que maneja la base o estado de la app.
   */
  const mapNormalizedToTradyumTrade = (norm: any, index: number, targetAccId: string): Trade => {
    let parsedAsset = AssetType.FUTURES;
    const m = String(norm.market || "Futures").toLowerCase();
    if (m.includes("crypto")) parsedAsset = AssetType.CRYPTO;
    else if (m.includes("forex")) parsedAsset = AssetType.FOREX;
    else if (m.includes("stock")) parsedAsset = AssetType.STOCK;
    else if (m.includes("option")) parsedAsset = AssetType.OPTION;

    const action = (norm.type || "Long").toLowerCase() === "short" ? TradeAction.SELL : TradeAction.BUY;

    // Extraer fecha y hora desde ISO retornado
    let tradeDate = new Date().toISOString().split("T")[0];
    let tradeTime = "12:00";
    if (norm.date) {
      try {
        const d = new Date(norm.date);
        if (!isNaN(d.getTime())) {
          tradeDate = d.toISOString().split("T")[0];
          tradeTime = d.toTimeString().split(" ")[0].slice(0, 5); // formato HH:MM
        }
      } catch (e) {}
    }

    const pnl = parseFloat(norm.pnl) || 0;
    const status = pnl > 0.01 ? "Win" : pnl < -0.01 ? "Loss" : "Flat";

    return {
      id: `import_${norm.broker || "generic"}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
      date: tradeDate,
      time: tradeTime,
      symbol: String(norm.symbol || "UNKNOWN").toUpperCase(),
      assetType: parsedAsset,
      action: action,
      quantity: parseInt(norm.quantity) || 1,
      entryPrice: norm.rawData?.entryPrice || norm.rawData?.openPrice || norm.rawData?.entry || 100,
      exitPrice: norm.rawData?.exitPrice || norm.rawData?.closePrice || norm.rawData?.exit || 100,
      commissions: Math.abs(parseFloat(norm.rawData?.commission || norm.rawData?.commissions)) || 0,
      fees: 0,
      setups: [`Importado ${String(norm.broker || "broker").toUpperCase()}`],
      mistakes: [],
      notes: norm.notes || `Sincronizado vía ${norm.broker}`,
      pnl: pnl,
      netPnl: pnl,
      status: status,
      accountId: targetAccId
    };
  };

  // Carga un CSV genérico
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
    
    setParsedResult([]);
    setParseErrors([]);
  };

  // Carga y parsea una captura de pantalla usando Gemini Flash
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
        throw new Error("Respuesta de API incorrecta. Verificá tu servidor o llave.");
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
            status: status,
            accountId: targetAccountId
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

  // Procesar archivo text o imagen subido
  const processEnteredFile = (file: File) => {
    setFileName(file.name);
    setImageParseError("");
    setParsedResult([]);
    setParseErrors([]);

    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === "string") {
          handleImageLoad(event.target.result, file.type || "image/png", file.name);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    // Archivo de texto (CSV, Reporte HTML)
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === "string") {
        const text = event.target.result;
        setCsvText(text);

        // Parseo automático según broker seleccionado para feedback inmediato
        if (platform === "ninjatrader") {
          try {
            const rawTrades = importFromNinjaTrader(text);
            const formatted = rawTrades.map((t: any, idx: number) => mapNormalizedToTradyumTrade(t, idx, targetAccountId));
            setParsedResult(formatted);
            if (rawTrades.length === 0) {
              setParseErrors(["No se detectaron trades en el CSV de NinjaTrader. Verificá que sea un archivo de registros válido."]);
            }
          } catch (err: any) {
            setParseErrors(["Error leyendo el CSV de NinjaTrader: " + err.message]);
          }
        } 
        else if (platform === "metatrader") {
          try {
            const isMT5 = text.toLowerCase().includes("metatrader 5") || text.toLowerCase().includes("position");
            const rawTrades = isMT5 ? importFromMT5(text, file.name) : importFromMT4(text, file.name);
            const formatted = rawTrades.map((t: any, idx: number) => mapNormalizedToTradyumTrade(t, idx, targetAccountId));
            setParsedResult(formatted);
            if (rawTrades.length === 0) {
              setParseErrors(["No se extrajeron trades. Verificá que exportaste el Account History de MT4/MT5 seleccionando 'Save as Report' (HTML) o exportándolo como CSV."]);
            }
          } catch (err: any) {
            setParseErrors(["Error decodificando reporte de MetaTrader: " + err.message]);
          }
        } 
        else if (platform === "tradingview") {
          try {
            const rawTrades = importFromTradingView(text);
            const formatted = rawTrades.map((t: any, idx: number) => mapNormalizedToTradyumTrade(t, idx, targetAccountId));
            setParsedResult(formatted);
            if (rawTrades.length === 0) {
              setParseErrors(["No se detectaron transacciones en el CSV de TradingView. ¿Exportaste de la pestaña 'Lista de operaciones'?"]);
            }
          } catch (err: any) {
            setParseErrors(["Error cargando CSV de TradingView: " + err.message]);
          }
        } 
        else {
          handleCSVLoad(text, file.name);
        }
      }
    };
    reader.readAsText(file);
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
      processEnteredFile(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processEnteredFile(file);
    }
  };

  // Forzar remuestreo de preview manual si modifican cosas
  const executePreview = () => {
    if (!csvText) return;

    if (platform === "ninjatrader") {
      try {
        const rawTrades = importFromNinjaTrader(csvText);
        const formatted = rawTrades.map((t: any, idx: number) => mapNormalizedToTradyumTrade(t, idx, targetAccountId));
        setParsedResult(formatted);
      } catch (err: any) {
        setParseErrors(["Fallo al parsear NinjaTrader CSV: " + err.message]);
      }
    } 
    else if (platform === "metatrader") {
      try {
        const isMT5 = csvText.toLowerCase().includes("metatrader 5") || csvText.toLowerCase().includes("position");
        const rawTrades = isMT5 ? importFromMT5(csvText, fileName) : importFromMT4(csvText, fileName);
        const formatted = rawTrades.map((t: any, idx: number) => mapNormalizedToTradyumTrade(t, idx, targetAccountId));
        setParsedResult(formatted);
      } catch (err: any) {
        setParseErrors(["Fallo al parsear MetaTrader Report: " + err.message]);
      }
    } 
    else if (platform === "tradingview") {
      try {
        const rawTrades = importFromTradingView(csvText);
        const formatted = rawTrades.map((t: any, idx: number) => mapNormalizedToTradyumTrade(t, idx, targetAccountId));
        setParsedResult(formatted);
      } catch (err: any) {
        setParseErrors(["Fallo al parsear TradingView CSV: " + err.message]);
      }
    } 
    else if (platform === "generic") {
      const mapToUse = customMap;
      const { trades: parsed, errors } = parseCSVToTrades(csvText, platform, mapToUse);
      // Mapear el output de parseCSVToTrades que ya devuelve estructura de app
      setParsedResult(parsed);
      setParseErrors(errors);
    }
  };

  // Conectar vía API de Tradovate REST
  const handleTradovateSync = async (e: FormEvent) => {
    e.preventDefault();
    if (!tradovateUser || !tradovatePass) {
      alert("Por favor ingresá tu nombre de usuario y contraseña de Tradovate.");
      return;
    }

    setIsSyncingTradovate(true);
    setParseErrors([]);
    setFileName("Tradovate API Sincronizada");
    setImageParseError("");
    setParsedResult([]);

    try {
      // Si el usuario pone "demo" o "test", mandamos appId SIMULATE para levantar simulación impecable
      const username = tradovateUser.trim();
      const sendAppId = (username === "demo" || username === "test") ? "SIMULATE" : tradovateAppId;

      const normalizedTrades = await importFromTradovate({
        username: username,
        password: tradovatePass,
        appId: sendAppId || "TradyumDevApp",
        appVersion: tradovateAppVersion || "1.0.0",
        appName: tradovateAppName || "Tradyum",
        isLive: tradovateIsLive
      });

      if (normalizedTrades && normalizedTrades.length > 0) {
        const formatted = normalizedTrades.map((t: any, idx: number) => mapNormalizedToTradyumTrade(t, idx, targetAccountId));
        setParsedResult(formatted);
      } else {
        throw new Error("No se encontraron ejecuciones cerradas/fills en Tradovate para este rango.");
      }
    } catch (err: any) {
      console.error(err);
      setImageParseError(err.message || "Error al conectar con la API de Tradovate. Revisá las credenciales o usá 'demo' para simulación.");
      setFileName("");
    } finally {
      setIsSyncingTradovate(false);
    }
  };

  // Autofill para demo de Tradovate
  const handleAutofillTradovateDemo = () => {
    setTradovateUser("demo");
    setTradovatePass("password_demo_123");
    setTradovateAppId("SIMULATE");
    setTradovateIsLive(false);
  };

  // Encontrar duplicados
  const checkDuplicate = (trade: Trade) => {
    return existingTrades.some(t => {
      const sameAcc = t.accountId === targetAccountId;
      const sameDate = t.date === trade.date;
      const sameSym = t.symbol.toUpperCase() === trade.symbol.toUpperCase();
      const samePnl = Math.abs((t.pnl || t.netPnl || 0) - (trade.pnl || 0)) < 0.1;
      return sameAcc && sameDate && sameSym && samePnl;
    });
  };

  // Estadísticas del preview
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
    <div className="bg-[#140f26]/95 border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6" id="view-import-trades">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-600/20 rounded-xl text-indigo-400">
              <Upload className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-white font-display">Sincronizador automático de Trades</h2>
          </div>
          <p className="text-xs text-indigo-200/60 mt-1">
            Sincronizá tu historial vía exportaciones de brokers o conectando directamente por APIs REST o capturas de pantalla.
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
        {/* Lado Izquierdo (Configuración de Broker) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Selector de Plataforma */}
          <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-4">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              1. Seleccioná tu plataforma o broker
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { id: "ninjatrader", label: "NinjaTrader" },
                { id: "tradovate", label: "Tradovate API" },
                { id: "metatrader", label: "MT4 / MT5" },
                { id: "tradingview", label: "TradingView" },
                { id: "generic", label: "Otro (Genérico)" }
              ].map((plat) => (
                <button
                  key={plat.id}
                  onClick={() => {
                    setPlatform(plat.id as BrokerPlatform);
                    setParsedResult([]);
                    setCsvText("");
                    setFileName("");
                    setImageParseError("");
                  }}
                  className={`px-3 py-2.5 text-xs font-semibold rounded-lg text-center transition-all border ${
                    platform === plat.id
                      ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-md"
                      : "bg-[#16122d] text-slate-400 border-white/5 hover:border-white/10 hover:text-white"
                  }`}
                >
                  {plat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Área de Entrada Tradovate API o Uploader CSV/Report */}
          {platform === "tradovate" ? (
            <form onSubmit={handleTradovateSync} className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  Conexión Tradovate API
                </span>
                <button
                  type="button"
                  onClick={handleAutofillTradovateDemo}
                  className="bg-indigo-650/15 hover:bg-indigo-650/25 text-indigo-300 border border-indigo-500/20 rounded px-2 py-0.5 text-[10px] font-bold"
                >
                  Cargar cuenta DEMO de Test
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Usuario de Tradovate*</label>
                  <input
                    type="text"
                    required
                    placeholder="Usuario de Tradovate"
                    value={tradovateUser}
                    onChange={(e) => setTradovateUser(e.target.value)}
                    className="w-full bg-[#16122d] border border-white/10 rounded px-2.5 py-1.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Contraseña*</label>
                  <input
                    type="password"
                    required
                    placeholder="Contraseña"
                    value={tradovatePass}
                    onChange={(e) => setTradovatePass(e.target.value)}
                    className="w-full bg-[#16122d] border border-white/10 rounded px-2.5 py-1.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">App ID (ID de API)</label>
                    <input
                      type="text"
                      placeholder="TradyumApp"
                      value={tradovateAppId}
                      onChange={(e) => setTradovateAppId(e.target.value)}
                      className="w-full bg-[#16122d] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">App Version</label>
                    <input
                      type="text"
                      placeholder="1.0.0"
                      value={tradovateAppVersion}
                      onChange={(e) => setTradovateAppVersion(e.target.value)}
                      className="w-full bg-[#16122d] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-450 font-semibold">Entorno Tradovate:</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        checked={!tradovateIsLive}
                        onChange={() => setTradovateIsLive(false)}
                        className="text-indigo-600 bg-slate-900 border-white/10"
                      />
                      Demo
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-350">
                      <input
                        type="radio"
                        checked={tradovateIsLive}
                        onChange={() => setTradovateIsLive(true)}
                        className="text-indigo-600 bg-slate-900 border-white/10"
                      />
                      Real / Live
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSyncingTradovate}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 py-2.5 rounded-lg text-xs font-bold text-white transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {isSyncingTradovate ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                    Sincronizando por REST API...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Autenticar y Sincronizar Fills
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Drag & Drop Standard Uploader */
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
                  : "border-slate-800 bg-[#0d0a16]/50 hover:bg-[#140f28]/60 hover:border-slate-700 text-slate-400"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .html, .htm, image/*, .png, .jpg, .jpeg, .webp, .gif"
                onChange={handleFileChange}
                className="hidden"
              />
              {isParsingImage ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-indigo-300">
                      OCR Multimodal Inteligente...
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Gemini Flash leyéndose la captura de pantalla
                    </p>
                  </div>
                </div>
              ) : fileName ? (
                <div className="space-y-2">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 inline-block font-sans">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white max-w-[240px] truncate mx-auto">
                      {fileName}
                    </p>
                    <p className="text-[10px] text-emerald-400 mt-0.5 font-medium">
                      {fileName.match(/\.(png|jpe?g|webp|gif)$/i) ? "¡Imagen de trades decodificada!" : "¡Archivo cargado y procesado con éxito!"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-650/5 text-indigo-400 group-hover:bg-indigo-600/10 rounded-xl inline-block transition-all">
                    <Upload className="w-7 h-7 stroke-[2]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">
                      Arrastrá acá tu archivo .csv, .html o Imagen de trades
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal max-w-xs mx-auto">
                      {platform === "metatrader" 
                        ? "Soporta reportes HTML creados con 'Save as Report' en MT4/MT5 o archivos CSV."
                        : "Soporta exportaciones CSV del broker o capturas de pantalla de tu plataforma."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ayuda del Broker Seleccionado */}
          <div className="bg-[#100c22]/60 border border-white/5 rounded-xl p-3.5 space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
            <span className="font-extrabold text-white text-xs block">💡 Instrucciones de exportación:</span>
            {platform === "ninjatrader" && (
              <p>En NinjaTrader: Ve a la pestaña <span className="text-indigo-400 font-bold">Trade Performance</span> &gt; Clic derecho en el gráfico/grilla &gt; Seleccioná <span className="text-indigo-400 font-semibold">Export</span> y elegí el formato CSV estándar.</p>
            )}
            {platform === "tradovate" && (
              <p>Cargá nuestro acceso interactivo API. En modo desarrollo podés usar el botón <span className="text-indigo-300 font-semibold">Cargar cuenta DEMO</span> para realizar pruebas seguras sin credenciales corporativas.</p>
            )}
            {platform === "metatrader" && (
              <p>Fácil: Sube directamente el archivo <span className="text-indigo-400 font-bold">.html</span>. En MetaTrader, ve a <span className="text-indigo-300 font-semibold">Account History</span> &gt; Clic Derecho &gt; Seleccioná <span className="text-indigo-300 font-semibold">Save as Report</span>.</p>
            )}
            {platform === "tradingview" && (
              <p>En TradingView: Abrí la pestaña inferior <span className="text-indigo-400 font-bold">Lista de operaciones</span> de tu bridge o papel &gt; Presioná el botón de <span className="text-indigo-300 font-semibold">Exportar (ícono de descarga)</span> arriba a la derecha de la pestaña.</p>
            )}
            {platform === "generic" && (
              <p>Cualquier CSV estructurado. Abajo podés mapear a mano las posiciones de tus columnas en caso de formatos atípicos.</p>
            )}
          </div>

          {imageParseError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-400 font-mono mt-2 flex gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>⚠️ Error: {imageParseError}</span>
            </div>
          )}

          {/* Manual mapper para Generic CSV */}
          {platform === "generic" && availableHeaders.length > 0 && (
            <div className="bg-[#0b0816]/70 border border-white/5 rounded-xl p-4 space-y-3.5 animate-in slide-in-from-top-3 duration-250">
              <div className="flex items-center gap-1.5 pb-2 border-b border-white/5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">Mapeo Manual de Columnas</span>
              </div>
              
              <div className="space-y-2.5 text-xs">
                {/* Date/Time */}
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

                {/* Symbol */}
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

                {/* Net P&L */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400 font-medium shrink-0">PnL Neto *</span>
                  <select
                    value={customMap.pnlCol}
                    onChange={(e) => setCustomMap({ ...customMap, pnlCol: e.target.value })}
                    className="bg-slate-950/70 border border-white/10 rounded px-2.5 py-1 text-white text-xs max-w-[160px] truncate"
                  >
                    <option value="">Seleccionar...</option>
                    {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-2 text-[11px]">
                  <p className="text-indigo-400 font-bold italic">Opcionales (ajustan visualización):</p>
                  
                  {/* Action */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">Tipo (Compra/Venta)</span>
                    <select
                      value={customMap.actionCol || ""}
                      onChange={(e) => setCustomMap({ ...customMap, actionCol: e.target.value })}
                      className="bg-slate-950/50 border border-white/10 rounded px-2 py-0.5 text-white text-[11px] max-w-[160px]"
                    >
                      <option value="">Ninguno</option>
                      {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">Cantidad (Tamaño)</span>
                    <select
                      value={customMap.qtyCol || ""}
                      onChange={(e) => setCustomMap({ ...customMap, qtyCol: e.target.value })}
                      className="bg-slate-950/50 border border-white/10 rounded px-2 py-0.5 text-white text-[11px] max-w-[160px]"
                    >
                      <option value="">Ninguno</option>
                      {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Commissions */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">Comisiones</span>
                    <select
                      value={customMap.commCol || ""}
                      onChange={(e) => setCustomMap({ ...customMap, commCol: e.target.value })}
                      className="bg-slate-950/50 border border-white/10 rounded px-2 py-0.5 text-white text-[11px] max-w-[160px]"
                    >
                      <option value="">Ninguno</option>
                      {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botón de Vista Previa manual si usan CSV genérico cargado sin mapear */}
          {platform === "generic" && (
            <button
              disabled={!csvText}
              onClick={executePreview}
              className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                csvText
                  ? "bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white cursor-pointer shadow-lg"
                  : "bg-[#18142b] text-slate-500 cursor-not-allowed"
              }`}
            >
              Generar Vista Previa de CSV
            </button>
          )}

        </div>

        {/* Lado Derecho (Detalle del Preview e Importador) */}
        <div className="lg:col-span-7 space-y-4">
          {parsedResult.length === 0 ? (
            <div className="bg-[#0b0816]/40 border border-slate-900 rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[380px]">
              <HelpCircle className="w-10 h-10 text-slate-600 animate-pulse mb-3" />
              <p className="text-xs font-bold text-slate-300">Vista previa libre de trades</p>
              <p className="text-[11px] text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                Seleccioná tu broker o cargá capturas de pantalla, cargá la información e inmediatamente verás los resultados procesados acá.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-350">
              
              {/* Opciones De Cuenta Destino y Modo de Fusión */}
              <div className="bg-slate-950/50 border border-white/5 rounded-xl p-4.5 grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Selector de cuenta Tradyum */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-indigo-400" /> Cuenta destino en Tradyum:
                  </label>
                  <select
                    value={targetAccountId}
                    onChange={(e) => {
                      setTargetAccountId(e.target.value);
                      // Ajustar cuenta en los trades ya pre-procesados
                      setParsedResult(prev => prev.map(t => ({ ...t, accountId: e.target.value })));
                    }}
                    className="w-full bg-[#16122d] border border-white/10 rounded-lg py-2 px-3 text-white text-xs font-semibold focus:outline-none"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type} - Bal: ${acc.balance.toFixed(0)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Modo de importación */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    Modo del Período cargado:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => setImportMode("append")}
                      className={`py-2 px-2.5 rounded-lg border text-center font-bold tracking-tight transition-all ${
                        importMode === "append"
                          ? "bg-indigo-600/15 text-indigo-300 border-indigo-500/35"
                          : "bg-[#16122d] text-slate-400 border-white/5 hover:border-white/10"
                      }`}
                      title="Suma los trades sin alterar los ya registrados"
                    >
                      Sumar a existentes
                    </button>
                    <button
                      onClick={() => setImportMode("replace")}
                      className={`py-2 px-2.5 rounded-lg border text-center font-bold tracking-tight transition-all ${
                        importMode === "replace"
                          ? "bg-rose-500/15 text-rose-300 border-rose-500/25"
                          : "bg-[#16122d] text-slate-450 border-white/5 hover:border-white/10"
                      }`}
                      title="Elimina trades de este mismo rango de fechas en la cuenta antes de importar los nuevos"
                    >
                      Reemplazar Período
                    </button>
                  </div>
                </div>
              </div>

              {/* Banner de Ajuste Diagnóstico */}
              {stats && (
                <div className="bg-[#1f1737] border border-indigo-500/20 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="font-extrabold text-white">
                      Resumen del Período detectado:
                    </p>
                    <div className="text-[11px] text-indigo-200/70 space-y-0.5 leading-normal">
                      <p>
                        📅 Se detectaron <span className="text-white font-bold">{stats.count}</span> trades entre <span className="text-indigo-300 font-bold">{stats.minDate}</span> y <span className="text-indigo-300 font-bold">{stats.maxDate}</span>
                      </p>
                      <p>
                        💵 PnL neto combinado:{" "}
                        <span className={`font-bold ${stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {stats.totalPnl >= 0 ? `$${stats.totalPnl.toFixed(2)}` : `-$${Math.abs(stats.totalPnl).toFixed(2)}`}
                        </span>
                      </p>
                      {stats.duplicateCount > 0 && (
                        <p className="text-amber-400 flex items-center gap-1 font-semibold text-[10px] mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Se cruzaron {stats.duplicateCount} registros duplicados ya agregados hoy.
                        </p>
                      )}
                    </div>
                  </div>

                  {stats.duplicateCount > 0 && (
                    <div className="flex items-center gap-1.5 self-center bg-slate-950/45 p-2 rounded-lg border border-white/5">
                      <input
                        type="checkbox"
                        id="skip-dupes"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded border-white/10 text-indigo-650 bg-slate-900 w-3.5 h-3.5 cursor-pointer"
                      />
                      <label htmlFor="skip-dupes" className="text-[10px] text-slate-300 font-bold select-none cursor-pointer">
                        Omitir duplicados (Recomendado)
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Planilla de Vista Previa */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  Celdas de trades detectados listos para importar
                </span>
                
                <div className="bg-[#0b0817] border border-white/5 rounded-xl overflow-hidden max-h-[290px] overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#1b1733] text-slate-400 font-semibold sticky top-0 text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3.5">Fecha</th>
                        <th className="py-2.5 px-2">Activo</th>
                        <th className="py-2.5 px-2">Sentido</th>
                        <th className="py-2.5 px-3 text-right">PnL Neto</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                      {parsedResult.map((trade, idx) => {
                        const isDup = checkDuplicate(trade);
                        let rowClass = "text-slate-300";
                        let tagLabel = "Listo";
                        let tagClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                        
                        if (isDup) {
                          rowClass = "bg-amber-950/10 text-amber-200/85";
                          tagLabel = skipDuplicates ? "Omitido" : "Duplicado";
                          tagClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                        }

                        return (
                          <tr key={trade.id || idx} className={`${rowClass} hover:bg-white/2 transition-colors`}>
                            <td className="py-2 px-3.5">
                              <span className="block font-semibold text-slate-200">{trade.date}</span>
                              <span className="text-[10px] text-slate-500 font-medium">{trade.time}</span>
                            </td>
                            <td className="py-2 px-2">
                              <span className="bg-[#24203a] text-indigo-200 font-bold px-1.5 py-0.5 rounded text-[10px] border border-white/5">
                                {trade.symbol}
                              </span>
                            </td>
                            <td className="py-2 px-2 font-sans font-bold">
                              {trade.action === TradeAction.BUY ? (
                                <span className="text-emerald-500">COMPRA ({trade.quantity})</span>
                              ) : (
                                <span className="text-rose-500">VENTA ({trade.quantity})</span>
                              )}
                            </td>
                            <td className={`py-2 px-3 text-right font-extrabold ${trade.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {trade.pnl >= 0 ? `$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wide uppercase ${tagClass}`}>
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

              {/* Alertas de Advertencia en el Parseo */}
              {parseErrors.length > 0 && (
                <div className="bg-rose-950/20 border border-rose-500/15 rounded-xl p-3 text-[11px] text-rose-300 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Registro de alertas de formato:
                  </p>
                  <ul className="list-disc pl-4.5 space-y-0.5 font-mono">
                    {parseErrors.slice(0, 3).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {parseErrors.length > 3 && <li>Y {parseErrors.length - 3} advertencias adicionales.</li>}
                  </ul>
                </div>
              )}

              {/* Botonera de Confirmación */}
              <div className="flex items-center justify-end gap-3 pt-3">
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="bg-[#121021] hover:bg-slate-900 border border-white/5 py-2.5 px-4 rounded-lg text-xs font-semibold text-slate-300 active:scale-95 transition-all cursor-pointer"
                  >
                    Volver Al Listado
                  </button>
                )}
                
                <button
                  disabled={progressPct >= 100}
                  onClick={handleImportClick}
                  className={`py-2.5 px-6 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 ${
                    progressPct >= 100
                      ? "bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed shadow-none"
                      : "bg-[#2563eb] hover:bg-blue-700 active:scale-95 text-white shadow-blue-500/15 cursor-pointer"
                  }`}
                >
                  <CheckCheck className="w-4 h-4" /> Importar {parsedResult.filter(t => !checkDuplicate(t) || !skipDuplicates).length} Trades a Tradyum
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
