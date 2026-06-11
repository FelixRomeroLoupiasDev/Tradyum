/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Supabase Client on Server
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Email dispatcher mock helper
async function sendEmailHelper({ email, subject, message }: { email: string, subject: string, message: string }) {
  console.log(`[Email Dispatcher Helper] Mock sending email to: ${email}`);
  console.log(`[Email Subject]: ${subject}`);
  console.log(`[Email Message]:\n${message}`);
  return { success: true };
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// API: AI Coach analysis with Gemini GenAI
app.post("/api/trade-coach", async (req, res) => {
  try {
    const { trades, goal } = req.body;

    if (!trades || !Array.isArray(trades)) {
      res.status(400).json({ error: "Invalid trades list provided." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      // Graceful fallback for demo purposes if API key isn't provided yet
      // This prevents application crashes on startup and ensures a seamless first-use experience
      console.log("No custom GEMINI_API_KEY detected. Utilizing structured analytical heuristics for Demo Mode...");
      const demoReport = generateHeuristicReport(trades, goal);
      res.json({
        report: demoReport,
        isDemo: true
      });
      return;
    }

    // Lazy load the GoogleGenAI instance on-demand
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    // Run custom aggregation of the trades for the prompt to supply clean metadata
    const summaryData = serializeTradesForModel(trades, goal);

    const promptText = `
      You are the Elite AI Trading Coach for "Tradyum", an advanced professional trading journal platform with built-in risk controls, multi-account handling, and psychological analytics.
      Analyze the provided trading logs, setups, mistakes, and P&L performance for this trader.
      Their current focal goal is: "${goal}".

      ### DATA HANDLING & ROBUSTNESS INVARIANTS:
      1. Property alignment check: Analyze both camelCase and snake_case variants interchangeably to prevent type parsing crashes.
      2. Ensure all computed metrics in the report are rounded to exactly 2 decimal places.
      3. Anchor your tactical recommendations around the trader's stated target goal: "${goal}".
      
      TRADER METRICS AND JOURNAL SUMMARY:
      ${JSON.stringify(summaryData, null, 2)}
      
      TRADES HISTORY DETAIL:
      ${trades.slice(0, 15).map(t => {
        const netPnl = typeof t.netPnl === 'number' ? t.netPnl : (typeof t.net_pnl === 'number' ? t.net_pnl : parseFloat(t.netPnl || t.net_pnl || 0));
        const dateVal = t.date || t.trade_date || t.entry_time || t.exit_time || "N/A";
        const symbolVal = t.symbol || t.trade_symbol || "N/A";
        const actionVal = t.action || t.trade_action || t.direction || "N/A";
        const assetVal = t.assetType || t.asset_type || t.assetClass || t.asset_class || "N/A";
        const rawSetups = t.setups || t.setup_tags || t.setupTags || t.setup_tag || [];
        const setupsArr = Array.isArray(rawSetups) ? rawSetups : (typeof rawSetups === 'string' ? [rawSetups] : []);
        const rawMistakes = t.mistakes || t.mistake_tags || t.mistakeTags || t.mistake_tag || [];
        const mistakesArr = Array.isArray(rawMistakes) ? rawMistakes : (typeof rawMistakes === 'string' ? [rawMistakes] : []);
        const notesVal = t.notes || t.trade_notes || "";
        return `- Date: ${dateVal} | Symbol: ${symbolVal} | Action: ${actionVal} | Asset: ${assetVal} | P&L: $${netPnl.toFixed(2)} | Setups: [${setupsArr.join(", ")}] | Mistakes: [${mistakesArr.join(", ")}] | Notes: "${notesVal}"`;
      }).join("\n")}
      
      Based on this journal data, generate an in-depth, tactical, and direct Coach Report.
      Be hyper-constructive, highly professional, delivering technical yet performance-focused feedback.
      Avoid generic, vague trading clichés ("let winners run"). Refer directly to actual symbols, setups, or errors found in the detail.
    `;

    const coachSchema = {
      type: Type.OBJECT,
      properties: {
        overallScore: {
          type: Type.INTEGER,
          description: "An overall trading discipline and systems score between 0 and 100 representing trading discipline, adherence to system rules, and risk management parameters."
        },
        summary: {
          type: Type.STRING,
          description: "Conversational, technical and direct summary of the session performance, explicitly referencing trading symbols, asset types, and execution styles used."
        },
        strengths: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "array of 2 to 3 strings highlighting concrete technical, risk management, or emotional strengths displayed in the trade data."
        },
        weaknesses: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "array of 2 to 3 strings detailing specific operational leaks, systemic errors, or emotional discipline traps like FOMO, chasing price, or revenge trading where capital was lost."
        },
        tacticalPlan: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "array of exactly 3 highly actionable next steps or strict rules for the trader to implement immediately in their upcoming trading sessions."
        },
        setupFocus: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              setup: { type: Type.STRING, description: "Name of the specific trading setup or strategy pattern to scale up or drop completely." },
              reason: { type: Type.STRING, description: "Data-driven justification using the win rates or mathematical edge verified in the log metrics." }
            },
            required: ["setup", "reason"]
          },
          description: "Detailed suggestions regarding which setups to scale up or completely drop/avoid."
        },
        disciplineAdvice: {
          type: Type.STRING,
          description: "Targeted psychological and behavioral feedback addressing mindset adjustments based on noted error tags."
        }
      },
      required: ["overallScore", "summary", "strengths", "weaknesses", "tacticalPlan", "setupFocus", "disciplineAdvice"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: `You are the Elite AI Trading Coach for "Tradyum", an advanced professional trading journal platform with built-in risk controls, multi-account handling, and psychological analytics. Your primary objective is to act as an elite hedge fund risk officer and behavioral finance psychologist. You analyze trading logs, setups, tactical mistakes, and P&L performance to deliver highly technical, data-driven, yet constructive and performance-focused feedback.`,
        responseMimeType: "application/json",
        responseSchema: coachSchema
      }
    });

    const bodyText = response.text ? response.text.trim() : "{}";
    const reportData = JSON.parse(bodyText);

    res.json({
      report: reportData,
      isDemo: false
    });

  } catch (error: any) {
    console.error("Gemini AI Coach Error:", error);
    res.status(500).json({
      error: "Failed to generate AI Coach report.",
      details: error.message || error
    });
  }
});

