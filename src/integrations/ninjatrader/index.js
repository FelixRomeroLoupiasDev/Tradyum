import { parseNinjaTraderCSV } from "./parser.js";

/**
 * Función central de importación para NinjaTrader.
 * Lee un archivo de texto plano CSV y devuelve un array de Trades normalizados de Tradyum.
 * 
 * @param {string} csvText - Contenido del CSV exportado de NinjaTrader
 * @returns {Array<Object>} Lista de trades normalizados de Tradyum
 */
export function importFromNinjaTrader(csvText) {
  try {
    return parseNinjaTraderCSV(csvText);
  } catch (error) {
    console.error("Error importando de NinjaTrader:", error);
    return [];
  }
}
