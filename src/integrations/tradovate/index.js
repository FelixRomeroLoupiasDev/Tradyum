import { authenticateTradovate, fetchFilledTrades } from "./api.js";
import { parseTradovateFills } from "./parser.js";

/**
 * Función central de importación automática de Tradovate.
 * Se encarga de hacer la llamada de login, negociar el accessToken API, descargar
 * el listado de trades resueltos y pasarlo por el parser normalizador de Tradyum.
 * 
 * @param {Object} credentials - Credenciales de Tradovate { username, password, appId, appVersion, appName, isLive }
 * @returns {Promise<Array<Object>>} Lista de trades normalizados
 */
export async function importFromTradovate(credentials) {
  try {
    // 1. Loggear y obtener token mediante el proxy backend seguro
    const authResult = await authenticateTradovate(credentials);
    
    if (!authResult || !authResult.accessToken) {
      throw new Error("No se recibió un token de acceso válido de Tradovate.");
    }

    // 2. Traer la lista de ejecuciones (fills/orders)
    const rawFills = await fetchFilledTrades(authResult.accessToken, credentials.isLive);

    // 3. Parsear y normalizar los items
    return parseTradovateFills(rawFills);
  } catch (error) {
    console.error("Fallo de importación automática Tradovate:", error);
    throw error;
  }
}