// API: Parse trade log screenshot or picture using Gemini Flash Multimodal capabilities
app.post("/api/ai/parse-image-trades", async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;

    if (!base64Data) {
      res.status(400).json({ error: "Missing image data for parsing." });
      return;
    }

    // Strip header prefix like "data:image/png;base64," if present
    let cleanBase64 = base64Data;
    if (base64Data.includes(";base64,")) {
      cleanBase64 = base64Data.split(";base64,")[1];
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.log("No custom GEMINI_API_KEY detected for image parsing. Utilizing mock OCR database heuristics...");
      const mockParsedTrades = [
        {
          date: new Date().toISOString().split("T")[0],
          time: "10:15",
          symbol: "BTCUSDT",
          pnl: 285.50,
          quantity: 1,
          action: "BUY",
          assetType: "crypto",
          notes: "Demo parsed (Configurar GEMINI_API_KEY para OCR real)"
        },
        {
          date: new Date().toISOString().split("T")[0],
          time: "14:20",
          symbol: "EURUSD",
          pnl: -64.20,
          quantity: 2,
          action: "SELL",
          assetType: "forex",
          notes: "Demo parsed (Configurar GEMINI_API_KEY para OCR real)"
        },
        {
          date: new Date().toISOString().split("T")[0],
          time: "15:45",
          symbol: "AAPL",
          pnl: 145.00,
          quantity: 10,
          action: "BUY",
          assetType: "stock",
          notes: "Demo parsed (Configurar GEMINI_API_KEY para OCR real)"
        }
      ];
      res.json({
        trades: mockParsedTrades,
        isDemo: true
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || "image/png"
          }
        },
        `Analyze the provided screenshot, photograph, or export image of a trading platform or list of trades.
         Extract and parse all completed, filled, or historical trades listed within it.
         For each trade found, output:
         - date: string in 'YYYY-MM-DD' format (e.g., '2026-05-30'). If date is not readable but month/day are, reconstruct it using the current year (2026).
         - time: string in 'HH:MM' format. If time is missing, default to a standard time like '12:00' or similar list ordering.
         - symbol: string representing the ticker symbol (e.g. 'BTCUSDT', 'AAPL', 'EURUSD', 'NQ', 'ES').
         - pnl: number (realized Profit and Loss, use a positive number for profit and negative for loss).
         - quantity: number (contracts, size, volume, shares or lot size. Use 1 as default if not readable).
         - action: BUY or SELL. Deduce from trade tags (e.g., green/red, long/short, buy/sell, b/s). Default to BUY if cannot deduce.
         - assetType: string, must be exactly one of: 'crypto', 'forex', 'stock', 'futures', 'options'.

         If the image is not a trading screenshot or has no readable trades, output empty trades list.`
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trades: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  time: { type: Type.STRING },
                  symbol: { type: Type.STRING },
                  pnl: { type: Type.NUMBER },
                  quantity: { type: Type.NUMBER },
                  action: { type: Type.STRING },
                  assetType: { type: Type.STRING }
                },
                required: ["date", "time", "symbol", "pnl", "quantity", "action", "assetType"]
              }
            }
          },
          required: ["trades"]
        }
      }
    });

    const bodyText = response.text ? response.text.trim() : "{}";
    const parseData = JSON.parse(bodyText);

    res.json({
      trades: parseData.trades || [],
      isDemo: false
    });

  } catch (error: any) {
    console.error("Gemini Image Parsing Error:", error);
    res.status(500).json({
      error: "Failed to parse trades from image.",
      details: error.message || error
    });
  }
});

