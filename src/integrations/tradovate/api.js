/**
 * Tradovate API Service
 * 
 * Método: Conexión API REST de Tradovate utilizando autenticación OAuth (AppName/AppVersion/AppID).
 * Docs: https://api.tradovate.com
 * 
 * Soluciona CORS y manejo seguro de API Keys usando un proxy express en el servidor de Tradyum (/api/tradovate/).
 */

/**
 * Autentica con Tradovate utilizando credenciales y parámetros de app.
 * Llama al proxy backend local de Tradyum que es seguro y no posee bloqueos de CORS.
 * 
 * @param {Object} credentials - Objeto con username, password, appId, appVersion, appName, isLive
 * @returns {Promise<Object>} Respuesta con token de acceso y detalles de expiración
 */
export async function authenticateTradovate({ username, password, appId, appVersion, appName, isLive }) {
  try {
    const response = await fetch("/api/tradovate/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password,
        appId,
        appVersion,
        appName,
        isLive: !!isLive
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Fallo en la autenticación con Tradovate.");
    }

    return await response.json(); // Retorna { accessToken, expirationTime, user, status }
  } catch (error) {
    console.error("Error en authenticateTradovate api client:", error);
    throw error;
  }
}

/**
 * Obtiene el listado de órdenes / ejecuciones completas (fills) cargadas en Tradovate.
 * 
 * @param {string} token - Token de acceso de Tradovate
 * @param {boolean} isLive - Indica si es entorno real o demo
 * @returns {Promise<Array<Object>>} Lista de ejecuciones (fills/orders) crudas
 */
export async function fetchFilledTrades(token, isLive) {
  try {
    const response = await fetch("/api/tradovate/fills", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        isLive: !!isLive
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Fallo al consultar órdenes de Tradovate.");
    }

    const data = await response.json();
    return data.fills || []; // Devuelve array de order fills
  } catch (error) {
    console.error("Error en fetchFilledTrades api client:", error);
    throw error;
  }
}
