/**
 * Parser de MetaTrader 4 (MT4)
 * 
 * Método: Soporta tanto reportes HTML ("Save as Report") como exportaciones CSV del Account History.
 * En MT4: Account History > Clic Derecho > Save as Report (HTML) o exportar como CSV.
 * 
 * Ejemplo de Reporte HTML de MT4:
 * <tr bgcolor="#FFFFFF" align="right">
 *   <td class="msdate">2026.06.01 10:15:30</td>
 *   <td>12345678</td>
 *   <td class="msdate">buy</td>
 *   <td>0.10</td>
 *   <td>eurusd</td>
 *   <td>1.08500</td>
 *   <td>1.08200</td>
 *   <td>1.09000</td>
 *   <td class="msdate">2026.06.01 12:30:15</td>
 *   <td>1.08950</td>
 *   <td>-1.20</td>
 *   <td>0.00</td>
 *   <td>0.00</td>
 *   <td class="mscontent">45.00</td>
 * </tr>
 */

import { normalizeTrade } from "../shared/normalizer.js";

/**
 * Parsea el reporte HTML o CSV de MT4 y lo convierte al estándar de Tradyum
 * @param {string} rawContent - Contenido crudo del reporte (.html o .csv)
 * @param {string} fileName - Nombre del archivo para debug
 * @returns {Array<Object>} Lista de trades normalizados
 */
export function parseMT4Report(rawContent, fileName = "") {
  if (!rawContent) return [];

  const isHtml = rawContent.toLowerCase().includes("<html") || rawContent.toLowerCase().includes("<table");

  if (isHtml) {
    return parseMT4Html(rawContent);
  } else {
    return parseMT4Csv(rawContent);
  }
}

/**
 * Extractor de HTML de MT4 usando expresiones regulares seguras (independiente de librerías tipo DOM o cheerio)
 */
function parseMT4Html(htmlString) {
  const trades = [];
  
  // Buscar filas de la tabla de órdenes cerradas ('Closed Transactions')
  // Estructura típica: <tr> con celdas conteniendo fecha, ticket, tipo (buy/sell), tamaño, símbolo, precio, etc.
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let match;
  while ((match = trRegex.exec(htmlString)) !== null) {
    const trContent = match[1];
    const cells = [];
    let tdMatch;
    
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      // Limpiar etiquetas html internas y espacios extras
      const cleanVal = tdMatch[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
      cells.push(cleanVal);
    }

    // Un trade de cerrado válido en MT4 tiene entre 11 y 15 columnas
    // Columnas típicas: Ticket, Open Time, Type, Size, Item, Price, S/L, T/P, Close Time, Price, Commission, Taxes, Swap, Profit
    // No procesamos filas de balance (ej: "Deposit", "Withdrawal")
    if (cells.length >= 12) {
      const ticket = cells[0];
      const openTime = cells[1];
      const type = cells[2] ? cells[2].toLowerCase() : "";
      const sizeStr = cells[3];
      const itemSymbol = cells[4];
      const openPrice = cells[5];
      const sl = cells[6];
      const tp = cells[7];
      const closeTime = cells[8];
      const closePrice = cells[9];
      const commissionStr = cells[10];
      const taxesStr = cells.length > 11 ? cells[11] : "0";
      const swapStr = cells.length > 12 ? cells[12] : "0";
      const profitStr = cells[cells.length - 1]; // El Profit neto o balance suele ser la última columna

      // Omitir balance inicial, depósitos, cancelaciones o cabeceras
      if (type.includes("balance") || type.includes("deposit") || type.includes("credit") || type.includes("withdrawal") || isNaN(parseInt(ticket))) {
        continue;
      }

      // Validar si tipo es buy o sell
      if (type !== "buy" && type !== "sell") {
        continue;
      }

      const qty = parseFloat(sizeStr) || 1;
      const profit = parseFloat(profitStr.replace(/[^0-9.-]/g, "")) || 0;
      const commission = parseFloat(commissionStr.replace(/[^0-9.-]/g, "")) || 0;
      const taxes = parseFloat(taxesStr.replace(/[^0-9.-]/g, "")) || 0;
      const swap = parseFloat(swapStr.replace(/[^0-9.-]/g, "")) || 0;

      // Convertir fecha de MT4 (ej: 2026.06.01 12:30:15) a ISO
      let isoDate = closeTime;
      if (closeTime) {
        // Reemplazar puntos por barras diagonales para que la fecha sea parseada correctamente
        const formattedDateStr = closeTime.replace(/\./g, "/");
        const parsedD = new Date(formattedDateStr);
        if (!isNaN(parsedD.getTime())) {
          isoDate = parsedD.toISOString();
        }
      }

      const rawData = {
        ticket,
        openTime,
        type,
        size: qty,
        itemSymbol,
        openPrice,
        closeTime,
        closePrice,
        commission,
        swap,
        taxes,
        profit
      };

      const item = {
        symbol: itemSymbol ? itemSymbol.toUpperCase().trim() : "EURUSD",
        market: "Forex", // MT4 es típicamente Forex o CFDs
        type: type === "buy" ? "Long" : "Short",
        account: "MT4 Report",
        quantity: qty,
        pnl: profit + commission + taxes + swap, // P&L Neto
        date: isoDate,
        notes: `Importado de MT4 Report (Ticket #${ticket})`,
        broker: "mt4",
        rawData: rawData
      };

      const n = normalizeTrade(item);
      if (n) trades.push(n);
    }
  }

  return trades;
}

