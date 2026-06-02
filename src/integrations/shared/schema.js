/**
 * Schema oficial estándar para trades normalizados en Tradyum.
 * Todos los brokers deben exportar e importar datos respetando esta forma.
 */

export const TradyumTradeSchema = {
  symbol:    "String",   // Ticker de operación (ej: NQ, ES, AAPL, BTCUSDT)
  market:    "String",   // "Futures" | "Forex" | "Crypto" | "Stocks" (AssetType)
  type:      "String",   // "Long" | "Short" (TradeAction)
  account:   "String",   // Cuenta del broker asociada
  quantity:  "Number",   // Contratos, lotes o unidades
  pnl:       "Number",   // P&L neto o bruto en USD
  result:    "String",   // "TP" | "SL" | "BE" | "Manual"
  date:      "String",   // Formato ISO 8601: "YYYY-MM-DDTHH:MM:SSZ" o similar
  notes:     "String",   // Notas o comentarios (opcional)
  broker:    "String",   // "ninjatrader" | "tradovate" | "mt4" | "mt5" | "tradingview"
  rawData:   "Object"    // Datos crudos del broker original para fines de depuración
};