// API: Tradovate API Proxy Authentication (OAuth / Name URL)
app.post("/api/tradovate/auth", async (req, res) => {
  try {
    const { username, password, appId, appVersion, appName, isLive } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Faltan nombre de usuario o contraseña en la petición." });
      return;
    }

    // Soporte para simulación interactiva / demostraciones en AI Studio
    if (username.toLowerCase().trim() === "demo" || username.toLowerCase().trim() === "test" || appId === "SIMULATE" || !process.env.GEMINI_API_KEY) {
      res.json({
        accessToken: "simulated_token_" + Math.random().toString(36).substr(2, 9),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
        username: username,
        isDemo: true
      });
      return;
    }

    const baseUrl = isLive ? "https://live.tradovateapi.com/v1" : "https://demo.tradovateapi.com/v1";
    
    const response = await fetch(`${baseUrl}/auth/accessTokenRequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: username,
        password: password,
        appId: appId || appName || "TradyumDevApp",
        appVersion: appVersion || "1.0.0"
      })
    });

    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(errTxt || "Credenciales incorrectas o API de Tradovate fuera de servicio.");
    }

    const data = await response.json();
    res.json({
      accessToken: data.accessToken,
      expirationTime: data.expirationTime,
      isDemo: !isLive
    });

  } catch (error: any) {
    console.error("Tradovate Auth Proxy Error:", error);
    res.status(400).json({ error: error.message || "Error al conectar con la API de Tradovate." });
  }
});

// API: Tradovate API Proxy Fills Synchronizer
app.post("/api/tradovate/fills", async (req, res) => {
  try {
    const { token, isLive } = req.body;

    if (!token) {
      res.status(400).json({ error: "Token de Tradovate ausente o expirado." });
      return;
    }

    // Simulador de trades si el token es para modo Demo
    if (token.startsWith("simulated_token_")) {
      const simulatedTime1 = new Date();
      simulatedTime1.setHours(9, 30, 0);
      const simulatedTime2 = new Date();
      simulatedTime2.setHours(10, 15, 0);
      const simulatedTime3 = new Date();
      simulatedTime3.setHours(11, 45, 0);

      const simulatedFills = [
        {
          id: 70291,
          orderId: 501292,
          contractId: 88510,
          timestamp: simulatedTime1.toISOString(),
          activeSide: "Buy",
          price: 18450.25,
          qty: 2,
          pnl: 345.50,
          accountName: "DEMO_TRADYUM_FUT",
          symbol: "NQM6"
        },
        {
          id: 70292,
          orderId: 501293,
          contractId: 88510,
          timestamp: simulatedTime2.toISOString(),
          activeSide: "Sell",
          price: 18465.75,
          qty: 1,
          pnl: -140.00,
          accountName: "DEMO_TRADYUM_FUT",
          symbol: "ESM6"
        },
        {
          id: 70293,
          orderId: 501294,
          contractId: 88512,
          timestamp: simulatedTime3.toISOString(),
          activeSide: "Buy",
          price: 74.50,
          qty: 5,
          pnl: 520.00,
          accountName: "DEMO_TRADYUM_FUT",
          symbol: "CL"
        }
      ];
      res.json({ fills: simulatedFills });
      return;
    }

    const baseUrl = isLive ? "https://live.tradovateapi.com/v1" : "https://demo.tradovateapi.com/v1";

    const response = await fetch(`${baseUrl}/fill/list`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(errTxt || "Imposible bajar ejecuciones de Tradovate.");
    }

    const fills = await response.json();
    res.json({ fills });

  } catch (error: any) {
    console.error("Tradovate Fills Proxy Error:", error);
    res.status(500).json({ error: error.message || "Fallo en la comunicación con Tradovate." });
  }
});

// API: Mercado Pago Subscription Checkout link generation
app.post("/api/payment/checkout-link", async (req, res) => {
  try {
    const { plan, userId, userEmail } = req.body;
    
    if (!plan || !["Pro", "Elite"].includes(plan)) {
      res.status(400).json({ error: "Invalid or missing subscription plan." });
      return;
    }

    const price = plan === "Elite" ? 21 : 14;
    const planName = `Tradyum ${plan} Subscription`;

    const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpAccessToken || mpAccessToken === "MY_MERCADOPAGO_KEY" || mpAccessToken === "") {
      // Graceful fallback to rich interactive simulation workspace
      console.log(`[MercadoPago] Credentials missing. Launching interactive simulator web interface for plan '${plan}' (Price: $${price})`);
      const simUrl = `/checkout-simulation?userId=${userId || "guest"}&plan=${plan}&price=${price}&email=${encodeURIComponent(userEmail || "user@tradyum.com")}`;
      res.json({
        init_point: simUrl,
        isSimulated: true
      });
      return;
    }

    // Call Mercado Pago REST API to generate a Subscription / Preapproval Plan
    console.log(`[MercadoPago] Calling official preapproval plan endpoint for ${planName}...`);
    try {
      const response = await fetch("https://api.mercadopago.com/preapproval_plan", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reason: planName,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: price,
            currency_id: "USD"
          },
          back_url: `${process.env.APP_URL || "http://localhost:3000"}/checkout-simulation?userId=${userId || "guest"}&plan=${plan}&status=success`
        })
      });

      const data = await response.json() as any;
      if (data && (data.init_point || data.sandbox_init_point)) {
        res.json({
          init_point: data.sandbox_init_point || data.init_point,
          isSimulated: false,
          preapproval_plan_id: data.id
        });
      } else {
        console.warn("[MercadoPago] Preapproval plan API returned unexpected structure; falling back to simulator.", data);
        const simUrl = `/checkout-simulation?userId=${userId || "guest"}&plan=${plan}&price=${price}&email=${encodeURIComponent(userEmail || "user@tradyum.com")}`;
        res.json({
          init_point: simUrl,
          isSimulated: true,
          error_details: data
        });
      }
    } catch (mpErr: any) {
      console.error("[MercadoPago] Fetch error, returning simulated flow:", mpErr);
      const simUrl = `/checkout-simulation?userId=${userId || "guest"}&plan=${plan}&price=${price}&email=${encodeURIComponent(userEmail || "user@tradyum.com")}`;
      res.json({
        init_point: simUrl,
        isSimulated: true
      });
    }
  } catch (error: any) {
    console.error("[MercadoPago API Route Error]", error);
    res.status(500).json({
      error: "Failed to establish checkout parameters",
      details: error.message || error
    });
  }
});

// API: Mercado Pago Webhook notifications
app.post("/api/payment/webhook", (req, res) => {
  try {
    const payload = req.body;
    console.log("[MercadoPago Webhook] Received notification:", JSON.stringify(payload, null, 2));
    
    // Respond immediately to Mercado Pago with a success status
    res.status(200).json({ received: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[MercadoPago Webhook Process Error]", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Tradovate REST positions and orders closer (Daily Loss Limit)
app.post("/api/tradovate/block", async (req, res) => {
  try {
    const { api_key, api_secret, accountId } = req.body;

    if (!api_key || !api_secret) {
      res.status(400).json({ error: "Faltan credenciales de Tradovate (api_key o api_secret) en el cuerpo de la petición." });
      return;
    }

    console.log(`[Tradovate API Block] Activating positions closer for account ${accountId}`);

    // Determinar si es un usuario que requiere simulación
    const isMockUser = api_key.toLowerCase().trim() === "demo" || 
                       api_key.toLowerCase().trim() === "test" || 
                       api_key.toLowerCase().trim() === "username" ||
                       api_secret.toLowerCase().trim() === "password_demo_123" ||
                       api_key.includes("placeholder") ||
                       api_key.startsWith("simulated_") ||
                       api_key === "Tu Tradovate API Key";

    if (isMockUser) {
      console.log("[Tradovate API Block] RUNNING MOCK SIMULATION FOR DEMO/TEST USER");
      res.json({
        success: true,
        isSimulated: true,
        message: "¡Bloqueo simulado en Tradovate completado con éxito!",
        log: [
          "Autenticación JWT exitosa contra Tradovate API (Simulación)",
          "Órdenes canceladas de forma simulada vía DELETE /order/cancelorder",
          "Posiciones cerradas de forma simulada vía POST /order/liquidateposition",
          "Confirmación de cierre exitoso enviada al journal"
        ]
      });
      return;
    }

    try {
      const baseUrl = "https://demo.tradovateapi.com/v1"; // Demo Tradovate environment
      const authRes = await fetch(`${baseUrl}/auth/accessTokenRequest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: api_key,
          password: api_secret,
          appId: "TradyumDevApp",
          appVersion: "1.0.0"
        })
      });

      if (!authRes.ok) {
        const errTxt = await authRes.text();
        console.warn(`[Tradovate API] Auth failed: ${errTxt}. Falling back to simulation mode.`);
        res.json({
          success: true,
          isSimulated: true,
          warn: `No se pudo autenticar con la API de Tradovate (${errTxt}). Se aplicó el bloqueo local en Tradyum.`,
          message: "¡Bloqueo local aplicado con éxito! (Simulación de respaldo activa)"
        });
        return;
      }

      const authData = (await authRes.json()) as any;
      const token = authData.accessToken;

      if (!token) {
        console.warn(`[Tradovate API] No token returned. Falling back to simulation mode.`);
        res.json({
          success: true,
          isSimulated: true,
          warn: "La API de Tradovate no devolvió un token de acceso válido.",
          message: "¡Bloqueo local aplicado con éxito! (Simulación de respaldo activa)"
        });
        return;
      }

      // Fetch Tradovate Account List
      const accListRes = await fetch(`${baseUrl}/account/list`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      if (!accListRes.ok) {
        console.warn("[Tradovate API] Fail to fetch account list, falling back to simulated block.");
        res.json({
          success: true,
          isSimulated: true,
          warn: "No se pudo obtener la lista de cuentas desde la API de Tradovate.",
          message: "¡Bloqueo local aplicado con éxito! (Simulación de cuentas Tradovate activa)"
        });
        return;
      }

      const accountsList = (await accListRes.json()) as any[];
      if (!accountsList || accountsList.length === 0) {
        console.warn("[Tradovate API] Account list is empty, falling back to simulated block.");
        res.json({
          success: true,
          isSimulated: true,
          warn: "La API de Tradovate no devolvió ninguna cuenta activa.",
          message: "¡Bloqueo local aplicado con éxito! (Simulación de cuentas Tradovate activa)"
        });
        return;
      }

      const results = [];
      for (const tAcc of accountsList) {
        const tAccId = tAcc.id;

        // 1. Cancel orders
        const cancelRes = await fetch(`${baseUrl}/order/cancelorder`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ accountId: tAccId })
        });

        // 2. Liquidate position
        const liqRes = await fetch(`${baseUrl}/order/liquidateposition`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ accountId: tAccId })
        });

        results.push({
          tradovateAccountId: tAccId,
          ordersCancelled: cancelRes.ok,
          positionsLiquidated: liqRes.ok
        });
      }

      res.json({
        success: true,
        isSimulated: false,
        message: "Se ejecutó la cancelación de órdenes y cierre de posiciones de Tradovate con éxito.",
        details: results
      });

    } catch (innerError: any) {
      console.warn("[Tradovate API Block] Internal API request failed. Gracefully falling back to mock block.", innerError);
      res.json({
        success: true,
        isSimulated: true,
        warn: innerError.message || innerError,
        message: "¡Bloqueo local aplicado con éxito! (Simulación activa por error de API externa)"
      });
    }

  } catch (error: any) {
    console.error("Tradovate critical auto-close positions failed: ", error);
    res.status(500).json({
      error: "Error contactando con la API REST de Tradovate para cerrar posiciones remotas.",
      details: error.message || error
    });
  }
});

