/**
 * Función central de normalización y limpieza para adaptar inputs de cualquier broker
 * al esquema estándar especificado de Tradyum.
 */

export function normalizeTrade(trade) {
  if (!trade) return null;

  // 1. Limpieza de símbolo
  let symbol = trade.symbol ? String(trade.symbol).toUpperCase().trim() : "DESCONOCIDO";
  
  // 2. Mapeo de Mercado (Futures | Forex | Crypto | Stocks)
  let rawMarket = trade.market ? String(trade.market).trim() : "Futures";
  let market = "Futures";
  const marketLower = rawMarket.toLowerCase();
  
  if (marketLower.includes("forex") || marketLower.includes("fx")) {
    market = "Forex";
  } else if (marketLower.includes("crypto") || marketLower.includes("cripto") || marketLower.includes("coin") || symbol.endsWith("USDT") || symbol.endsWith("BTC")) {
    market = "Crypto";
  } else if (marketLower.includes("stock") || marketLower.includes("accion") || marketLower.includes("equity") || marketLower.includes("cfd") || marketLower.includes("option") || marketLower.includes("opciones")) {
    market = "Stocks"; // can map to Stock on main DB
  } else if (marketLower.includes("future") || marketLower.includes("futures") || marketLower.includes("futuros") || symbol.includes("NQ") || symbol.includes("ES") || symbol.includes("YM") || symbol.includes("CL")) {
    market = "Futures";
  } else {
    // Valor por defecto según símbolo o passthru
    market = rawMarket;
  }

  // 3. Tipo (Long / Short) o (Buy / Sell)
  let rawType = trade.type ? String(trade.type).toLowerCase().trim() : "long";
  let type = "Long";
  if (rawType.includes("short") || rawType.includes("sell") || rawType.includes("venta") || rawType === "s" || rawType === "v") {
    type = "Short";
  }

  // 4. Cuenta
  let account = trade.account ? String(trade.account).trim() : "Cuenta Defecto";

  // 5. Cantidad
  let quantity = parseFloat(trade.quantity);
  if (isNaN(quantity) || quantity <= 0) {
    quantity = 1;
  }

  // 6. PnL en USD (Mapear de P&L)
  let pnl = parseFloat(trade.pnl);
  if (isNaN(pnl)) {
    pnl = 0.0;
  }

  // 7. Resultado (TP | SL | BE | Manual)
  let result = trade.result ? String(trade.result).trim() : null;
  if (!result) {
    if (pnl > 0.05) {
      result = "TP";
    } else if (pnl < -0.05) {
      result = "SL";
    } else {
      result = "BE";
    }
  }

  // 8. Fecha (ISO 8601 string)
  let date = trade.date;
  if (!date) {
    date = new Date().toISOString();
  } else {
    try {
      // Intentar validar / parsear
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        date = d.toISOString();
      } else {
        date = new Date().toISOString();
      }
    } catch (e) {
      date = new Date().toISOString();
    }
  }

  // 9. Notas
  let notes = trade.notes ? String(trade.notes).trim() : "";

  // 10. Broker origen
  let broker = trade.broker ? String(trade.broker).toLowerCase().trim() : "generic";

  return {
    symbol,
    market,
    type,
    account,
    quantity,
    pnl,
    result,
    date,
    notes,
    broker,
    rawData: trade.rawData || trade
  };
}
