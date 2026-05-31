/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Sparkles, Check, X, Shield, Landmark, HelpCircle, Loader2 } from "lucide-react";

interface PricingTableProps {
  currentPlan?: string;
  userId?: string;
  userEmail?: string;
}

export default function PricingTable({ currentPlan = "Free", userId = "guest", userEmail = "" }: PricingTableProps) {
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (plan: string) => {
    setLoadingPlan(plan);
    try {
      const response = await fetch("/api/payment/checkout-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          userId,
          userEmail
        })
      });

      if (!response.ok) {
        throw new Error("No se pudo obtener el checkout link.");
      }

      const result = await response.json();
      if (result.init_point) {
        // Redirect to Mercado Pago checkout (real or simulated)
        console.log(`[PricingTable] Redirecting user to Checkout location: ${result.init_point}`);
        window.location.href = result.init_point;
      }
    } catch (err) {
      console.error(err);
      alert("Hubo un error al generar la orden de pago con Mercado Pago.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const getPrice = (plan: string) => {
    if (plan === "Free") return 0;
    if (plan === "Pro") return isAnnual ? 12 : 14;
    return isAnnual ? 18 : 21;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200" id="pricing-page-container">
      
      {/* Header text */}
      <div className="text-center max-w-xl mx-auto space-y-3">
        <h2 className="text-3xl font-extrabold text-white font-display tracking-tight">Mejora tu Sistema de Trading</h2>
        <p className="text-xs text-slate-400">
          Elige el plan ideal para llevar un registro profesional de tus operaciones y auditar tu psicología de mercado con Inteligencia Artificial.
        </p>

        {/* Annual/Monthly Toggle */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <span className={`text-xs font-semibold ${!isAnnual ? "text-indigo-400" : "text-slate-400"}`}>Mensual</span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-12 h-6.5 bg-[#211d33] border border-white/5 rounded-full p-1 transition-all relative flex items-center cursor-pointer"
          >
            <div className={`w-4.5 h-4.5 bg-indigo-500 rounded-full transition-all ${isAnnual ? "translate-x-5.5 bg-pink-500" : ""}`}></div>
          </button>
          <span className={`text-xs font-semibold flex items-center gap-1.5 ${isAnnual ? "text-pink-400" : "text-slate-400"}`}>
            Anual
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full font-bold">Ahorra ~20%</span>
          </span>
        </div>
      </div>

      {/* Plans comparison cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto" id="pricing-plans-grid">
        
        {/* Plan 1: Free */}
        <div className={`bg-[#1e152d] border rounded-2xl p-6.5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
          currentPlan === "Free" 
            ? "border-emerald-500/30 ring-1 ring-emerald-500/15" 
            : "border-white/5 hover:border-white/10"
        }`}>
          {currentPlan === "Free" && (
            <div className="absolute top-0 right-0 bg-emerald-500/15 border-b border-l border-emerald-500/25 text-emerald-400 text-[10px] uppercase font-bold py-1 px-3.5 rounded-bl-xl font-mono tracking-wider">
              Tu Plan Activo
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white font-display">Plan Free</h3>
              <p className="text-xs text-slate-400 mt-1">Ideal para dar tus primeros pasos.</p>
            </div>

            <div className="py-2 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-white font-mono">$0</span>
              <span className="text-xs text-slate-400">/ mes</span>
            </div>

            <div className="h-px bg-white/5"></div>

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-emerald-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span>Hasta 30 trades al mes</span>
              </li>
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-emerald-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span>Journal de trading básico</span>
              </li>
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-emerald-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span>Métricas de volumen básicas</span>
              </li>
              <li className="flex items-start gap-2.5 text-slate-500 line-through">
                <X className="w-4 h-4 text-slate-600 stroke-[2] shrink-0 mt-0.5" />
                <span>AI Risk Coach</span>
              </li>
              <li className="flex items-start gap-2.5 text-slate-500 line-through">
                <X className="w-4 h-4 text-slate-600 stroke-[2] shrink-0 mt-0.5" />
                <span>Estadísticas avanzadas de setups</span>
              </li>
              <li className="flex items-start gap-2.5 text-slate-500 line-through">
                <X className="w-4 h-4 text-slate-600 stroke-[2] shrink-0 mt-0.5" />
                <span>Exportación de PDF & CSV</span>
              </li>
            </ul>
          </div>

          <button
            disabled
            className="w-full mt-8 py-3.5 px-4 rounded-xl text-center text-xs font-bold transition-all bg-[#0d0a14]/60 text-slate-500 border border-white/5"
          >
            {currentPlan === "Free" ? "Plan Actual Operativo" : "Incluido de forma predeterminada"}
          </button>
        </div>

        {/* Plan 2: Pro - Key conversion point */}
        <div className={`bg-gradient-to-b from-[#21183c] to-[#1e152d] border rounded-2xl p-6.5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 shadow-xl ${
          currentPlan === "Pro" 
            ? "border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-indigo-500/5" 
            : "border-indigo-500/25 hover:border-indigo-500/40 shadow-black/30"
        }`}>
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] uppercase font-bold py-1 px-3 rounded-bl-xl font-mono tracking-widest flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-300" /> RECOMENDADO
          </div>

          {currentPlan === "Pro" && (
            <div className="absolute top-7 right-0 bg-emerald-500/10 border-b border-l border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold py-0.5 px-3.5 rounded-bl-xl font-mono tracking-wider">
              Tu Plan Activo
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-display">Plan Pro</h3>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold font-sans px-2 py-0.5 rounded-full uppercase tracking-wider">AI Básico</span>
              </div>
              <p className="text-xs text-indigo-200/70 mt-1">Para traders activos que quieren optimizarse.</p>
            </div>

            <div className="py-2 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-white font-mono">${getPrice("Pro")}</span>
              <span className="text-xs text-slate-400">/ mes</span>
            </div>

            <div className="h-px bg-indigo-500/10"></div>

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-indigo-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span><strong>Trades ilimitados</strong></span>
              </li>
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-indigo-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span className="flex items-center gap-1">
                  <strong>AI Coach Básico (Gemini)</strong>
                </span>
              </li>
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-indigo-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span>Estadísticas avanzadas</span>
              </li>
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-indigo-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span>Exportación de <strong>PDF & CSV</strong></span>
              </li>
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-indigo-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span>Tags y playbooks personalizados</span>
              </li>
              <li className="flex items-start gap-2.5 text-slate-500 line-through">
                <X className="w-4 h-4 text-slate-600 stroke-[2] shrink-0 mt-0.5" />
                <span>Múltiples cuentas</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleSubscribe("Pro")}
            disabled={loadingPlan !== null || currentPlan === "Pro"}
            className={`w-full mt-8 py-3.5 px-4 rounded-xl text-center text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
              currentPlan === "Pro"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 cursor-default"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/15"
            }`}
          >
            {loadingPlan === "Pro" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : currentPlan === "Pro" ? (
              "Plan Actual"
            ) : (
              "Pagar con Mercado Pago"
            )}
          </button>
        </div>

        {/* Plan 3: Elite */}
        <div className={`bg-[#1e152d] border rounded-2xl p-6.5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
          currentPlan === "Elite" 
            ? "border-pink-500/30 ring-1 ring-pink-500/15" 
            : "border-white/5 hover:border-white/10"
        }`}>
          {currentPlan === "Elite" && (
            <div className="absolute top-0 right-0 bg-emerald-500/15 border-b border-l border-emerald-500/25 text-emerald-400 text-[10px] uppercase font-bold py-1 px-3.5 rounded-bl-xl font-mono tracking-wider">
              Tu Plan Activo
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-display">Plan Elite</h3>
                <span className="text-[10px] bg-pink-500/20 text-pink-300 font-bold font-sans px-2 py-0.5 rounded-full uppercase tracking-wider">AI Avanzado</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Para traders de alto nivel y cuentas de fondeo.</p>
            </div>

            <div className="py-2 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-white font-mono">${getPrice("Elite")}</span>
              <span className="text-xs text-slate-400">/ mes</span>
            </div>

            <div className="h-px bg-white/5"></div>

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-pink-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span><strong>Todo lo del plan Pro</strong></span>
              </li>
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-pink-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span><strong>AI Coach Avanzado</strong></span>
              </li>
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-pink-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span><strong>Múltiples cuentas sincronizadas</strong></span>
              </li>
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-pink-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span>Importación automática (API csv file)</span>
              </li>
              <li className="flex items-start gap-2.5 text-[#fffb]">
                <Check className="w-4 h-4 text-pink-400 stroke-[2.5] shrink-0 mt-0.5" />
                <span>Acceso API & Soporte Prioritario</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleSubscribe("Elite")}
            disabled={loadingPlan !== null || currentPlan === "Elite"}
            className={`w-full mt-8 py-3.5 px-4 rounded-xl text-center text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
              currentPlan === "Elite"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 cursor-default"
                : "bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white shadow-lg"
            }`}
          >
            {loadingPlan === "Elite" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : currentPlan === "Elite" ? (
              "Plan Actual"
            ) : (
              "Pagar con Mercado Pago"
            )}
          </button>
        </div>

      </div>

      {/* Security info badges */}
      <div className="bg-[#1e152d]/50 border border-white/5 p-4 rounded-2xl max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-4 text-left justify-between" id="pricing-security-badges">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/20 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Transacciones 100% Seguras</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Procesado oficialmente bajo las medidas de seguridad SSL de Mercado Pago en toda Latinoamérica.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 uppercase tracking-widest text-[#94a3b8] font-mono font-bold text-[10px] bg-slate-950/40 py-2 px-3 border border-white/5 rounded-xl">
          <Landmark className="w-4 h-4 text-indigo-400" /> MERCADO PAGO API
        </div>
      </div>

    </div>
  );
}