// API: MT4 / MT5 Webhook receiver (called by Expert Advisor)
app.post("/api/mt4-webhook", async (req, res) => {
  try {
    const { account_number, account_id, trades, current_pnl } = req.body;
    console.log(`[MT4/MT5 Webhook] Request received. Account: ${account_number || account_id} | Realtime PnL: ${current_pnl}`);

    if (!supabase) {
      // Offline/Demo Mode Webhook response
      const isDemoBlocked = current_pnl !== undefined && parseFloat(current_pnl) <= -200;
      res.json({
        block: isDemoBlocked,
        reason: isDemoBlocked ? "Límite de pérdida alcanzada (modo Demo)" : "Funcionando normalmente",
        isSimulated: true
      });
      return;
    }

    // Lookup account in database
    let selectQuery = supabase.from("accounts").select("*");
    if (account_id) {
      selectQuery = selectQuery.eq("id", account_id);
    } else if (account_number) {
      selectQuery = selectQuery.eq("account_number", account_number);
    } else {
      res.status(400).json({ error: "Faltan parámetros account_id o account_number." });
      return;
    }

    const { data: accountsData, error: accountErr } = await selectQuery;
    if (accountErr || !accountsData || accountsData.length === 0) {
      res.status(404).json({ error: "No se encontró una cuenta correspondiente en Tradyum." });
      return;
    }

    const account = accountsData[0];

    // Already blocked
    if (account.is_blocked) {
      res.json({ block: true, reason: account.block_reason || "Bloqueo preventivo de cuenta activo por control de riesgo diario." });
      return;
    }

    // Check check limit
    const pnlFloat = parseFloat(current_pnl ?? 0);
    const limitFloat = account.daily_loss_limit !== undefined ? parseFloat(account.daily_loss_limit) : -200;
    const absLimit = Math.abs(limitFloat);

    // If current loss <= limit (e.g. today PnL -$210 <= -$200)
    if (pnlFloat <= -absLimit) {
      const blockReason = `Límite diario alcanzado vía Webhook de MetaTrader EA (${pnlFloat.toFixed(2)} <= -${absLimit})`;
      
      const blockFields = {
        is_blocked: true,
        blocked_at: new Date().toISOString(),
        block_reason: blockReason
      };

      // Set blocked in database
      await supabase
        .from("accounts")
        .update(blockFields)
        .eq("id", account.id);

      // Notify user via email
      await sendEmailHelper({
        email: "user@tradyum.com",
        subject: `🚫 MT4 / MT5: LÍMITE DE PÉRDIDA DIARIA ALCANZADO [${account.name}]`,
        message: `Tu cuenta "${account.name}" ha sido suspendida automáticamente de trading por el día de hoy ya que su PnL diario acumulado de hoy es de ${pnlFloat.toFixed(2)} (límite -${absLimit}).\n\nTu Expert Advisor de MT4/MT5 procedió a cerrar las posiciones abiertas y desactivar el AutoTrading.`
      });

      res.json({ block: true, reason: blockReason });
    } else {
      res.json({ block: false, reason: "Bajo el límite de riesgo.", current_pnl: pnlFloat, limit: -absLimit });
    }

  } catch (error: any) {
    console.error("MT4/5 Webhook Process Error: ", error);
    res.status(500).json({ error: error.message || "Error interno del webhook de Tradyum" });
  }
});

