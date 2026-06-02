/**
 * Parser de TradingView
 * 
 * Método: Exportación de CSV desde la ventana "Lista de operaciones" (Trade List) o "Paper Trading / Broker Bridge".
 * En TV: Lista de operaciones > Export trades (ícono descarga arriba a la derecha de la pestaña).
 * 
 * Ejemplo de CSV de prueba:
 * Symbol,Side,Qty,Entry,Exit,P&L,Date
 * MNQ1!,Long,2,18500.50,18520.25,79.00,2026-06-02T13:45:00Z
 * BTCUSD,Short,0.1,68250.00,68100.00,15.00,2026-06-02T14:10:15Z
 * AAPL,Long,10,192.50,191.00,-15.00,2026-06-02T15:20:00Z
 */

import { normalizeTrade } from "../shared/normalizer.js";

/**
 * Tokeniza una línea de CSV de TradingView
 */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parsea el CSV exportado de TradingView y devuelve un array de Trades normalizados de Tradyum
 * @param {string} csvText - Contenido del CSV de TradingView
 * @returns {Array<Object>} Lista de trades de Tradyum
 */
export function parseTradingViewCSV(csvText) {
  if (!csvText) return [];

  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Cabecera
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/["']/g, "").trim());

  const getIndex = (possibleNames) => {
    return headers.findIndex(h => possibleNames.some(name => h.includes(name) || h === name));
  };

  const symbolIdx = getIndex(["symbol", "ticker", "símbolo", "instrument", "asset"]);
  const sideIdx = getIndex(["side", "direction", "tipo", "acción", "buy/sell", "action", "lado"]);
  const qtyIdx = getIndex(["qty", "quantity", "size", "cantidad", "volumen", "contracts"]);
  const entryIdx = getIndex(["entry", "entry price", "entrada", "precio entrada", "buy price"]);
  const exitIdx = getIndex(["exit", "exit price", "salida", "precio salida", "sell price"]);
  const pnlIdx = getIndex(["p&l", "pnl", "profit", "realised", "ganancia", "pérdida", "pérdidas"]);
  const dateIdx = getIndex(["date", "time", "fecha", "timestamp", "datetime"]);

  const trades = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = parseCSVLine(line);

    if (columns.length < 2) continue;

    const rawSymbol = symbolIdx !== -1 ? columns[symbolIdx] : "SOLUSDT";
    const rawSide = sideIdx !== -1 ? columns[sideIdx] : "Long";
    const rawQty = qtyIdx !== -1 ? parseFloat(columns[qtyIdx]) : 1;
    const rawEntry = entryIdx !== -1 ? parseFloat(columns[entryIdx]) : 0;
    const rawExit = exitIdx !== -1 ? parseFloat(columns[exitIdx]) : 0;
    const rawPnl = pnlIdx !== -1 ? parseFloat(columns[pnlIdx].replace(/[$,]/g, "")) : 0;
    const rawDate = dateIdx !== -1 ? columns[dateIdx] : new Date().toISOString();

    // Simplificar tickers de futuros continuos de TradingView ej: "MNQ1!" -> "NQ"
    let cleanSymbol = rawSymbol.replace(/["']/g, "").trim();
    if (cleanSymbol.endsWith("1!")) {
      cleanSymbol = cleanSymbol.slice(0, -2);
    }
    if (cleanSymbol.endsWith("!")) {
      cleanSymbol = cleanSymbol.slice(0, -1);
    }

    // Determinar clase de mercado implícita por longitud y terminación de ticker
    let market = "Stocks";
    if (cleanSymbol.endsWith("USDT") || cleanSymbol.endsWith("BTC") || cleanSymbol.endsWith("ETH") || cleanSymbol === "BTCUSD" || cleanSymbol === "ETHUSD") {
      market = "Crypto";
    } else if (cleanSymbol.length === 6 && (cleanSymbol.startsWith("EUR") || cleanSymbol.startsWith("GBP") || cleanSymbol.startsWith("USD") || cleanSymbol.startsWith("AUD"))) {
      market = "Forex";
    } else if (cleanSymbol === "NQ" || cleanSymbol === "ES" || cleanSymbol === "YM" || cleanSymbol === "CL" || cleanSymbol === "GC") {
      market = "Futures";
    }

    const type = rawSide.toLowerCase().includes("short") || rawSide.toLowerCase().includes("sell") ? "Short" : "Long";

    const rawData = {
      symbol: rawSymbol,
      side: rawSide,
      qty: rawQty,
      entry: rawEntry,
      exit: rawExit,
      pnl: rawPnl,
      date: rawDate
    };

    // Objeto pre-normalizado
    const item = {
      symbol: cleanSymbol,
      market: market,
      type: type,
      account: "TradingView Paper",
      quantity: isNaN(rawQty) ? 1 : rawQty,
      pnl: isNaN(rawPnl) ? 0 : rawPnl,
      date: rawDate,
      notes: `Importado de TradingView Trade List. Entry Price: ${rawEntry} | Exit Price: ${rawExit}`,
      broker: "tradingview",
      rawData: rawData
    };

    const normalized = normalizeTrade(item);
    if (normalized) {
      trades.push(normalized);
    }
  }

  return trades;
}
