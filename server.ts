/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

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
      You are the Elite AI Trading Coach for "TradeZella Journal", an advanced trading journal platform.
      Analyze the provided trading logs, setups, mistakes, and P&L performance for this trader.
      Their current focal goal is: "${goal}".
      
      TRADER METRICS AND JOURNAL SUMMARY:
      ${JSON.stringify(summaryData, null, 2)}
      
      TRADES HISTORY DETAIL:
      ${trades.slice(0, 15).map(t => (
        `- Date: ${t.date} | Symbol: ${t.symbol} | Action: ${t.action} | Asset: ${t.assetType} | P&L: $${t.netPnl.toFixed(2)} | Setups: [${t.setups.join(", ")}] | Mistakes: [${t.mistakes.join(", ")}] | Notes: "${t.notes}"`
      )).join("\n")}
      
      Based on this journal data, generate an in-depth, tactical, and direct Coach Report.
      Be hyper-constructive, professional, and point out concrete data-driven feedback such as setup profit factors, the financial damage of specific mistakes (e.g. FOMO vs. early exits), and emotional discipline adjustments.
    `;

    const coachSchema = {
      type: Type.OBJECT,
      properties: {
        overallScore: {
          type: Type.INTEGER,
          description: "An overall trading discipline and systems score between 0 and 100."
        },
        summary: {
          type: Type.STRING,
          description: "Conversational, direct summary of their trading performance, focusing on the selected focus goal."
        },
        strengths: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "2 to 3 major tactical/discipline strengths displayed in the trade data."
        },
        weaknesses: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "2 to 3 operational errors, mistakes, or system loopholes leaking capital."
        },
        tacticalPlan: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3 highly actionable steps/rules for the trader to adopt immediately next week."
        },
        setupFocus: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              setup: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ["setup", "reason"]
          },
          description: "Detailed suggestions regarding which setups to scale up or completely drop/avoid."
        },
        disciplineAdvice: {
          type: Type.STRING,
          description: "Psychological, mind-set, or emotional focus advice based on noted tags like FOMO, moving stops, or overtrading."
        }
      },
      required: ["overallScore", "summary", "strengths", "weaknesses", "tacticalPlan", "setupFocus", "disciplineAdvice"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: "You are an elite hedge fund risk officer and behavioral finance psychologist. Your reports are highly technical, data-driven, yet empathetic and focused on performance metrics. Avoid generic advice; refer directly to symbols, setups, or mistakes found in the logs.",
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

// Helper: Aggregating statistics dynamically for Gemini prompt
function serializeTradesForModel(trades: any[], goal: string) {
  if (trades.length === 0) return { empty: true };

  let totalNet = 0;
  let wins = 0;
  let losses = 0;
  const setupChart: Record<string, { trades: number; pnl: number }> = {};
  const mistakeChart: Record<string, { count: number; cost: number }> = {};
  
  trades.forEach(t => {
    totalNet += t.netPnl;
    if (t.status === "Win") wins++;
    else if (t.status === "Loss") losses++;

    t.setups.forEach((s: string) => {
      if (!setupChart[s]) setupChart[s] = { trades: 0, pnl: 0 };
      setupChart[s].trades++;
      setupChart[s].pnl += t.netPnl;
    });

    t.mistakes.forEach((m: string) => {
      if (!mistakeChart[m]) mistakeChart[m] = { count: 0, cost: 0 };
      mistakeChart[m].count++;
      mistakeChart[m].cost += t.netPnl < 0 ? Math.abs(t.netPnl) : 0;
    });
  });

  return {
    strategyGoal: goal,
    totalTradesCount: trades.length,
    percentageWinRate: parseFloat(((wins / (trades.length || 1)) * 100).toFixed(1)),
    totalNetProfitOrLoss: totalNet,
    setupBreakdown: Object.entries(setupChart).map(([name, val]) => ({
      setupName: name,
      count: val.trades,
      cumulativePnl: val.pnl
    })),
    mistakeAttributions: Object.entries(mistakeChart).map(([name, val]) => ({
      mistakeTag: name,
      timesTagged: val.count,
      financialDamage: val.cost
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
    netPnl += t.netPnl;
    totalCommissions += t.commissions + t.fees;
    if (t.status === "Win") wins++;
    
    t.setups.forEach((s: string) => {
      setupPnl[s] = (setupPnl[s] || 0) + t.netPnl;
      setupCount[s] = (setupCount[s] || 0) + 1;
    });

    if (t.mistakes.includes("FOMO") || t.mistakes.includes("Chasing Price")) fomoCount++;
    if (t.mistakes.includes("Overtrading") || t.mistakes.includes("Revenge Trade")) overtradingCount++;
  });

  const winRate = parseFloat(((wins / trades.length) * 100).toFixed(1));
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
    summaryText = `Focus assessment suggests that trade selection discipline is your biggest leverage point. Your overall win rate sits at ${winRate}%. Eliminating emotional re-entries will save you substantial drawdowns.`;
  } else {
    summaryText = `Welcome to your dynamic TradeZella dashboard review. With a win rate of ${winRate}% across ${trades.length} trades, your trading systems are displaying a solid foundation. Key performance optimizations should target operational mistakes.`;
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TradeZella Journal server booted successfully on http://0.0.0.0:${PORT}`);
  });
}

startServer();
