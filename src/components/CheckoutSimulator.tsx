/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { supabase } from "../supabase";
import { ShieldCheck, CreditCard, Landmark, CheckCircle2, Loader2, ArrowLeft, BadgeHelp } from "lucide-react";

export default function CheckoutSimulator() {
  const [params, setParams] = useState({
    userId: "guest",
    plan: "Pro",
    price: 14,
    email: "test@tradyum.com"
  });

  const [paymentMethod, setPaymentMethod] = useState<"card" | "wallet" | "cash">("card");
  
  // Card Input Form
  const [cardNumber, setCardNumber] = useState("4517 8422 9310 5013");
  const [cardName, setCardName] = useState("JUAN PEREZ");
  const [cardExpiry, setCardExpiry] = useState("12/29");
  const [cardCvv, setCardCvv] = useState("123");
  const [cardDni, setCardDni] = useState("38491823");

  const [paymentState, setPaymentState] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(4);

  useEffect(() => {
    // Parse URL params
    const searchParams = new URLSearchParams(window.location.search);
    const userId = searchParams.get("userId") || "guest";
    const plan = searchParams.get("plan") || "Pro";
    const priceStr = searchParams.get("price") || "14";
    const email = searchParams.get("email") || "user@tradyum.com";

    setParams({
      userId,
      plan,
      price: parseInt(priceStr, 10) || (plan === "Elite" ? 21 : 14),
      email
    });
  }, []);

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    setPaymentState("processing");
    setStatusMessage("Estableciendo conexión encriptada con los servidores de Mercado Pago...");

    // Step 1: Processing
    await new Promise((r) => setTimeout(r, 1200));
    setStatusMessage("Procesando cobro recurrentemente...");

    // Step 2: Validating with bank
    await new Promise((r) => setTimeout(r, 1200));
    setStatusMessage("Transacción autorizada. Actualizando credenciales de suscripción en Tradyum...");

    // Step 3: Complete Database Update
    try {
      if (params.userId && params.userId !== "guest" && params.userId !== "null") {
        console.log("[Simulation] Syncing with cloud Supabase database for UID:", params.userId);
        
        // Update timezone and complete profile checkout indicator in profiles
        await supabase
          .from("profiles")
          .update({
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          })
          .eq("id", params.userId);
      }

      // Sync local storage as well for instant update across tabs / local profiles
      const cachedProfileStr = localStorage.getItem("tradezella_journal_perfil") || "{}";
      try {
        const cachedProfile = JSON.parse(cachedProfileStr);
        cachedProfile.plan = params.plan;
        cachedProfile.subscriptionId = `sub_mp_local_${Date.now()}`;
        localStorage.setItem("tradezella_journal_perfil", JSON.stringify(cachedProfile));
        
        // Dispatch standard storage event to update other active client views
        window.dispatchEvent(new StorageEvent("storage", {
          key: "tradezella_journal_perfil",
          newValue: JSON.stringify(cachedProfile)
        }));
      } catch (e) {
        console.error("Local storage sync error:", e);
      }

      // Notify server webhook simulation
      try {
        await fetch("/api/payment/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "created",
            api_version: "v1",
            data: { id: `pre_mp_${Date.now()}` },
            type: "subscription",
            simulated: true,
            userId: params.userId,
            plan: params.plan
          })
        });
      } catch (err) {
        console.warn("Server webhook notified failed to reply, fallback continues:", err);
      }

      setPaymentState("success");
      setStatusMessage("¡Pago aprobado con éxito!");

    } catch (dbErr) {
      console.error("Error setting subscription in DB:", dbErr);
      setPaymentState("error");
      setStatusMessage("Error al registrar tu suscripción en la base de datos.");
    }
  };

  // Automated redirect timer upon payment approval
  useEffect(() => {
    if (paymentState !== "success") return;
    
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Redirect back to main journal workspace
          window.location.href = `/?payment=success&plan=${params.plan}`;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paymentState, params.plan]);

  const priceARS = Math.round(params.price * 1420); // Simulated ARS transformation rate

  return (
    <div className="min-h-screen bg-[#eceff1] text-[#2c3e50] font-sans flex flex-col justify-between" id="mp-checkout-simulation-page">
      
      {/* Top MP Blue Navigation Header bar */}
      <header className="bg-[#009ee3] text-white py-3 px-6 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight italic font-serif">mercado <span className="font-sans not-italic text-sm bg-yellow-400 text-slate-900 px-1.5 py-0.5 rounded-md font-black">pago</span></span>
            <span className="text-xs text-blue-100 uppercase font-bold tracking-widest pl-2 border-l border-blue-400">Sandbox</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-500 bg-white/95 px-3 py-1 rounded-full font-bold shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Compra Protegida
          </div>
        </div>
      </header>

      {/* Main Form Area */}
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-6 flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Form Panel */}
        <div className="md:col-span-8 bg-white border border-[#cfd8dc] rounded-xl shadow-lg p-5 sm:p-7">
          
          {paymentState === "idle" && (
            <>
              <div className="flex items-center gap-2 mb-6">
                <button 
                  onClick={() => window.history.back()}
                  className="p-1 px-2 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center gap-1 text-xs border border-slate-200 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver
                </button>
                <h2 className="text-md sm:text-lg font-black text-[#1e293b]">¿Cómo deseas pagar?</h2>
              </div>

              {/* Payment Method Option Selector Tabs */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === "card"
                      ? "border-[#009ee3] bg-blue-50/20 text-[#009ee3] shadow-inner font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-500"
                  }`}
                >
                  <CreditCard className="w-6 h-6" />
                  <span className="text-[10px] tracking-tight uppercase">Tarjeta</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setPaymentMethod("wallet")}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === "wallet"
                      ? "border-[#009ee3] bg-blue-50/20 text-[#009ee3] shadow-inner font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-500"
                  }`}
                >
                  <Landmark className="w-6 h-6" />
                  <span className="text-[10px] tracking-tight uppercase">Mi Dinero</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === "cash"
                      ? "border-[#009ee3] bg-blue-50/20 text-[#009ee3] shadow-inner font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-500"
                  }`}
                >
                  <BadgeHelp className="w-6 h-6" />
                  <span className="text-[10px] tracking-tight uppercase">Efectivo</span>
                </button>
              </div>

              {/* Card Payment Form rendering */}
              {paymentMethod === "card" && (
                <form onSubmit={handlePay} className="space-y-4">
                  <div className="bg-slate-50 p-4 border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                    💡 **Simulación Sandbox Activa**: Puedes usar la información de tarjeta de prueba cargada abajo para evaluar la integración. No se debitará dinero real.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block uppercase">Número de Tarjeta</label>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4517 8422 9310 5013"
                      className="w-full bg-[#fcfdfd] border border-slate-300 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 block uppercase">Vencimiento</label>
                      <input
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/AA"
                        maxLength={5}
                        className="w-full bg-[#fcfdfd] border border-slate-300 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-800"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 block uppercase">Cód. Seguridad</label>
                      <input
                        type="text"
                        required
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="123"
                        maxLength={4}
                        className="w-full bg-[#fcfdfd] border border-slate-300 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block uppercase">Nombre del Titular</label>
                    <input
                      type="text"
                      required
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      placeholder="JUAN PEREZ"
                      className="w-full bg-[#fcfdfd] border border-slate-300 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block uppercase">Documento / DNI</label>
                    <input
                      type="text"
                      required
                      value={cardDni}
                      onChange={(e) => setCardDni(e.target.value)}
                      placeholder="38491823"
                      className="w-full bg-[#fcfdfd] border border-slate-300 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#009ee3] hover:bg-[#0089c7] text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md mt-6 cursor-pointer text-center tracking-wide block text-sm"
                  >
                    Confirmar Pago en Pesos (${priceARS.toLocaleString()} ARS/mes)
                  </button>
                </form>
              )}

              {paymentMethod === "wallet" && (
                <div className="space-y-5 py-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <Landmark className="w-8 h-8 text-indigo-500 mx-auto mb-2 animate-bounce" />
                    <h4 className="font-semibold text-slate-800 text-sm">Dispones de sado en tu cuenta MP</h4>
                    <p className="text-xs text-slate-500 mt-1">Saldo disponible: $50.000 ARS. Tradyum debitará automáticamente `${params.price} USD` equivalent monthly.</p>
                  </div>
                  <button
                    onClick={handlePay}
                    className="w-full bg-[#009ee3] hover:bg-[#0089c7] text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md cursor-pointer block text-sm text-center"
                  >
                    Pagar con Dinero en Cuenta MP
                  </button>
                </div>
              )}

              {paymentMethod === "cash" && (
                <div className="space-y-5 py-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <h4 className="font-semibold text-slate-800 text-sm">Pago presencial Rapipago / Pago Fácil</h4>
                    <p className="text-xs text-slate-500 mt-1">Se generará un cupón de pago simulado por $${priceARS} ARS.</p>
                  </div>
                  <button
                    onClick={handlePay}
                    className="w-full bg-[#009ee3] hover:bg-[#0089c7] text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md cursor-pointer block text-sm text-center"
                  >
                    Generar Cupón de Efectivo e Iniciar
                  </button>
                </div>
              )}
            </>
          )}

          {paymentState === "processing" && (
            <div className="py-14 text-center flex flex-col items-center justify-center space-y-6 animate-pulse">
              <Loader2 className="w-11 h-11 text-[#009ee3] animate-spin" />
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono tracking-widest text-blue-500 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 font-extrabold">
                  Encriptación SSL Activa
                </span>
                <h3 className="text-lg font-bold text-slate-800 font-display">Procesando Transacción Segura...</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed italic">{statusMessage}</p>
              </div>
            </div>
          )}

          {paymentState === "success" && (
            <div className="py-12 text-center flex flex-col items-center justify-center space-y-6">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10 border border-emerald-300">
                <CheckCircle2 className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 font-display">¡Suscripción Activada Exitosamente!</h3>
                <p className="text-xs text-slate-500">
                  Hemos notificado a Tradyum con éxito. Tu plan **{params.plan}** ha sido activado en tu cuenta.
                </p>
              </div>

              <div className="bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-xl text-left w-full max-w-sm space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between border-b pb-1.5 border-slate-200">
                  <span className="font-semibold text-slate-500">Transacción</span>
                  <span className="font-mono text-slate-800">#${Date.now().toString().slice(-8)}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5 border-slate-200">
                  <span className="font-semibold text-slate-500">Plan de Cobro</span>
                  <span className="font-bold text-[#009ee3]">{params.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Precio Mensual</span>
                  <span className="font-mono text-slate-800">${params.price} USD / $${priceARS} ARS</span>
                </div>
              </div>

              <p className="text-xs text-[#009ee3] font-semibold animate-pulse pt-2">
                Redirigiendo de regreso a Tradyum Journal en {secondsLeft} segundos...
              </p>
            </div>
          )}

          {paymentState === "error" && (
            <div className="py-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center border border-rose-300">
                <CheckCircle2 className="w-8 h-8 rotate-45" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No se pudo procesar tu pago</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto p-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-md">
                {statusMessage}
              </p>
              <button
                onClick={() => setPaymentState("idle")}
                className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Reintentar Transacción
              </button>
            </div>
          )}

        </div>

        {/* Right Summary Panel */}
        <div className="md:col-span-4 bg-[#f8fafc] border border-[#cfd8dc] rounded-xl shadow-lg p-5">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b pb-3 mb-4">Resumen del Pedido</h3>
          
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-slate-800">Tradyum {params.plan}</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Facturación recurrente mensual con Mercado Pago.</p>
              </div>
              <span className="font-mono font-bold text-slate-800">${params.price} USD</span>
            </div>

            <div className="h-px bg-slate-200"></div>

            <div className="flex justify-between items-center text-sm font-black text-slate-800">
              <span>Total a pagar</span>
              <div className="text-right">
                <span className="block font-mono text-[#009ee3]">${params.price} USD</span>
                <span className="block text-[10px] font-medium font-sans text-slate-500 mt-0.5">~ $${priceARS.toLocaleString()} ARS</span>
              </div>
            </div>

            <div className="h-px bg-slate-200"></div>

            <div className="pt-2 text-[10px] text-slate-400 space-y-2 leading-relaxed">
              <p>✔ Cancela cuando quieras desde tu perfil de usuario.</p>
              <p>✔ El AI Coach audita tus operaciones y te asesora en disciplina financiera de forma automática.</p>
              <p>✔ Conexión oficial protegida bajo encriptación Mercado Pago de 256 bits.</p>
            </div>
          </div>
        </div>

      </main>

      {/* Secure footer */}
      <footer className="bg-slate-200 py-4 px-6 border-t border-slate-300 text-center text-[10px] text-slate-500 font-medium">
        <p>© ${new Date().getFullYear()} Mercado Pago. Esta es una simulación de cobro oficial sandbox.</p>
      </footer>

    </div>
  );
}
