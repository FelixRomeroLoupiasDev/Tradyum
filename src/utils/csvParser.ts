/**
 * Custom robust CSV Parser and Mapper utility for NinjaTrader, MetaTrader, Tradovate and generic formats
 */

import { Trade, AssetType, TradeAction } from "../types";

export interface CSVRow {
  [key: string]: string;
}

// Highly robust CSV row tokenizer supporting quotes and commas inside quotes
export function tokenizeCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let col = "";
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        col += '"';
        i++; // skip next double quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push(col.trim());
      col = "";
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF
      }
      row.push(col.trim());
      if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
        lines.push(row);
      }
      row = [];
      col = "";
    } else {
      col += char;
    }
  }

  if (col !== "" || row.length > 0) {
    row.push(col.trim());
    if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
      lines.push(row);
    }
  }

  return lines;
}

// Parses string date & time into structured { date: "YYYY-MM-DD", time: "HH:MM" }
export function parseDateTimeStr(str: string): { date: string; time: string } {
  if (!str) return { date: "", time: "00:00" };

  let cleanStr = str.replace(/^["']|["']$/g, "").trim();

  // Handle ISO formatted timestamps (e.g., "2026-05-30T14:32:00.000Z")
  if (cleanStr.includes("T")) {
    const parts = cleanStr.split("T");
    const datePart = parts[0];
    const timePart = parts[1] ? parts[1].slice(0, 5) : "00:00";
    return { date: datePart, time: timePart };
  }

  const parts = cleanStr.split(/\s+/);
  if (parts.length >= 1) {
    const dateStr = parts[0];
    const timeStr = parts[1] || "00:00";

    const isPM = parts.some(p => p.toUpperCase() === "PM");
    const isAM = parts.some(p => p.toUpperCase() === "AM");

    let normalizedDate = "";
    const separators = /[\/\.\-]/;
    const dateComponents = dateStr.split(separators);

    if (dateComponents.length === 3) {
      const c0 = dateComponents[0];
      const c1 = dateComponents[1];
      const c2 = dateComponents[2];

      if (c2.length === 4) {
        const v0 = parseInt(c0);
        const v1 = parseInt(c1);
        if (v0 > 12) {
          // DD/MM/YYYY
          normalizedDate = `${c2}-${String(v1).padStart(2, '0')}-${String(v0).padStart(2, '0')}`;
        } else {
          // MM/DD/YYYY
          normalizedDate = `${c2}-${String(v0).padStart(2, '0')}-${String(v1).padStart(2, '0')}`;
        }
      } else if (c0.length === 4) {
        // YYYY/MM/DD
        normalizedDate = `${c0}-${String(c1).padStart(2, '0')}-${String(c2).padStart(2, '0')}`;
      } else {
        // DD/MM/YY
        const yearFull = parseInt(c2) < 50 ? `20${c2}` : `19${c2}`;
        normalizedDate = `${yearFull}-${String(c1).padStart(2, '0')}-${String(c0).padStart(2, '0')}`;
      }
    } else {
      normalizedDate = dateStr;
    }

    let hour = 0;
    let min = 0;
    const timeParts = timeStr.split(":");
    if (timeParts.length >= 2) {
      hour = parseInt(timeParts[0]);
      min = parseInt(timeParts[1]);
      if (isPM && hour < 12) {
        hour += 12;
      } else if (isAM && hour === 12) {
        hour = 0;
      }
    }
    const normalizedTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

    return { date: normalizedDate, time: normalizedTime };
  }

  return { date: "", time: "00:00" };
}

// Cleans currency values like "$1,234.50" or "($300)" or "- 400" into a simple float
export function parseCurrencyStr(str: string): number {
  if (!str) return 0;
  let s = str.trim();
  const isNegative = s.startsWith("(") && s.endsWith(")") || s.startsWith("-");
  s = s.replace(/[\$\(\)\,\s\-]/g, "");
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

// Mapping interfaces and processors for supported platforms
export type BrokerPlatform = "ninjatrader" | "metatrader" | "tradovate" | "tradingview" | "generic";

export interface MappedFields {
  dateTimeCol: string;
  symbolCol: string;
  pnlCol: string;
  actionCol?: string;
  qtyCol?: string;
  commCol?: string;
}

export function detectHeaders(headerRow: string[]): {
  ninjaMatch: boolean;
  metaMatch: boolean;
  tradoMatch: boolean;
  bestMap: MappedFields;
} {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-0]/g, "");
  const normalized = headerRow.map(norm);

  // Auto detect indicators
  const ninjaMatch = normalized.includes(norm("Entry time")) || normalized.includes(norm("Instrument"));
  const metaMatch = normalized.includes(norm("Open Time")) || normalized.includes(norm("Close Time")) || normalized.includes(norm("Symbol")) && normalized.includes(norm("Profit"));
  const tradoMatch = normalized.includes(norm("Realized P&L")) || normalized.includes(norm("Buy/Sell"));

  // Best guess default mapping
  let dateTimeCol = headerRow[0] || "";
  let symbolCol = headerRow[1] || "";
  let pnlCol = headerRow[headerRow.length - 1] || "";
  let actionCol = "";
  let qtyCol = "";
  let commCol = "";

  headerRow.forEach((h) => {
    const nh = norm(h);
    if (nh.includes("time") || nh.includes("fecha") || nh.includes("timestamp") || nh.includes("open") || nh.includes("entry")) {
      dateTimeCol = h;
    } else if (nh.includes("symbol") || nh.includes("instrument") || nh.includes("activo") || nh.includes("contract")) {
      symbolCol = h;
    } else if (nh.includes("pnl") || nh.includes("profit") || nh.includes("ganancia") || nh.includes("realized")) {
      pnlCol = h;
    } else if (nh.includes("action") || nh.includes("side") || nh.includes("buysell") || nh.includes("tipo")) {
      actionCol = h;
    } else if (nh.includes("qty") || nh.includes("quantity") || nh.includes("size") || nh.includes("cantidad") || nh.includes("vol")) {
      qtyCol = h;
    } else if (nh.includes("commission") || nh.includes("comis") || nh.includes("fee")) {
      commCol = h;
    }
  });

  return {
    ninjaMatch,
    metaMatch,
    tradoMatch,
    bestMap: { dateTimeCol, symbolCol, pnlCol, actionCol, qtyCol, commCol }
  };
}

export function parseCSVToTrades(
  text: string,
  platform: BrokerPlatform,
  customMap?: MappedFields
): { trades: Trade[]; errors: string[] } {
  const rows = tokenizeCSV(text);
  if (rows.length < 2) {
    return { trades: [], errors: ["El archivo no tiene suficientes filas para procesar."] };
  }

  const headers = rows[0];
  const { bestMap } = detectHeaders(headers);
  const map = customMap || bestMap;

  // Find column indices
  const getIndex = (colName: string) => headers.findIndex(h => h.toLowerCase() === colName.toLowerCase());

  let dtIdx = getIndex(map.dateTimeCol);
  let symIdx = getIndex(map.symbolCol);
  let pnlIdx = getIndex(map.pnlCol);
  let actIdx = map.actionCol ? getIndex(map.actionCol) : -1;
  let qtyIdx = map.qtyCol ? getIndex(map.qtyCol) : -1;
  let commIdx = map.commCol ? getIndex(map.commCol) : -1;

  // Specific platform overrides if chosen explicitly
  if (platform === "ninjatrader") {
    dtIdx = headers.findIndex(h => h.toLowerCase().includes("entry time") || h.toLowerCase() === "time");
    symIdx = headers.findIndex(h => h.toLowerCase().includes("instrument") || h.toLowerCase().includes("symbol"));
    pnlIdx = headers.findIndex(h => h.toLowerCase().includes("profit") || h.toLowerCase().includes("pnl"));
    qtyIdx = headers.findIndex(h => h.toLowerCase().includes("qty") || h.toLowerCase().includes("quantity") || h.toLowerCase().includes("size"));
    commIdx = headers.findIndex(h => h.toLowerCase().includes("commission") || h.toLowerCase().includes("fees"));
  } else if (platform === "metatrader") {
    dtIdx = headers.findIndex(h => h.toLowerCase().includes("open time") || h.toLowerCase().includes("time"));
    symIdx = headers.findIndex(h => h.toLowerCase().includes("symbol") || h.toLowerCase().includes("item") || h.toLowerCase().includes("instrument"));
    pnlIdx = headers.findIndex(h => h.toLowerCase().includes("profit") || h.toLowerCase().includes("pnl") || h.toLowerCase().includes("monto"));
    qtyIdx = headers.findIndex(h => h.toLowerCase().includes("size") || h.toLowerCase().includes("volume") || h.toLowerCase().includes("qty"));
  } else if (platform === "tradovate") {
    dtIdx = headers.findIndex(h => h.toLowerCase().includes("timestamp") || h.toLowerCase().includes("time") || h.toLowerCase().includes("date"));
    symIdx = headers.findIndex(h => h.toLowerCase().includes("symbol") || h.toLowerCase().includes("contract"));
    pnlIdx = headers.findIndex(h => h.toLowerCase().includes("realized p&l") || h.toLowerCase().includes("p&l") || h.toLowerCase().includes("profit") || h.toLowerCase().includes("pnl"));
    actIdx = headers.findIndex(h => h.toLowerCase().includes("buy/sell") || h.toLowerCase().includes("action"));
  } else if (platform === "tradingview") {
    dtIdx = headers.findIndex(h => h.toLowerCase().includes("time") || h.toLowerCase().includes("date") || h.toLowerCase().includes("fecha") || h.toLowerCase() === "datetime");
    symIdx = headers.findIndex(h => h.toLowerCase().includes("symbol") || h.toLowerCase().includes("ticker") || h.toLowerCase().includes("instrument") || h.toLowerCase().includes("asset"));
    pnlIdx = headers.findIndex(h => h.toLowerCase().includes("pnl") || h.toLowerCase().includes("profit") || h.toLowerCase().includes("realized") || h.toLowerCase().includes("loss"));
    qtyIdx = headers.findIndex(h => h.toLowerCase().includes("size") || h.toLowerCase().includes("qty") || h.toLowerCase().includes("contracts") || h.toLowerCase().includes("volume"));
    actIdx = headers.findIndex(h => h.toLowerCase().includes("type") || h.toLowerCase().includes("action") || h.toLowerCase().includes("side") || h.toLowerCase().includes("signal"));
  }

  // Fallbacks
  if (dtIdx === -1) dtIdx = 0;
  if (symIdx === -1) symIdx = Math.min(1, headers.length - 1);
  if (pnlIdx === -1) pnlIdx = headers.length - 1;

  const trades: Trade[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < Math.max(dtIdx, symIdx, pnlIdx) + 1) {
      continue; // Skip empty/broken lines
    }

    try {
      const pnlRaw = row[pnlIdx] || "";
      const pnl = parseCurrencyStr(pnlRaw);

      const symbolRaw = row[symIdx] || "DESCONOCIDO";
      const symbol = symbolRaw.replace(/^["']|["']$/g, "").trim().toUpperCase();

      const dtRaw = row[dtIdx] || "";
      const { date, time } = parseDateTimeStr(dtRaw);

      if (!date) {
        errors.push(`Fila ${i + 1}: No se pudo extraer una fecha válida de "${dtRaw}".`);
        continue;
      }

      // Read optional Action
      let actionValue = TradeAction.BUY;
      if (actIdx !== -1 && row[actIdx]) {
        const rawAct = row[actIdx].toLowerCase();
        if (rawAct.includes("sell") || rawAct.includes("venta") || rawAct.startsWith("s") || rawAct.startsWith("v")) {
          actionValue = TradeAction.SELL;
        }
      } else if (pnl < 0 && actIdx === -1) {
        // Just default but keep BUY as fallback
        actionValue = TradeAction.BUY;
      }

      // Read optional Qty
      let qty = 1;
      if (qtyIdx !== -1 && row[qtyIdx]) {
        const parsedQty = parseInt(row[qtyIdx].replace(/[^\d]/g, ""));
        if (!isNaN(parsedQty) && parsedQty > 0) {
          qty = parsedQty;
        }
      }

      // Read optional Commission
      let comm = 0;
      if (commIdx !== -1 && row[commIdx]) {
        comm = Math.abs(parseCurrencyStr(row[commIdx]));
      }

      const netPnl = pnl - comm;
      const status = netPnl > 0.01 ? "Win" : netPnl < -0.01 ? "Loss" : "Flat";

      // Detect asset type automatically by symbol
      let assetType = AssetType.FUTURES;
      const cleanSym = symbol.toUpperCase();
      if (cleanSym.includes("BTC") || cleanSym.includes("ETH") || cleanSym.includes("SOL") || cleanSym.includes("USDT")) {
        assetType = AssetType.CRYPTO;
      } else if (cleanSym.length === 6 && !cleanSym.includes("/") && ["EUR", "USD", "GBP", "JPY", "AUD", "CAD", "CHF"].some(x => cleanSym.includes(x))) {
        assetType = AssetType.FOREX;
      } else if (cleanSym.includes("/") && (cleanSym.includes("EUR") || cleanSym.includes("USD") || cleanSym.includes("GBP"))) {
        assetType = AssetType.FOREX;
      } else if (["AAPL", "TSLA", "MSFT", "AMZN", "NVDA", "META", "GOOG"].some(x => cleanSym === x)) {
        assetType = AssetType.STOCK;
      }

      const uniqueTradeId = `csv_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`;

      trades.push({
        id: uniqueTradeId,
        date,
        time,
        symbol,
        assetType,
        action: actionValue,
        quantity: qty,
        entryPrice: 0, // Placeholder
        exitPrice: 0,  // Placeholder
        commissions: comm,
        fees: 0,
        setups: ["Importado"],
        mistakes: [],
        notes: `Importado de CSV (${platform})`,
        pnl,
        netPnl,
        status
      } as any as Trade);
    } catch (e: any) {
      errors.push(`Fila ${i + 1}: Error procesando datos: ${e.message}`);
    }
  }

  return { trades, errors };
}