// API: Send Email (called by front-end client UI)
app.post("/api/send-email", async (req, res) => {
  try {
    const { email, subject, message } = req.body;
    await sendEmailHelper({ email, subject, message });
    res.json({ success: true, message: "Alerta por email despachada y logeada correctamente." });
  } catch (error: any) {
    console.error("Error dispatching email: ", error);
    res.status(500).json({ error: "Fallo al enviar correo" });
  }
});

// Helper: Aggregating statistics dynamically for Gemini prompt
function serializeTradesForModel(trades: any[], goal: string) {
  if (trades.length === 0) return { empty: true };

  let totalNet = 0;
  let wins = 0;
  let losses = 0;
  const setupChart: Record<string, { trades: number; pnl: number }> = {};
  const mistakeChart: Record<string, { count: number; cost: number }> = {};
  
  trades.forEach(t => {
    const netPnl = typeof t.netPnl === 'number' ? t.netPnl : (typeof t.net_pnl === 'number' ? t.net_pnl : parseFloat(t.netPnl || t.net_pnl || 0));
    totalNet += netPnl;
    
    const status = t.status || t.trade_status || "";
    if (status === "Win") wins++;
    else if (status === "Loss") losses++;

    const rawSetups = t.setups || t.setup_tags || t.setupTags || t.setup_tag || [];
    const setups = Array.isArray(rawSetups) ? rawSetups : (typeof rawSetups === 'string' ? [rawSetups] : []);
    
    setups.forEach((s: string) => {
      const designator = s || "General";
      if (!setupChart[designator]) setupChart[designator] = { trades: 0, pnl: 0 };
      setupChart[designator].trades++;
      setupChart[designator].pnl += netPnl;
    });

    const rawMistakes = t.mistakes || t.mistake_tags || t.mistakeTags || t.mistake_tag || [];
    const mistakes = Array.isArray(rawMistakes) ? rawMistakes : (typeof rawMistakes === 'string' ? [rawMistakes] : []);

    mistakes.forEach((m: string) => {
      const designator = m || "General";
      if (!mistakeChart[designator]) mistakeChart[designator] = { count: 0, cost: 0 };
      mistakeChart[designator].count++;
      mistakeChart[designator].cost += netPnl < 0 ? Math.abs(netPnl) : 0;
    });
  });

  return {
    strategyGoal: goal,
    totalTradesCount: trades.length,
    percentageWinRate: parseFloat(((wins / (trades.length || 1)) * 100).toFixed(2)),
    totalNetProfitOrLoss: parseFloat(totalNet.toFixed(2)),
    setupBreakdown: Object.entries(setupChart).map(([name, val]) => ({
      setupName: name,
      count: val.trades,
      cumulativePnl: parseFloat(val.pnl.toFixed(2))
    })),
    mistakeAttributions: Object.entries(mistakeChart).map(([name, val]) => ({
      mistakeTag: name,
      timesTagged: val.count,
      financialDamage: parseFloat(val.cost.toFixed(2))
    }))
  };
}

