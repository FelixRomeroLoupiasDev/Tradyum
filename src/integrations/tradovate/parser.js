/**
 * Parser de Tradovate REST API
 * 
 * Método: Procesa los fills / ejecuciones de órdenes obtenidos desde la API de Tradovate.
 * 
 * Ejemplo de JSON de prueba (Respuesta típica de /fill/list o similar de Tradovate API):
 * [
 *   {
 *     "id": 9876543,
 *     "orderId": 1234567,
 *     "contractId": 384729,
 *     "timestamp": "2026-06-02T14:15:30.000Z",
 *     "activeSide": "Buy",
 *     "price": 18450.25,
 *     "qty": 1,
 *     "pnl": 120.00,
 *     "accountName": "DEMO-101",
 *     "symbol": "NQM6"
 *   },
 *   {
 *     "id": 9876544,
 *     "orderId": 1234568,
 *     "contractId": 384729,
 *     "timestamp": "2026-06-02T14:28:45.000Z",
 *     "activeSide": "Sell",
 *     "price": 18465.75,
 *     "qty": 1,
 *     "pnl": -45.00,
 *     "accountName": "DEMO-101",
 *     "symbol": "ESM6"
 *   }
 * ]
 */

import { normalizeTrade } from "../shared/normalizer.js";

/**
 * Parsea un array de ejecuciones o fills desde Tradovate y devuelve un array de Trades normalizados de Tradyum.
 * Tiene resiliencia si los campos varían ligeramente.
 * 
 * @param {Array<Object>} rawFills - Listado crudo de fills de Tradovate
 * @returns {Array<Object>} Lista de trades normalizados
 */
export function parseTradovateFills(rawFills) {
  if (!rawFills || !Array.isArray(rawFills)) return [];

  return rawFills.map((fill, index) => {
    // Dedure el símbolo de Tradovate contrato ej: "NQM6" -> "NQ", "ESH6" -> "ES"
    let rawSymbol = fill.symbol || fill.contractId || "NQ";
    let symbol = String(rawSymbol).toUpperCase().trim();
    
    // Simplificar tickers de futuros continuos o mensuales
    if (symbol.startsWith("NQ")) symbol = "NQ";
    else if (symbol.startsWith("ES")) symbol = "ES";
    else if (symbol.startsWith("YM")) symbol = "YM";
    else if (symbol.startsWith("RTY")) symbol = "RTY";
    else if (symbol.startsWith("CL")) symbol = "CL";
    else if (symbol.startsWith("GC")) symbol = "GC";

    // P&L y Comisiones
    const pnl = parseFloat(fill.pnl) || 0.0;
    const qty = parseInt(fill.qty || fill.quantity) || 1;

    // Acción
    const side = (fill.activeSide || fill.side || "Buy").toLowerCase();
    const action = side.includes("sell") || side.includes("short") ? "Short" : "Long";

    // Cuenta
    const account = fill.accountName || fill.accountId || "Tradovate Demo";

    // Fecha en ISO
    const date = fill.timestamp || fill.date || new Date().toISOString();

    const rawData = {
      fillId: fill.id,
      orderId: fill.orderId,
      contractId: fill.contractId,
      timestamp: fill.timestamp,
      price: fill.price,
      qty: fill.qty,
      pnl: fill.pnl,
      accountName: fill.accountName,
      symbol: fill.symbol
    };

    // Construcción del objeto pre-normalizado
    const item = {
      symbol: symbol,
      market: "Futures", // Tradovate se especializa en Futuros
      type: action,
      account: account,
      quantity: qty,
      pnl: pnl,
      date: date,
      notes: fill.notes || `Sincronizado vía Tradovate API (ID Fill: ${fill.id || index})`,
      broker: "tradovate",
      rawData: rawData
    };

    return normalizeTrade(item);
  }).filter(t => t !== null);
}
