/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Trade } from "../types";
import { X, Play, RefreshCw, Layers, CheckCircle, Flame, ArrowRight, ShieldAlert, Trash2 } from "lucide-react";

interface TradeDetailsModalProps {
  trade: Trade | null;
  onClose: () => void;
  onDeleteTrade: (id: string) => void;
  onUpdateNotes: (id: string, newNotes: string) => void;
}

const REPLAY_STEPS = [
  { label: "Trigger Spot Found", desc: "Order execution placed on confirmation line matching system parameters." },
  { label: "Impulse Momentum Support", desc: "Price broke into expected structural delta with higher volume nodes." },
  { label: "Trailing Stop Adjusted", desc: "Risk parameters locked at Break-Even. Profit margins insulated." },
  { label: "Final Target Scales Hit", desc: "Contract scaled out completely at predefined resistance zones." }
];

export default function TradeDetailsModal({ trade, onClose, onDeleteTrade, onUpdateNotes }: TradeDetailsModalProps) {
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [isReplaying, setIsReplaying] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");

  useEffect(() => {
    if (trade) {
      setEditedNotes(trade.notes || "");
      setActiveStep(-1);
      setIsReplaying(false);
    }
  }, [trade]);

  if (!trade) return null;

  // Auto tick through steps of the Replay simulation
  const startReplaySimulation = () => {
    setActiveStep(0);
    setIsReplaying(true);
  };

  useEffect(() => {
    let timer: any;
    if (isReplaying && activeStep >= 0 && activeStep < REPLAY_STEPS.length) {
      timer = setTimeout(() => {
        setActiveStep(prev => prev + 1);
      }, 2500); // 2.5 seconds per trade phase
    } else if (activeStep >= REPLAY_STEPS.length) {
      setIsReplaying(false);
    }
    return () => clearTimeout(timer);
  }, [isReplaying, activeStep]);

  const progressPercentage = activeStep >= 0 ? Math.min((activeStep / (REPLAY_STEPS.length - 1)) * 100, 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm" id="trade-details-modal-wrapper">
      <div className="relative w-full max-w-xl bg-[#1e152d] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-light-white/5 bg-[#130f22]">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
              trade.action === "Buy" ? "bg-blue-500/10 text-blue-400" : "bg-rose-500/10 text-rose-400"
            }`}>
              {trade.action === "Buy" ? "LONG" : "SHORT"} {trade.assetType}
            </span>
            <span className="text-sm font-bold text-white font-mono">{trade.symbol}</span>
            <span className="text-[10px] text-slate-500">{trade.date} {trade.time}</span>
          </div>
          
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable specs */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Main P&L statistics row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0d0e12] border border-white/5 p-3 rounded-xl text-center">
              <span className="text-[9px] text-slate-500 uppercase font-sans tracking-wide block">Net Profit/Loss</span>
              <span className={`text-lg font-bold font-mono tracking-tight block mt-1 ${
                trade.netPnl >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}>
                {trade.netPnl >= 0 ? "+" : ""}${trade.netPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-[#0d0e12] border border-white/5 p-3 rounded-xl text-center">
              <span className="text-[9px] text-slate-500 uppercase font-sans tracking-wide block">Gross Result</span>
              <span className={`text-sm font-semibold font-mono block mt-1.5 ${
                trade.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}>
                ${trade.pnl.toLocaleString()}
              </span>
            </div>

            <div className="bg-[#0d0e12] border border-white/5 p-3 rounded-xl text-center">
              <span className="text-[9px] text-slate-500 uppercase font-sans tracking-wide block">Sizing Parameters</span>
              <span className="text-xs font-semibold font-mono text-slate-300 block mt-1.5">
                {trade.quantity} unit{trade.quantity !== 1 && "s"}
              </span>
            </div>
          </div>

          {/* Pricing Parameters Grid */}
          <div className="bg-[#0d0e12]/60 rounded-xl p-3.5 border border-white/5 space-y-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-display">Contract Ledger details</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[9px]">Entry Exec. Price</span>
                <span className="font-mono text-white font-medium">${trade.entryPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">Exit Exec. Price</span>
                <span className="font-mono text-white font-medium">${trade.exitPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">Commissions</span>
                <span className="font-mono text-slate-300">${trade.commissions.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">Exchange Fees</span>
                <span className="font-mono text-slate-300">${trade.fees.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
            {/* Setups List */}
            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2 font-display">Target Strategy Tag</span>
              <div className="flex flex-wrap gap-1">
                {trade.setups.length === 0 ? (
                  <span className="text-[10px] text-slate-500">None registered</span>
                ) : (
                  trade.setups.map((s: string) => (
                    <span key={s} className="bg-blue-600/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[9px] font-medium">
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Mistakes List */}
            <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest block mb-2 font-display">Behavioral Slip Tag</span>
              <div className="flex flex-wrap gap-1">
                {trade.mistakes.length === 0 ? (
                  <span className="text-[10px] text-emerald-500 font-medium">No mistakes flagged</span>
                ) : (
                  trade.mistakes.map((m: string) => (
                    <span key={m} className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded text-[9px] font-medium">
                      ☠️ {m}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Core Interactive Replay widget */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold font-display text-white">Systemic Strategy Replay</span>
              </div>
              <button
                onClick={startReplaySimulation}
                disabled={isReplaying}
                className={`text-[9px] font-mono px-2 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors ${
                  isReplaying 
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                    : "bg-blue-600 hover:bg-blue-700 text-white font-bold"
                }`}
              >
                {isReplaying ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Simulated Replay Ticking...
                  </>
                ) : (
                  <>
                    <Play className="w-2.5 h-2.5 fill-current" /> Run Market Replay
                  </>
                )}
              </button>
            </div>

            {/* Simulated Progression timeline */}
            {activeStep >= 0 && (
              <div className="space-y-3.5 mt-2 animate-in fade-in slide-in-from-top-3 duration-250">
                <div className="relative h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-1000"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                <div className="space-y-2">
                  {REPLAY_STEPS.map((step, idx) => {
                    const isPassed = activeStep > idx;
                    const isActive = activeStep === idx;
                    
                    return (
                      <div 
                        key={idx}
                        className={`text-xs flex items-start gap-2.5 p-2 rounded-lg transition-all ${
                          isActive 
                            ? "bg-blue-500/10 border border-blue-500/25" 
                            : isPassed 
                            ? "text-slate-400" 
                            : "text-slate-600 opacity-60"
                        }`}
                      >
                        <CheckCircle className={`w-3.5 h-3.5 mt-0.5 ${
                          isPassed || isActive ? "text-blue-400" : "text-slate-700"
                        }`} />
                        <div>
                          <span className={`font-semibold block ${isActive ? "text-white" : ""}`}>{step.label}</span>
                          {isActive && <p className="text-[10px] text-slate-300 mt-0.5 leading-normal">{step.desc}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Screenshot image display if available */}
          {trade.screenshot && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block font-display">Captura de Pantalla</span>
              <div className="relative rounded-xl overflow-hidden border border-white/5 bg-[#0d0e12] p-2 flex items-center justify-center">
                <img 
                  src={trade.screenshot} 
                  alt={`Screenshot ${trade.symbol}`} 
                  className="max-h-56 w-auto object-contain rounded"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {/* Editable journal notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block font-display">Notes & Execution Retrospective</label>
            <textarea
              rows={3}
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500/40"
            />
            <div className="flex justify-end pt-1">
              <button
                onClick={() => {
                  onUpdateNotes(trade.id, editedNotes);
                  alert("Journal notes committed successfully!");
                }}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 hover:text-white rounded font-medium transition-colors cursor-pointer"
              >
                Save Notes
              </button>
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-white/5 bg-[#130f22] flex items-center justify-between">
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to completely delete your trade on ${trade.symbol}? This cannot be undone.`)) {
                onDeleteTrade(trade.id);
                onClose();
              }
            }}
            className="text-xs hover:text-white p-2 rounded-lg text-rose-400 hover:bg-rose-950/20 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Delete Trade Record
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}