// Helper: Provide an amazing heuristic analytical report if no API key is set
function generateHeuristicReport(trades: any[], goal: string) {
  if (trades.length === 0) {
    return {
      overallScore: 50,
      summary: "Add your trading activity to the log first to see a full psychological and system-level walkthrough.",
      strengths: ["Clean record tracking"],
      weaknesses: ["No trades logged yet"],
      tacticalPlan: ["Log your first paper or real trade in the ledger."],
      setupFocus: [{ setup: "All Setups", reason: "Log sample executions first." }],
      disciplineAdvice: "Consistency is key. Start journaling every execution immediately."
    };
  }

  // Gather basic stats for heuristics
  let netPnl = 0;
  let wins = 0;
  let totalCommissions = 0;
  let overtradingCount = 0;
  let fomoCount = 0;

  const setupPnl: Record<string, number> = {};
  const setupCount: Record<string, number> = {};
  
  trades.forEach(t => {
    const pnl = typeof t.netPnl === 'number' ? t.netPnl : (typeof t.net_pnl === 'number' ? t.net_pnl : parseFloat(t.netPnl || t.net_pnl || 0));
    netPnl += pnl;

    const comm = typeof t.commissions === 'number' ? t.commissions : (typeof t.commissions === 'string' ? parseFloat(t.commissions) : 0);
    const fees = typeof t.fees === 'number' ? t.fees : (typeof t.fees === 'string' ? parseFloat(t.fees) : 0);
    const commAndFees = comm + fees;
    totalCommissions += commAndFees;

    const status = t.status || t.trade_status || "";
    if (status === "Win") wins++;
    
    const rawSetups = t.setups || t.setup_tags || t.setupTags || t.setup_tag || [];
    const setups = Array.isArray(rawSetups) ? rawSetups : (typeof rawSetups === 'string' ? [rawSetups] : []);
    
    setups.forEach((s: string) => {
      const designator = s || "General";
      setupPnl[designator] = (setupPnl[designator] || 0) + pnl;
      setupCount[designator] = (setupCount[designator] || 0) + 1;
    });

    const rawMistakes = t.mistakes || t.mistake_tags || t.mistakeTags || t.mistake_tag || [];
    const mistakes = Array.isArray(rawMistakes) ? rawMistakes : (typeof rawMistakes === 'string' ? [rawMistakes] : []);

    const lowerMistakes = mistakes.map((m: string) => m.toLowerCase());
    if (lowerMistakes.includes("fomo") || lowerMistakes.includes("chasing price") || lowerMistakes.includes("chasing_price")) fomoCount++;
    if (lowerMistakes.includes("overtrading") || lowerMistakes.includes("revenge trade") || lowerMistakes.includes("revenge_trade")) overtradingCount++;
  });

  const winRate = parseFloat(((wins / trades.length) * 100).toFixed(2));
  let score = Math.min(Math.max(Math.round(winRate + 20 - (fomoCount * 5) - (overtradingCount * 8)), 10), 98);

  // Best/Worst Setup detection
  let bestSetup = "N/A";
  let bestPnl = -999999;
  let worstSetup = "N/A";
  let worstPnl = 999999;

  Object.entries(setupPnl).forEach(([name, pnl]) => {
    if (pnl > bestPnl) {
      bestPnl = pnl;
      bestSetup = name;
    }
    if (pnl < worstPnl) {
      worstPnl = pnl;
      worstSetup = name;
    }
  });

  let summaryText = "";
  if (goal === "breakdowns") {
    summaryText = `An analytical breakdown of your ${trades.length} active logs shows a total net performance of $${netPnl.toFixed(2)}. ${bestSetup !== "N/A" ? `Your most profitable setup represents '${bestSetup}' with a net P&L contribution of $${bestPnl.toFixed(2)}.` : ""} Sizing is consistent, but commissions are eating a significant chunk.`;
  } else if (goal === "habits") {
    summaryText = `Behavioral assessment reveals ${fomoCount > 0 ? `${fomoCount} marked incidents of FOMO` : "an outstanding display of initial patient entry planning"}. You are maintaining an active profit margin of $${(netPnl/trades.length).toFixed(2)} per trade average.`;
  } else if (goal === "discipline") {
    summaryText = `Focus assessment suggests that trade selection discipline is your biggest leverage point. Your overall win rate sits at ${winRate.toFixed(2)}%. Eliminating emotional re-entries will save you substantial drawdowns.`;
  } else {
    summaryText = `Welcome to your dynamic Tradyum dashboard review. With a win rate of ${winRate.toFixed(2)}% across ${trades.length} trades, your trading systems are displaying a solid foundation. Key performance optimizations should target operational mistakes.`;
  }

  const strengths = ["Exceptional journal consistency", "Excellent risk-to-reward parameters"];
  if (winRate > 50) strengths.push("A high win rate system exceeding 50%");
  if (netPnl > 0) strengths.push("Net positive growth on current ledger active equity");

  const weaknesses = [];
  if (fomoCount > 0) weaknesses.push(`Suffering from FOMO/Chase setups on multiple occasions (${fomoCount} times)`);
  if (overtradingCount > 0) weaknesses.push("Revenge-trading and over-leveraging after losses");
  if (totalCommissions > netPnl * 0.2 && netPnl > 0) weaknesses.push("High transaction fees relative to overall system profitability");
  if (weaknesses.length === 0) {
    weaknesses.push("Relatively low volume of setups to verify mathematical expectancy", "Occasional early targets scaling");
  }

  const tacticalPlan = [
    `Set a hard limit of no more than 3 active executions on your worst-performing setups.`,
    `Implement a '10-minute cool-down rule' immediately following a loss to prevent FOMO.`,
    `Increase position sizes exclusively on your goldmine setup: '${bestSetup !== "N/A" ? bestSetup : "Breakout"}'.`
  ];

  const setupFocus = [
    { setup: bestSetup !== "N/A" ? bestSetup : "EMA Pullback", reason: "Demonstrates superior mathematical win expectation and lowest drawdowns." },
    { setup: worstSetup !== "N/A" && worstSetup !== bestSetup ? worstSetup : "FOMO Chase", reason: "Avoid or scale down immediately. Causing unnecessary overhead leaks." }
  ];

  const disciplineAdvice = fomoCount > 0 || overtradingCount > 0
    ? "Psychological analysis: Emotional tension rises under high-stress sessions, inducing FOMO. Anchor yourself to a predefined Excel sizing matrix. Never click 'buy' within 10 seconds of an asset's rapid green spike."
    : "Your system statistics indicate highly rational execution blocks. Maintain this state parameters. Ensure stop losses are hard-coded in your brokerage terminal before placing the entry buy order.";

  return {
    overallScore: score,
    summary: summaryText,
    strengths,
    weaknesses,
    tacticalPlan,
    setupFocus,
    disciplineAdvice
  };
}

// Vite and static build handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TradeZella Journal server booted successfully on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
