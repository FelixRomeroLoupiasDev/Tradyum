/**
 * Parser de MetaTrader 5 (MT5)
 * 
 * Método: Soporta tanto reportes HTML ("Save as Report") como exportaciones CSV del Account History.
 * En MT5: Account History > Clic Derecho > Save as Report (HTML) o exportar como CSV.
 * 
 * Ejemplo de Reporte CSV / Columnas de prueba de MT5:
 * Position,Symbol,Type,Volume,Open Price,Close Price,Open Time,Close Time,Commission,Swap,Profit
 * 148293,EURUSD,buy,0.50,1.08500,1.08900,2026.06.01 10:00:00,2026.06.01 11:30:00,-2.50,0.00,200.00
 * 148294,US30,sell,1.00,38500.0,38450.0,2026.06.01 14:00:00,2026.06.01 14:45:00,-5.00,0.00,50.00
 */

import { normalizeTrade } from "../shared/normalizer.js";

/**
 * Parsea el reporte HTML o CSV de MT5 y lo convierte al estándar de Tradyum
 * @param {string} rawContent - Contenido crudo del reporte (.html o .csv)
 * @param {string} fileName - Nombre del archivo para debug
 * @returns {Array<Object>} Lista de trades normalizados
 */
export function parseMT5Report(rawContent, fileName = "") {
  if (!rawContent) return [];

  const isHtml = rawContent.toLowerCase().includes("<html") || rawContent.toLowerCase().includes("<table");

  if (isHtml) {
    return parseMT5Html(rawContent);
  } else {
    return parseMT5Csv(rawContent);
  }
}

/**
 * Extractor para formato HTML MT5 similar a MT4 pero adecuado para el estándar MT5.
 */
function parseMT5Html(htmlString) {
  const trades = [];
  
  // Buscar filas de la tabla de órdenes cerradas ('Closed Transactions')
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let match;
  while ((match = trRegex.exec(htmlString)) !== null) {
    const trContent = match[1];
    const cells = [];
    let tdMatch;
    
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      const cleanVal = tdMatch[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
      cells.push(cleanVal);
    }

    // MT5 suele tener entre 11 y 15 columnas dependiendo del broker.
    // Columnas típicas: Ticket, Symbol, Type, Volume, Open Time, Open Price, Close Time, Close Price, Commission, Swap, Profit...
    if (cells.length >= 10) {
      const ticket = cells[0];
      const symbol = cells[1];
      const type = cells[2] ? cells[2].toLowerCase() : "";
      const volumeStr = cells[3];
      const openTime = cells[4];
      const openPrice = cells[5];
      const closeTime = cells[6];
      const closePrice = cells[7];
      const commissionStr = cells[8];
      const swapStr = cells.length > 9 ? cells[9] : "0";
      const profitStr = cells[cells.length - 1];

      // Omitir balance inicial o depósitos
      if (type.includes("balance") || type.includes("deposit") || type.includes("withdraw") || isNaN(parseInt(ticket)) || !symbol) {
        continue;
      }

      if (type !== "buy" && type !== "sell") {
        continue;
      }

      const qty = parseFloat(volumeStr) || 1.0;
      const profit = parseFloat(profitStr.replace(/[^0-9.-]/g, "")) || 0;
      const commission = parseFloat(commissionStr.replace(/[^0-9.-]/g, "")) || 0;
      const swap = parseFloat(swapStr.replace(/[^0-9.-]/g, "")) || 0;

      let isoDate = closeTime;
      if (closeTime) {
        const formattedDateStr = closeTime.replace(/\./g, "/");
        const parsedD = new Date(formattedDateStr);
        if (!isNaN(parsedD.getTime())) {
          isoDate = parsedD.toISOString();
        }
      }

      const rawData = {
        positionId: ticket,
        symbol,
        type,
        volume: qty,
        openTime,
        openPrice,
        closeTime,
        closePrice,
        commission,
        swap,
        profit
      };

      const item = {
        symbol: symbol.toUpperCase().trim(),
        market: "Forex", // MT5 suele ser CFDs de Índices, Commodities o Forex
        type: type === "buy" ? "Long" : "Short",
        account: "MT5 Report",
        quantity: qty,
        pnl: profit + commission + swap,
        date: isoDate,
        notes: `Importado de MT5 HTML (Ticket de Posición #${ticket})`,
        broker: "mt5",
        rawData: rawData
      };

      const n = normalizeTrade(item);
      if (n) trades.push(n);
    }
  }

  return trades;
}

/**
 * Extractor para el formato CSV exportado de MT5
 */
function parseMT5Csv(csvString) {
  const lines = csvString.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const trades = [];
  const headers = lines[0].split(",").map(h => h.toLowerCase().trim());
  
  const ticketIdx = headers.findIndex(h => h.includes("position") || h.includes("ticket") || h === "id");
  const symbolIdx = headers.findIndex(h => h.includes("symbol") || h.includes("instrument") || h.includes("ticker"));
  const typeIdx = headers.findIndex(h => h.includes("type") || h.includes("side") || h === "action");
  const qtyIdx = headers.findIndex(h => h.includes("volume") || h.includes("qty") || h.includes("size") || h.includes("cantidad"));
  const closeTimeIdx = headers.findIndex(h => h.includes("close time") || h.includes("time") || h === "fecha" || h.includes("date"));
  const commIdx = headers.findIndex(h => h.includes("commission") || h.includes("comision") || h === "fee");
  const profitIdx = headers.findIndex(h => h.includes("profit") || h.includes("pnl") || h.includes("gain") || h === "p&l");

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
    if (cols.length < 2) continue;

    const type = typeIdx !== -1 ? cols[typeIdx].toLowerCase() : "";
    if (type.includes("balance") || type.includes("deposit") || type.includes("withdrawal")) {
      continue;
    }

    const ticket = ticketIdx !== -1 ? cols[ticketIdx] : String(i);
    const symbol = symbolIdx !== -1 ? cols[symbolIdx] : "EURUSD";
    const qty = qtyIdx !== -1 ? parseFloat(cols[qtyIdx]) : 1.0;
    const rawProfit = profitIdx !== -1 ? parseFloat(cols[profitIdx]) : 0;
    const rawComm = commIdx !== -1 ? parseFloat(cols[commIdx]) : 0;
    const closeTime = closeTimeIdx !== -1 ? cols[closeTimeIdx] : new Date().toISOString();

    const isBuy = type.includes("buy") || type.includes("long");

    let isoDate = closeTime;
    const parsedD = new Date(closeTime.replace(/\./g, "/"));
    if (!isNaN(parsedD.getTime())) {
      isoDate = parsedD.toISOString();
    }

    const item = {
      symbol: symbol.toUpperCase(),
      market: "Forex", 
      type: isBuy ? "Long" : "Short",
      account: "MT5 CSV Export",
      quantity: qty,
      pnl: rawProfit + rawComm,
      date: isoDate,
      notes: `Importado de MT5 CSV (Posición #${ticket})`,
      broker: "mt5",
      rawData: cols
    };

    const n = normalizeTrade(item);
    if (n) trades.push(n);
  }

  return trades;
}
