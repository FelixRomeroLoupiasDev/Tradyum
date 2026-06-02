import { parseMT5Report } from "./parser.js";

/**
 * Función central de importación para MetaTrader 5.
 * Recibe el contenido de un reporte HTML o un archivo CSV de MT5, y devuelve la lista de trades normalizados de Tradyum.
 * 
 * @param {string} rawContent - Contenido de reporte de MT5
 * @param {string} fileName - Nombre del archivo original (opcional)
 * @returns {Array<Object>} Lista de trades normalizados
 */
export function importFromMT5(rawContent, fileName = "") {
  try {
    return parseMT5Report(rawContent, fileName);
  } catch (error) {
    console.error("Error importando de MT5:", error);
    return [];
  }
}