/**
 * Extractor para el formato CSV de MT4
 */
function parseMT4Csv(csvString) {
  const lines = csvString.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const trades = [];
  const headers = lines[0].split(",").map(h => h.toLowerCase().trim());
  
  // Buscar índices necesarios
  const ticketIdx = headers.findIndex(h => h.includes("ticket") || h === "id");
  const timeIdx = headers.findIndex(h => h.includes("close time") || h.includes("time") || h === "time" || h.includes("fecha"));
  const typeIdx = headers.findIndex(h => h.includes("type") || h.includes("action") || h.includes("tipo") || h === "side");
  const sizeIdx = headers.findIndex(h => h.includes("size") || h.includes("volume") || h.includes("qty") || h.includes("cantidad"));
  const itemIdx = headers.findIndex(h => h.includes("item") || h.includes("symbol") || h.includes("ticker") || h.includes("instrumento"));
  const profitIdx = headers.findIndex(h => h.includes("profit") || h.includes("gain") || h.includes("p&l") || h === "pnl");
  const commIdx = headers.findIndex(h => h.includes("commission") || h.includes("comision") || h.includes("fee"));

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
    if (cols.length < 2) continue;

    const ticket = ticketIdx !== -1 ? cols[ticketIdx] : String(i);
    const type = typeIdx !== -1 ? cols[typeIdx].toLowerCase() : "buy";
    
    if (type.includes("deposit") || type.includes("balance") || type.includes("withdraw")) {
      continue;
    }

    const itemSymbol = itemIdx !== -1 ? cols[itemIdx] : "EURUSD";
    const qty = sizeIdx !== -1 ? parseFloat(cols[sizeIdx]) : 1.0;
    const rawProfit = profitIdx !== -1 ? parseFloat(cols[profitIdx]) : 0;
    const rawComm = commIdx !== -1 ? parseFloat(cols[commIdx]) : 0;
    const closeTime = timeIdx !== -1 ? cols[timeIdx] : new Date().toISOString();

    const entryText = type.includes("buy") || type.includes("long") ? "Long" : "Short";

    let isoDate = closeTime;
    const parsedD = new Date(closeTime.replace(/\./g, "/"));
    if (!isNaN(parsedD.getTime())) {
      isoDate = parsedD.toISOString();
    }

    const item = {
      symbol: itemSymbol.toUpperCase(),
      market: "Forex",
      type: entryText,
      account: "MT4 CSV Export",
      quantity: qty,
      pnl: rawProfit + rawComm,
      date: isoDate,
      notes: `Importado de MT4 CSV (Ticket #${ticket})`,
      broker: "mt4",
      rawData: cols
    };

    const n = normalizeTrade(item);
    if (n) trades.push(n);
  }

  return trades;
}
