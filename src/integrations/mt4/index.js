import { parseMT4Report } from "./parser.js";

/**
 * Función central de importación para MetaTrader 4.
 * Recibe el contenido de un reporte HTML o un archivo CSV de MT4, y devuelve la lista de trades normalizados de Tradyum.
 * 
 * @param {string} rawContent - Contenido crudo del archivo HTML/CSV de MT4
 * @param {string} fileName - Nombre del archivo de procedencia (opcional para logs)
 * @returns {Array<Object>} Lista de trades de Tradyum
 */
export function importFromMT4(rawContent, fileName = "") {
  try {
    return parseMT4Report(rawContent, fileName);
  } catch (error) {
    console.error("Error importando de MT4:", error);
    return [];
  }
}
