/**
 * Parser de NinjaTrader (CSV)
 * 
 * Método: Exportación de CSV desde Trade Performance.
 * Ruta típica: NinjaTrader > File > Export > Trade Performance.
 * 
 * Ejemplo de CSV de prueba:
 * Instrument,Account,Direction,Qty,Entry price,Exit price,Entry time,Exit time,Commission,Profit
 * NQ 09-26,Sim101,Buy,1,18450.25,18465.75,2026-06-02 14:15:30,2026-06-02 14:28:45,2.02,307.96
 * ES 09-26,Sim101,Sell,2,5320.50,5315.00,2026-06-02 15:40:10,2026-06-02 15:52:12,4.04,545.96
 * CL 10-26,Sim101,Buy,1,74.50,74.10,2026-06-02 16:10:00,2026-06-02 16:15:00,2.10,-402.10
 */

import { normalizeTrade } from "../shared/normalizer.js";

/**
 * Función que tokeniza una línea de CSV respetando posibles comillas
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
 * Parsea el texto del CSV de NinjaTrader y devuelve un array de Trades normalizados
 * @param {string} csvText - Texto crudo del archivo CSV
 * @returns {Array<Object>} Array de trades normalizados
 */
export function parseNinjaTraderCSV(csvText) {
  if (!csvText) return [];

  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Parsear cabecera para mapear dinámicamente columnas por nombre (así evitamos romper si el orden cambia)
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/["']/g, "").trim());

  const getIndex = (possibleNames) => {
    return headers.findIndex(h => possibleNames.some(name => h.includes(name) || h === name));
  };

  const instrumentIdx = getIndex(["instrument", "ticker", "symbol", "contrato"]);
  const accountIdx = getIndex(["account", "cuenta"]);
  const directionIdx = getIndex(["direction", "side", "tipo", "action", "buy/sell"]);
  const qtyIdx = getIndex(["qty", "quantity", "contracts", "cantidad", "size"]);
  const entryPriceIdx = getIndex(["entry price", "precio de entrada", "entryprice"]);
  const exitPriceIdx = getIndex(["exit price", "precio de salida", "exitprice"]);
  const entryTimeIdx = getIndex(["entry time", "fecha de entrada", "entrytime"]);
  const exitTimeIdx = getIndex(["exit time", "fecha de salida", "exittime", "time", "date"]);
  const commissionIdx = getIndex(["commission", "comision", "commissions", "fees"]);
  const profitIdx = getIndex(["profit", "pnl", "p&l", "realized", "ganancia", "resultado"]);

  const trades = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = parseCSVLine(line);

    if (columns.length < 2) continue;

    // Extraer campos según índices de cabecera detectados
    const rawInstrument = instrumentIdx !== -1 ? columns[instrumentIdx] : "NQ";
    const rawAccount = accountIdx !== -1 ? columns[accountIdx] : "NinjaTrader Account";
    const rawDirection = directionIdx !== -1 ? columns[directionIdx] : "Buy";
    const rawQty = qtyIdx !== -1 ? parseFloat(columns[qtyIdx]) : 1;
    const rawExitTime = exitTimeIdx !== -1 ? columns[exitTimeIdx] : new Date().toISOString();
    const rawComm = commissionIdx !== -1 ? parseFloat(columns[commissionIdx]) : 0;
    const rawProfit = profitIdx !== -1 ? parseFloat(columns[profitIdx].replace(/[$,]/g, "")) : 0;

    // Normalizar dirección "long" o "short"
    let action = "Long";
    if (rawDirection.toLowerCase().includes("short") || rawDirection.toLowerCase().includes("sell") || rawDirection.toLowerCase() === "s") {
      action = "Short";
    }

    // Limpiar símbolo de contratos ej. "NQ 09-26" a "NQ"
    let cleanSymbol = rawInstrument.replace(/["']/g, "").trim();
    if (cleanSymbol.includes(" ")) {
      cleanSymbol = cleanSymbol.split(" ")[0]; // ej: NQ 09-26 -> NQ
    }

    // Convertir Exit Time a formato ISO legible
    let dateStr = rawExitTime;
    // NinjaTrader suele dar fechas en formato yyyy-MM-dd HH:mm:ss
    const parsedDate = new Date(dateStr.replace(/-/g, "/")); // Reemplazos para compatibilidad de IE/Safari
    const finalISO = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();

    const rawData = {
      instrument: rawInstrument,
      account: rawAccount,
      direction: rawDirection,
      qty: rawQty,
      entryPrice: entryPriceIdx !== -1 ? parseFloat(columns[entryPriceIdx]) : null,
      exitPrice: exitPriceIdx !== -1 ? parseFloat(columns[exitPriceIdx]) : null,
      entryTime: entryTimeIdx !== -1 ? columns[entryTimeIdx] : null,
      exitTime: rawExitTime,
      commission: rawComm,
      profit: rawProfit
    };

    // Mapeamos temporalmente al trade crudo antes de pasarlo al normalizador
    const item = {
      symbol: cleanSymbol,
      market: "Futures", // NinjaTrader opera futuros principalmente
      type: action,
      account: rawAccount,
      quantity: isNaN(rawQty) ? 1 : rawQty,
      pnl: isNaN(rawProfit) ? 0 : rawProfit - (isNaN(rawComm) ? 0 : rawComm),
      date: finalISO,
      notes: "Importado de NinjaTrader CSV Report",
      broker: "ninjatrader",
      rawData: rawData
    };

    const normalized = normalizeTrade(item);
    if (normalized) {
      trades.push(normalized);
    }
  }

  return trades;
}
