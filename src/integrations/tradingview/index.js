import { parseTradingViewCSV } from "./parser.js";

/**
 * Función central de importación para TradingView.
 * Toma el texto CSV exportado de la Trade List de TradingView, lo parsea y normaliza al estándar de Tradyum.
 * 
 * @param {string} csvText - Texto del CSV de TradingView
 * @returns {Array<Object>} Lista de trades normalizados
 */
export function importFromTradingView(csvText) {
  try {
    return parseTradingViewCSV(csvText);
  } catch (error) {
    console.error("Error importando de TradingView:", error);
    return [];
  }
}
