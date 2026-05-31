/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Trade, AICoachReport, CoachGoal } from "../types";
import { Sparkles, Brain, CheckCircle, Flame, ShieldAlert, Award, Compass, RefreshCw, Star, Lock } from "lucide-react";

interface TradeCoachProps {
  trades: Trade[];
  userPlan?: string;
  onUpgradeClick?: () => void;
}

const TRADING_QUOTES = [
  { quote: "The goal of a successful trader is to make the best trades. Money is secondary.", author: "Alexander Elder" },
  { quote: "In trading, you have to be comfortable with being uncomfortable.", author: "Mark Douglas" },
  { quote: "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.", author: "George Soros" },
  { quote: "Do not anticipate and move without market confirmation. Being a little late in your trade is your insurance.", author: "Jesse Livermore" },
  { quote: "The market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" }
];

export default function TradeCoach({ trades, userPlan = "Free", onUpgradeClick }: TradeCoachProps) {
  const [goal, setGoal] = useState<CoachGoal>("general");
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<AICoachReport | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [checkedPlanIndices, setCheckedPlanIndices] = useState<Record<number, boolean>>({});
  const [quoteIdx, setQuoteIdx] = useState(0);

  // Trigger Gemini API Analysis
  const runAICoachAnalysis = async () => {
    setIsLoading(true);
    // Cycle a beautiful quote for loading focus
    setQuoteIdx(Math.floor(Math.random() * TRADING_QUOTES.length));

    try {
      const response = await fetch("/api/trade-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades, goal })
      });

      if (!response.ok) {
        throw new Error("Coaching core server service failed to respond.");
      }

      const result = await response.json();
      if (result.report) {
        setReport(result.report);
        setIsDemo(!!result.isDemo);
        setCheckedPlanIndices({}); // reset checklists
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 60) return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  const currentQuote = TRADING_QUOTES[quoteIdx];

  return (
    <div className="bg-[#1e152d]/80 rounded-xl border border-[#2d2045] p-5 mt-6 backdrop-blur-md relative overflow-hidden" id="ai-coach-section">
      {/* If Free plan, render a beautiful lock system with dynamic gradient and overlay details */}
      {userPlan === "Free" && (
        <div className="absolute inset-0 z-30 bg-[#120e20]/95 backdrop-blur-[4px] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-4 border border-white/10 animate-bounce">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest mb-3 border border-indigo-500/20">
            ★ EXCLUSIVO DE REGISTRO PRO & ELITE
          </span>
          <h3 className="text-xl font-bold font-display tracking-tight text-white mb-2 max-w-md">
            Desbloquea el Elite AI Trading Coach
          </h3>
          <p className="text-xs text-[#8e84a3] leading-relaxed max-w-md mb-6">
            Audita tus operaciones utilizando **Gemini 3.5 Flash** para identificar fugas de capital por indisciplina, errores de psicología (como FOMO o revancha) y obtener planes tácticos personalizados.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center">
            <button
              onClick={onUpgradeClick}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 hover:from-blue-700 hover:to-indigo-700 hover:to-pink-700 text-white font-bold text-xs rounded-xl transition-all shadow-xl shadow-indigo-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              Ver Planes y Activar Coach
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/25 animate-pulse">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display tracking-tight text-white flex items-center gap-2">
              Gemini Trade Coach
              <span className="text-[10px] bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold font-sans px-2 py-0.5 rounded-full uppercase tracking-wider">
                Elite Risk AI
              </span>
            </h2>
            <p className="text-xs text-slate-400">Behavioral insights & trading system optimization from virtual risk officer</p>
          </div>
        </div>

        {/* Action Strategy Toggles */}
        <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {(["general", "breakdowns", "habits", "discipline"] as CoachGoal[]).map((strategy) => (
            <button
              key={strategy}
              onClick={() => setGoal(strategy)}
              className={`px-2.5 py-1 text-[10px] rounded-md font-mono transition-all uppercase tracking-wider cursor-pointer ${
                goal === strategy
                  ? "bg-blue-600 text-white font-bold shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {strategy}
            </button>
          ))}
        </div>
      </div>

      {!report && !isLoading ? (
        <div className="py-8 text-center flex flex-col items-center justify-center max-w-xl mx-auto" id="coach-welcome-state">
          <Sparkles className="w-8 h-8 text-blue-400 mb-3" />
          <h4 className="text-sm font-bold text-slate-200">System Ready for Performance Review</h4>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            The coach scans your logged ledger metrics, custom setup tags, and noted mistakes to compute professional hedge-fund feedback based on target parameters and discipline.
          </p>
          <button
            onClick={runAICoachAnalysis}
            disabled={trades.length === 0}
            className={`mt-4 w-full md:w-auto px-5 py-2 rounded-lg font-display font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              trades.length === 0
                ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
            }`}
          >
            <Sparkles className="w-4 h-4" /> Run AI Performance Audit
          </button>
          {trades.length === 0 && (
            <span className="text-[10px] text-amber-500/80 mt-2">Log at least one trade in the ledger to begin analysis.</span>
          )}
        </div>
      ) : isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-center max-w-lg mx-auto" id="coach-loading-state">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
          <div className="bg-slate-900 border border-white/5 p-4 rounded-xl max-w-md italic mb-4">
            <p className="text-xs text-slate-300">"{currentQuote.quote}"</p>
            <span className="block text-[10px] text-blue-400 mt-2 font-mono font-semibold">— {currentQuote.author}</span>
          </div>
          <span className="text-xs font-semibold text-slate-200 animate-pulse font-mono tracking-wider">
            COMPILE DIALECTICS AND REPAIR LOGIC...
          </span>
        </div>
      ) : (
        report && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="coach-report-display">
            {/* Score and Main Summary */}
            <div className="lg:col-span-4 flex flex-col md:flex-row lg:flex-col items-stretch justify-between gap-4">
              <div className="flex-1 bg-slate-950/60 rounded-xl p-4 border border-slate-800 text-center flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Discipline Index</span>
                <div className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center ${getScoreColor(report.overallScore)}`}>
                  <span className="text-4xl font-extrabold font-mono tracking-tighter">{report.overallScore}</span>
                  <span className="text-[10px] font-sans font-semibold text-slate-300 uppercase mt-0.5">Rating</span>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  {report.overallScore >= 80 ? (
                    <span className="text-emerald-400 font-semibold flex items-center justify-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-emerald-400" /> Professional Grade
                    </span>
                  ) : report.overallScore >= 60 ? (
                    <span className="text-yellow-400 font-semibold">Systemic Leakages</span>
                  ) : (
                    <span className="text-rose-400 font-semibold flex items-center justify-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> High Risk Profile
                    </span>
                  )}
                </div>
              </div>

              {/* Strengths & Weaknesses quick lists */}
              <div className="flex-1 space-y-3">
                <div className="bg-[#14161c] border border-white/5 p-3.5 rounded-xl">
                  <header className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-2">
                    <Award className="w-4 h-4" /> Strong Aspects
                  </header>
                  <ul className="space-y-1.5">
                    {report.strengths.map((str, i) => (
                      <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2 leading-tight">
                        <span className="text-emerald-400 mt-0.5">•</span> {str}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#14161c] border border-white/5 p-3.5 rounded-xl">
                  <header className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold mb-2">
                    <ShieldAlert className="w-4 h-4" /> Leak Traps
                  </header>
                  <ul className="space-y-1.5">
                    {report.weaknesses.map((weak, i) => (
                      <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2 leading-tight">
                        <span className="text-rose-400 mt-0.5">•</span> {weak}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* In-depth coach strategy section */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 p-4 rounded-xl flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold tracking-wider text-blue-400 uppercase">Coach Statement</span>
                    {isDemo && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 uppercase tracking-widest">Heuristic Sandbox Demo</span>
                    )}
                  </div>
                  <h4 className="text-white font-semibold text-sm font-display mt-1">Behavioral Psychologist Review</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-2 italic">
                    "{report.summary}"
                  </p>
                </div>

                <div className="mt-4 pt-3.5 border-t border-white/5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-display">Target setups & guidance</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {report.setupFocus.map((sf, i) => (
                      <div key={i} className="bg-slate-950/40 border border-white/5 p-2.5 rounded-lg text-xs">
                        <span className="font-bold text-slate-200 block">{sf.setup}</span>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">{sf.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action items checkout checklist container */}
              <div className="bg-indigo-950/20 border border-indigo-500/15 p-4 rounded-xl">
                <span className="text-xs font-bold text-indigo-300 block uppercase tracking-widest mb-3 font-display">
                  Interactive Tactical Drills
                </span>
                <div className="space-y-2">
                  {report.tacticalPlan.map((step, idx) => {
                    const isChecked = !!checkedPlanIndices[idx];
                    return (
                      <button
                        key={idx}
                        onClick={() => setCheckedPlanIndices({ ...checkedPlanIndices, [idx]: !isChecked })}
                        className={`w-full text-left p-2.5 rounded-lg border flex items-start gap-3 transition-all cursor-pointer ${
                          isChecked
                            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                            : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-300"
                        }`}
                      >
                        <CheckCircle className={`w-4 h-4 mt-0.5 shrink-0 transition-colors ${isChecked ? "text-emerald-400" : "text-slate-600"}`} />
                        <div>
                          <span className={`text-xs block ${isChecked ? "line-through text-slate-400" : "font-medium"}`}>
                            {step}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between p-2 rounded bg-indigo-500/10 text-[10px] text-indigo-300">
                  <p className="font-mono">{report.disciplineAdvice}</p>
                </div>
              </div>

              {/* Trigger dynamic reload option */}
              <div className="flex justify-end gap-3 mt-1">
                <button
                  onClick={runAICoachAnalysis}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-Evaluate Journals
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
