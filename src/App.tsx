/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, FormEvent, useRef } from "react";
import { Trade, AssetType, TradeAction, Account, JournalEntry } from "./types";
import { INITIAL_TRADES } from "./mockData";

// Firebase imports
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  onSnapshot
} from "firebase/firestore";
import { 
  auth, 
  db, 
  googleProvider, 
  OperationType, 
  handleFirestoreError 
} from "./firebase";

// Motion for React animations
import { motion, AnimatePresence } from "motion/react";

// Components
import DashboardStats from "./components/DashboardStats";
import CalendarView from "./components/CalendarView";
import PerformanceCharts from "./components/PerformanceCharts";
import TradeCoach from "./components/TradeCoach";
import AddTradeModal from "./components/AddTradeModal";
import TradeDetailsModal from "./components/TradeDetailsModal";
import PricingTable from "./components/PricingTable";
import CheckoutSimulator from "./components/CheckoutSimulator";
import ImportTradesView from "./components/ImportTradesView";

// Icons
import {
  TrendingUp,
  LayoutDashboard,
  LayoutGrid,
  Calendar as CalendarIcon,
  BookOpen,
  User as UserIcon,
  Settings,
  Plus,
  Trash2,
  Wallet,
  CheckCircle,
  Eye,
  AlertCircle,
  FolderDot,
  Check,
  Search,
  BookMarked,
  Info,
  LogOut,
  Sparkles,
  CloudLightning,
  RefreshCw,
  Lock,
  Upload
} from "lucide-react";

const CompassLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="11 11 78 78" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Background/Backing Ring */}
    <circle cx="50" cy="50" r="28" stroke="#334155" strokeWidth="8" fill="none" />
    {/* Outer border of the ring for extra contrast (black/slate) */}
    <circle cx="50" cy="50" r="32" stroke="#0f172a" strokeWidth="2" fill="none" />
    <circle cx="50" cy="50" r="24" stroke="#0f172a" strokeWidth="2" fill="none" />
    
    {/* 4-Pointed Beveled Compass Star */}
    {/* Top Point - Left (White) */}
    <polygon points="50,12 50,50 44,44" fill="#ffffff" />
    {/* Top Point - Right (Blue) */}
    <polygon points="50,12 50,50 56,44" fill="#2563eb" />
    
    {/* Right Point - Top (Blue) */}
    <polygon points="88,50 50,50 56,44" fill="#2563eb" />
    {/* Right Point - Bottom (White) */}
    <polygon points="88,50 50,50 56,56" fill="#ffffff" />
    
    {/* Bottom Point - Right (White) */}
    <polygon points="50,88 50,50 56,56" fill="#ffffff" />
    {/* Bottom Point - Left (Blue) */}
    <polygon points="50,88 50,50 44,56" fill="#2563eb" />
    
    {/* Left Point - Bottom (Blue) */}
    <polygon points="12,50 50,50 44,56" fill="#2563eb" />
    {/* Left Point - Top (White) */}
    <polygon points="12,50 50,50 44,44" fill="#ffffff" />
  </svg>
);

export default function App() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<"dashboard" | "operaciones" | "calendario" | "diario" | "cuentas" | "configuracion" | "importar" | "planes">("dashboard");
  const [expandedAccountDashboardId, setExpandedAccountDashboardId] = useState<string | null>(null);

  // Google Auth Core State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const isSeedingRef = useRef(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  // Core Data States
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [userProfileRaw, setUserProfile] = useState({
    name: "Invitado",
    email: "",
    plan: "Elite", // All features unlocked for free usage by request
    subscriptionId: "",
    mpPreapprovalId: ""
  });

  const userProfile = {
    ...userProfileRaw,
    plan: "Elite" as const
  };

  // Selected Day on Calendar
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Active account filter for main dropdown ("all" or Specific Account ID)
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  // Sub-modal visibility triggers
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // Daily loss limit configuration state
  const [dailyLossLimit, setDailyLossLimit] = useState<number>(() => {
    const saved = localStorage.getItem("tradyum_daily_loss_limit");
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) return parsed;
    }
    return -200; // default to -$200
  });

  // Calculate today's PnL automatically (resets to 0 at midnight of user local time)
  const todayTrades = useMemo(() => {
    const d = new Date();
    const localTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return trades.filter(t => t.date === localTodayStr);
  }, [trades]);

  const todayPnl = useMemo(() => {
    return todayTrades.reduce((sum, t) => sum + (t.netPnl !== undefined ? t.netPnl : (t.pnl || 0)), 0);
  }, [todayTrades]);

  const progressPct = useMemo(() => {
    const lossConsumed = todayPnl < 0 ? Math.abs(todayPnl) : 0;
    const limitAbs = Math.abs(dailyLossLimit);
    return limitAbs > 0 ? Math.min(100, (lossConsumed / limitAbs) * 100) : 0;
  }, [todayPnl, dailyLossLimit]);

  // Premium modal and notification states
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<"limit_30" | "ai_coach" | "stats" | "multi_account" | "export" | "">("");
  const [paymentSuccessToast, setPaymentSuccessToast] = useState<string | null>(null);
  const [authError, setAuthError] = useState<{ code: string; message: string; domain?: string } | null>(null);

  // Quick form state for new accounts
  const [isNewAccountOptionOpen, setIsNewAccountOptionOpen] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccBalance, setNewAccBalance] = useState<number>(25000);
  const [newAccType, setNewAccType] = useState("Fondeo");

  // Quick form state for new journal entries (Diario)
  const [isNewJournalOpen, setIsNewJournalOpen] = useState(false);
  const [newJournalTitle, setNewJournalTitle] = useState("");
  const [newJournalContent, setNewJournalContent] = useState("");
  const [newJournalSymbol, setNewJournalSymbol] = useState("");

  // Standard initial accounts template
  const getDefaultAccounts = (): Account[] => [
    { id: "fondeo", name: "Fondeo", type: "Fondeo", balance: 25000, initialBalance: 25000, status: "Activa" },
    { id: "demo", name: "DEMO", type: "Demo", balance: 25000, initialBalance: 25000, status: "Activa" }
  ];

  // Helper: Seed Cloud Data with local cache assets
  const seedCloudData = async (userId: string, currentTrades: Trade[], currentAccounts: Account[], currentJournal: JournalEntry[]) => {
    if (isSeedingRef.current) return;
    isSeedingRef.current = true;
    try {
      console.log("[Firebase] Seeding local data to cloud for user ID:", userId);
      const accList = currentAccounts.length > 0 ? currentAccounts : getDefaultAccounts();
      for (const acc of accList) {
        const accRef = doc(db, "users", userId, "accounts", acc.id);
        await setDoc(accRef, {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          balance: acc.balance,
          initialBalance: acc.initialBalance,
          status: acc.status || "Activa",
          updatedAt: new Date().toISOString()
        });
      }

      const trList = currentTrades.length > 0 
        ? currentTrades 
        : INITIAL_TRADES.map((t, idx) => ({ ...t, accountId: idx % 2 === 0 ? "fondeo" : "demo" }));
      for (const t of trList) {
        const trRef = doc(db, "users", userId, "trades", t.id);
        const tradePayload: any = {
          id: t.id,
          date: t.date,
          time: t.time || "00:00",
          symbol: t.symbol,
          assetType: t.assetType,
          action: t.action,
          quantity: t.quantity,
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          commissions: t.commissions || 0,
          fees: t.fees || 0,
          setups: t.setups || [],
          mistakes: t.mistakes || [],
          notes: t.notes || "",
          pnl: t.pnl || 0,
          netPnl: t.netPnl || 0,
          status: t.status || "Flat",
          accountId: t.accountId || "fondeo",
          updatedAt: new Date().toISOString()
        };
        if (t.screenshot) {
          tradePayload.screenshot = t.screenshot;
        }
        await setDoc(trRef, tradePayload);
      }

      if (currentJournal.length > 0) {
        for (const j of currentJournal) {
          const jrRef = doc(db, "users", userId, "journalEntries", j.id);
          await setDoc(jrRef, {
            id: j.id,
            date: j.date,
            time: j.time || "00:00",
            title: j.title,
            content: j.content,
            associatedSymbol: j.associatedSymbol || "",
            updatedAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error("[Firebase] Error seeding data: ", err);
    } finally {
      isSeedingRef.current = false;
    }
  };

  // Auth Subscription
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setUserProfile({
          name: user.displayName || "Usuario Tradyum",
          email: user.email || "",
          plan: "Elite",
          subscriptionId: "unlocked_free",
          mpPreapprovalId: "unlocked_free"
        });
        
        // Write profile details to Firestore
        try {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              name: user.displayName || "Usuario Tradyum",
              email: user.email || "",
              updatedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error("Error setting custom user document: ", error);
        }
      } else {
        setUserProfile({
          name: "Invitado",
          email: "",
          plan: "Elite",
          subscriptionId: "",
          mpPreapprovalId: ""
        });
      }
      setIsLoadingAuth(false);
    });
    return unsub;
  }, []);

  // Sync state loading and real-time Firestore synchronization callback
  useEffect(() => {
    if (isLoadingAuth) return;

    // Cross-tab / cross-iframe synchronizer for offline Modo Invitado
    const handleStorageChange = (e: StorageEvent) => {
      if (currentUser) return; // Managed by Firestore when logged in!
      
      if (e.key === "tradezella_journal_trades" && e.newValue) {
        try { setTrades(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === "tradezella_journal_accounts" && e.newValue) {
        try { setAccounts(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === "tradezella_journal_diario" && e.newValue) {
        try { setJournalEntries(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === "tradezella_journal_perfil" && e.newValue) {
        try { setUserProfile(JSON.parse(e.newValue)); } catch {}
      }
    };

    window.addEventListener("storage", handleStorageChange);

    if (!currentUser) {
      // Offline/Local caching
      const cachedTrades = localStorage.getItem("tradezella_journal_trades");
      if (cachedTrades) {
        try {
          setTrades(JSON.parse(cachedTrades));
        } catch {
          setTrades(INITIAL_TRADES.map((t, idx) => ({ ...t, accountId: idx % 2 === 0 ? "fondeo" : "demo" })));
        }
      } else {
        setTrades(INITIAL_TRADES.map((t, idx) => ({ ...t, accountId: idx % 2 === 0 ? "fondeo" : "demo" })));
      }

      const cachedAccounts = localStorage.getItem("tradezella_journal_accounts");
      if (cachedAccounts) {
        try {
          setAccounts(JSON.parse(cachedAccounts));
        } catch {
          setAccounts(getDefaultAccounts());
        }
      } else {
        setAccounts(getDefaultAccounts());
      }

      const cachedEntries = localStorage.getItem("tradezella_journal_diario");
      if (cachedEntries) {
        try {
          setJournalEntries(JSON.parse(cachedEntries));
        } catch {
          setJournalEntries([]);
        }
      } else {
        setJournalEntries([]);
      }

      const cachedProfile = localStorage.getItem("tradezella_journal_perfil");
      if (cachedProfile) {
        try {
          setUserProfile(JSON.parse(cachedProfile));
        } catch {}
      }
      return () => {
        window.removeEventListener("storage", handleStorageChange);
      };
    }

    const userId = currentUser.uid;

    // Real-time Firestore Profile & Subscription Subscription
    const userDocRef = doc(db, "users", userId);
    const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const udata = docSnap.data();
        setUserProfile((prev) => ({
          ...prev,
          name: udata.name || prev.name,
          email: udata.email || prev.email,
          plan: "Elite", // Forced Elite for free open usage
          subscriptionId: udata.subscriptionId || "",
          mpPreapprovalId: udata.mpPreapprovalId || ""
        }));
      }
    }, (error) => {
      console.warn("Firestore error subbing user document:", error);
    });

    // Real-time Firestore Accounts Subscription
    const qAccounts = collection(db, "users", userId, "accounts");
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      const list: Account[] = [];
      snapshot.forEach((p) => {
        list.push(p.data() as Account);
      });

      if (snapshot.empty && !isSeedingRef.current) {
        // Read local storage to see if we can migrate existing data, or use defaults
        const localTradesStr = localStorage.getItem("tradezella_journal_trades");
        let localTrades: Trade[] = [];
        if (localTradesStr) {
          try { localTrades = JSON.parse(localTradesStr); } catch {}
        }
        const localAccsStr = localStorage.getItem("tradezella_journal_accounts");
        let localAccs: Account[] = [];
        if (localAccsStr) {
          try { localAccs = JSON.parse(localAccsStr); } catch {}
        }
        const localJournalStr = localStorage.getItem("tradezella_journal_diario");
        let localJournal: JournalEntry[] = [];
        if (localJournalStr) {
          try { localJournal = JSON.parse(localJournalStr); } catch {}
        }

        seedCloudData(userId, localTrades, localAccs, localJournal);
      } else {
        setAccounts(list);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/accounts`);
    });

    // Real-time Firestore Trades Subscription
    const qTrades = collection(db, "users", userId, "trades");
    const unsubTrades = onSnapshot(qTrades, (snapshot) => {
      const list: Trade[] = [];
      snapshot.forEach((p) => {
        list.push(p.data() as Trade);
      });
      // Sort trades descending by date + time
      const sorted = list.sort((a,b) => {
        const dateA = new Date(`${a.date}T${a.time || "00:00"}`);
        const dateB = new Date(`${b.date}T${b.time || "00:00"}`);
        return dateB.getTime() - dateA.getTime();
      });
      setTrades(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/trades`);
    });

    // Real-time Firestore Journal Entries Subscription
    const qJournal = collection(db, "users", userId, "journalEntries");
    const unsubJournal = onSnapshot(qJournal, (snapshot) => {
      const list: JournalEntry[] = [];
      snapshot.forEach((p) => {
        list.push(p.data() as JournalEntry);
      });
      const sorted = list.sort((a,b) => {
        const dateA = new Date(`${a.date}T${a.time || "00:00"}`);
        const dateB = new Date(`${b.date}T${b.time || "00:00"}`);
        return dateB.getTime() - dateA.getTime();
      });
      setJournalEntries(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/journalEntries`);
    });

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      unsubProfile();
      unsubAccounts();
      unsubTrades();
      unsubJournal();
    };
  }, [currentUser, isLoadingAuth]);

  // Check for successful Mercado Pago payments
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const payment = searchParams.get("payment");
    const plan = searchParams.get("plan");
    if (payment === "success" && plan) {
      setPaymentSuccessToast(`¡Suscripción Activada Extraordinariamente! Tu cuenta ha sido migrada con éxito al Plan ${plan} con Mercado Pago.`);
      // Clean up search params
      const freshUrl = window.location.pathname;
      window.history.replaceState({}, document.title, freshUrl);
      
      // Auto dismiss after 8 seconds
      const timer = setTimeout(() => {
        setPaymentSuccessToast(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Auth Operations
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login Error: ", error);
      const errCode = error?.code || "";
      const errMessage = error?.message || String(error);
      const domain = window.location.hostname;
      
      setAuthError({
        code: errCode,
        message: errMessage,
        domain: domain
      });
    }
  };

  const handleGoogleLogout = async () => {
    try {
      if (confirm("¿Estás seguro de cerrar tu sesión de Tradyum Cloud?")) {
        await signOut(auth);
      }
    } catch (error) {
      console.error("Logout Error: ", error);
    }
  };

  // Helper sync savers (writes locally if unauthenticated, Firestore handles syncing if logged in)
  const saveTradesState = (updated: Trade[]) => {
    setTrades(updated);
    localStorage.setItem("tradezella_journal_trades", JSON.stringify(updated));
  };

  const saveAccountsState = (updated: Account[]) => {
    setAccounts(updated);
    localStorage.setItem("tradezella_journal_accounts", JSON.stringify(updated));
  };

  const saveJournalState = (updated: JournalEntry[]) => {
    setJournalEntries(updated);
    localStorage.setItem("tradezella_journal_diario", JSON.stringify(updated));
  };

  // Add a newly logged Trade
  const handleAddTrade = async (newTrade: Trade) => {
    if (progressPct >= 100) {
      alert("Límite diario alcanzado — modo solo lectura activado.");
      return;
    }

    const currentPlan = userProfile.plan || "Free";
    if (currentPlan === "Free" && trades.length >= 30) {
      setUpgradeReason("limit_30");
      setUpgradeModalOpen(true);
      return;
    }

    const activeAccId = newTrade.accountId || (selectedAccountId === "all" ? (accounts[0]?.id || "fondeo") : selectedAccountId);
    const enrichedTrade: Trade = {
      ...newTrade,
      accountId: activeAccId
    };

    // 1. Optimistic UI update immediately: the trade will never vanish or briefly "delete itself"
    const updatedTrades = [enrichedTrade, ...trades];
    setTrades(updatedTrades);

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id === activeAccId) {
        return {
          ...acc,
          balance: acc.balance + enrichedTrade.netPnl
        };
      }
      return acc;
    });
    setAccounts(updatedAccounts);

    // Save local backup immediately (synchronizes with offline/cross-tabs)
    localStorage.setItem("tradezella_journal_trades", JSON.stringify(updatedTrades));
    localStorage.setItem("tradezella_journal_accounts", JSON.stringify(updatedAccounts));

    // 2. Cloud Server Sync
    if (currentUser) {
      try {
        const tradeRef = doc(db, "users", currentUser.uid, "trades", enrichedTrade.id);
        const cleanTrade = JSON.parse(JSON.stringify(enrichedTrade));
        await setDoc(tradeRef, {
          ...cleanTrade,
          updatedAt: new Date().toISOString()
        });

        // Update target account balance in DB
        const targetAcc = accounts.find((acc) => acc.id === activeAccId);
        if (targetAcc) {
          const accRef = doc(db, "users", currentUser.uid, "accounts", activeAccId);
          const cleanAccObj = JSON.parse(JSON.stringify({
            ...targetAcc,
            balance: targetAcc.balance + enrichedTrade.netPnl,
            updatedAt: new Date().toISOString()
          }));
          await setDoc(accRef, cleanAccObj);
        }
      } catch (error) {
        console.error("Firebase write trade error: ", error);
      }
    }
  };

  // Import automatic trades from CSV
  const handleImportTrades = async (
    importedTrades: Trade[],
    mode: "append" | "replace",
    targetAccId: string,
    skipDuplicates: boolean
  ) => {
    if (progressPct >= 100) {
      alert("Límite diario alcanzado — modo solo lectura activado.");
      return;
    }

    // Filter potential duplicates if requested
    let tradesToInsert = [...importedTrades];
    if (skipDuplicates) {
      tradesToInsert = tradesToInsert.filter((newTrade) => {
        return !trades.some((t) => {
          const sameAcc = t.accountId === targetAccId;
          const sameDate = t.date === newTrade.date;
          const sameSym = t.symbol.toUpperCase() === newTrade.symbol.toUpperCase();
          const samePnl = Math.abs((t.pnl || t.netPnl || 0) - (newTrade.pnl || 0)) < 0.1;
          return sameAcc && sameDate && sameSym && samePnl;
        });
      });
    }

    if (tradesToInsert.length === 0) {
      alert("No hay nuevos trades para importar (todos fueron filtrados como duplicados o ya existentes).");
      return;
    }

    // Enforce active plan trade limits (Pro / Elite vs Free)
    const currentPlan = userProfile.plan || "Free";
    if (currentPlan === "Free" && (trades.length + tradesToInsert.length) > 30) {
      setUpgradeReason("limit_30");
      setUpgradeModalOpen(true);
      alert(`Tu plan Free solo permite hasta 30 operaciones. Por favor actualizá tu plan para importar ${tradesToInsert.length} operaciones.`);
      return;
    }

    // Enrich trades with the selected target account ID
    const enriched = tradesToInsert.map(t => ({
      ...t,
      accountId: targetAccId
    }));

    let updatedTrades = [...trades];
    let updatedAccounts = [...accounts];

    if (mode === "replace") {
      // Find range of dates in imported trades
      const dates = enriched.map(t => t.date);
      const minDate = dates.reduce((min, d) => d < min ? d : min, dates[0]);
      const maxDate = dates.reduce((max, d) => d > max ? d : max, dates[0]);

      // Filter out existing trades of that account in that period
      const tradesToRemove = trades.filter(t => t.accountId === targetAccId && t.date >= minDate && t.date <= maxDate);
      
      updatedTrades = trades.filter(t => !(t.accountId === targetAccId && t.date >= minDate && t.date <= maxDate));

      const pnlToRemove = tradesToRemove.reduce((sum, t) => sum + (t.netPnl !== undefined ? t.netPnl : (t.pnl || 0)), 0);
      const pnlToAdd = enriched.reduce((sum, t) => sum + (t.netPnl !== undefined ? t.netPnl : (t.pnl || 0)), 0);

      updatedAccounts = accounts.map(acc => {
        if (acc.id === targetAccId) {
          return {
            ...acc,
            balance: acc.balance - pnlToRemove + pnlToAdd
          };
        }
        return acc;
      });

      // Sync Firestore for deletions
      if (currentUser) {
        for (const tr of tradesToRemove) {
          try {
            await deleteDoc(doc(db, "users", currentUser.uid, "trades", tr.id));
          } catch(e) {
            console.error("Error deleting old trade in replace mode: ", e);
          }
        }
      }
    } else {
      // Append mode
      const pnlToAdd = enriched.reduce((sum, t) => sum + (t.netPnl !== undefined ? t.netPnl : (t.pnl || 0)), 0);

      updatedAccounts = accounts.map(acc => {
        if (acc.id === targetAccId) {
          return {
            ...acc,
            balance: acc.balance + pnlToAdd
          };
        }
        return acc;
      });
    }

    // Concat newly imported trades
    updatedTrades = [...enriched, ...updatedTrades];

    // Save state
    setTrades(updatedTrades);
    setAccounts(updatedAccounts);
    localStorage.setItem("tradezella_journal_trades", JSON.stringify(updatedTrades));
    localStorage.setItem("tradezella_journal_accounts", JSON.stringify(updatedAccounts));

    // Upload new trades & account balance to Firestore
    if (currentUser) {
      try {
        const batchPromises = enriched.map(async (t) => {
          const tradeRef = doc(db, "users", currentUser.uid, "trades", t.id);
          const cleanTradeObj = JSON.parse(JSON.stringify(t));
          await setDoc(tradeRef, {
            ...cleanTradeObj,
            updatedAt: new Date().toISOString()
          });
        });

        // Update target account balance in firestore DB
        const targetAcc = updatedAccounts.find(acc => acc.id === targetAccId);
        if (targetAcc) {
          const accRef = doc(db, "users", currentUser.uid, "accounts", targetAccId);
          const cleanAccObj = JSON.parse(JSON.stringify({
            ...targetAcc,
            updatedAt: new Date().toISOString()
          }));
          await setDoc(accRef, cleanAccObj);
        }

        await Promise.all(batchPromises);
      } catch (error) {
        console.error("Firebase write imported trades error: ", error);
      }
    }

    alert(`¡Sincronización exitosa! Se importaron ${enriched.length} operaciones con éxito.`);
    setActiveTab("dashboard");
  };

  // Delete trade
  const handleDeleteTrade = async (id: string) => {
    const targetTrade = trades.find(t => t.id === id);
    if (!targetTrade) return;

    // 1. Optimistic UI update immediately
    const updatedTrades = trades.filter((t) => t.id !== id);
    setTrades(updatedTrades);

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id === targetTrade.accountId) {
        return {
          ...acc,
          balance: acc.balance - targetTrade.netPnl // refund account
        };
      }
      return acc;
    });
    setAccounts(updatedAccounts);

    // Save local backup immediately
    localStorage.setItem("tradezella_journal_trades", JSON.stringify(updatedTrades));
    localStorage.setItem("tradezella_journal_accounts", JSON.stringify(updatedAccounts));

    // 2. Cloud Server Sync
    if (currentUser) {
      try {
        const tradeRef = doc(db, "users", currentUser.uid, "trades", id);
        await deleteDoc(tradeRef);

        if (targetTrade.accountId) {
          const targetAcc = accounts.find((acc) => acc.id === targetTrade.accountId);
          if (targetAcc) {
            const accRef = doc(db, "users", currentUser.uid, "accounts", targetTrade.accountId);
            const cleanAccObj = JSON.parse(JSON.stringify({
              ...targetAcc,
              balance: targetAcc.balance - targetTrade.netPnl, // refund account
              updatedAt: new Date().toISOString()
            }));
            await setDoc(accRef, cleanAccObj);
          }
        }
      } catch (error) {
        console.error("Firebase delete trade error: ", error);
      }
    }

    if (selectedTrade?.id === id) {
      setSelectedTrade(null);
    }
  };

  // Replace notes retro
  const handleUpdateNotes = async (id: string, newNotes: string) => {
    const targetTrade = trades.find(t => t.id === id);
    if (!targetTrade) return;

    // 1. Optimistic state updates
    const updated = trades.map((t) => {
      if (t.id === id) {
        return { ...t, notes: newNotes };
      }
      return t;
    });
    setTrades(updated);
    localStorage.setItem("tradezella_journal_trades", JSON.stringify(updated));

    // 2. Cloud Server Sync
    if (currentUser) {
      try {
        const tradeRef = doc(db, "users", currentUser.uid, "trades", id);
        const cleanTrade = JSON.parse(JSON.stringify({
          ...targetTrade,
          notes: newNotes,
        }));
        await setDoc(tradeRef, {
          ...cleanTrade,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Firebase update notes error: ", error);
      }
    }

    if (selectedTrade?.id === id) {
      setSelectedTrade({ ...selectedTrade, notes: newNotes });
    }
  };

  // Create an Account
  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;

    const currentPlan = userProfile.plan || "Free";
    if (currentPlan !== "Elite") {
      setUpgradeReason("multi_account");
      setUpgradeModalOpen(true);
      setIsNewAccountOptionOpen(false);
      return;
    }

    const newAcc: Account = {
      id: `acc-${Date.now()}`,
      name: newAccName.trim(),
      type: newAccType,
      balance: newAccBalance,
      initialBalance: newAccBalance,
      status: "Activa"
    };

    // 1. Optimistic UI update immediately
    const updatedAccounts = [...accounts, newAcc];
    setAccounts(updatedAccounts);
    localStorage.setItem("tradezella_journal_accounts", JSON.stringify(updatedAccounts));

    // 2. Cloud Server Sync
    if (currentUser) {
      try {
        const accRef = doc(db, "users", currentUser.uid, "accounts", newAcc.id);
        const cleanAcc = JSON.parse(JSON.stringify(newAcc));
        await setDoc(accRef, {
          ...cleanAcc,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Firebase write account error: ", error);
      }
    }

    // Reset simple account trigger form
    setNewAccName("");
    setNewAccBalance(25000);
    setIsNewAccountOptionOpen(false);
  };

  // Delete Account
  const handleDeleteAccount = async (id: string) => {
    if (accounts.length <= 1) {
      alert("Debes mantener al menos una cuenta de trading activa.");
      return;
    }
    if (confirm("¿Estás seguro de eliminar esta cuenta? Se borrarán sus datos asociados.")) {
      // 1. Optimistic UI update immediately
      const updatedAccounts = accounts.filter(acc => acc.id !== id);
      setAccounts(updatedAccounts);
      localStorage.setItem("tradezella_journal_accounts", JSON.stringify(updatedAccounts));

      const updatedTrades = trades.filter((t) => t.accountId !== id);
      setTrades(updatedTrades);
      localStorage.setItem("tradezella_journal_trades", JSON.stringify(updatedTrades));

      // 2. Cloud Server Sync
      if (currentUser) {
        try {
          // Delete account doc
          const accRef = doc(db, "users", currentUser.uid, "accounts", id);
          await deleteDoc(accRef);

          // Delete all trades linked to that account to avoid orphan trades
          const linkedTrades = trades.filter((t) => t.accountId === id);
          for (const t of linkedTrades) {
            const trRef = doc(db, "users", currentUser.uid, "trades", t.id);
            await deleteDoc(trRef);
          }
        } catch (error) {
          console.error("Firebase delete account error: ", error);
        }
      }

      // clean filters
      if (selectedAccountId === id) {
        setSelectedAccountId("all");
      }
    }
  };

  // Commit dynamic Journal entry (Diario)
  const handleCreateJournalEntry = async (e: FormEvent) => {
    e.preventDefault();
    if (!newJournalTitle.trim() || !newJournalContent.trim()) return;

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const timeStr = `${today.getHours().toString().padStart(2, "0")}:${today.getMinutes().toString().padStart(2, "0")}`;

    const newEntry: JournalEntry = {
      id: `entry-${Date.now()}`,
      title: newJournalTitle.trim(),
      content: newJournalContent.trim(),
      date: dateStr,
      time: timeStr,
      associatedSymbol: newJournalSymbol.trim().toUpperCase() || undefined
    };

    // 1. Optimistic UI update immediately
    const updatedJournal = [newEntry, ...journalEntries];
    setJournalEntries(updatedJournal);
    localStorage.setItem("tradezella_journal_diario", JSON.stringify(updatedJournal));

    // 2. Cloud Server Sync
    if (currentUser) {
      try {
        const jrRef = doc(db, "users", currentUser.uid, "journalEntries", newEntry.id);
        const cleanEntry = JSON.parse(JSON.stringify({
          ...newEntry,
          associatedSymbol: newEntry.associatedSymbol || "",
        }));
        await setDoc(jrRef, {
          ...cleanEntry,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Firebase write journal error: ", error);
      }
    }

    setNewJournalTitle("");
    setNewJournalContent("");
    setNewJournalSymbol("");
    setIsNewJournalOpen(false);
  };

  // Delete journal entry (Diario)
  const handleDeleteJournalEntry = async (id: string) => {
    if (confirm("¿Eliminar esta entrada del diario?")) {
      // 1. Optimistic UI update immediately
      const updatedJournal = journalEntries.filter(entry => entry.id !== id);
      setJournalEntries(updatedJournal);
      localStorage.setItem("tradezella_journal_diario", JSON.stringify(updatedJournal));

      // 2. Cloud Server Sync
      if (currentUser) {
        try {
          const jrRef = doc(db, "users", currentUser.uid, "journalEntries", id);
          await deleteDoc(jrRef);
        } catch (error) {
          console.error("Firebase delete journal error: ", error);
        }
      }
    }
  };

  // Save Settings Profiler change
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (currentUser) {
      try {
        const userRef = doc(db, "users", currentUser.uid);
        await setDoc(userRef, {
          uid: currentUser.uid,
          name: userProfile.name,
          email: currentUser.email || "",
          updatedAt: new Date().toISOString()
        });
        alert("¡Perfil guardado en la Nube correctamente!");
      } catch (error) {
        console.error("Error updating user document: ", error);
      }
    } else {
      localStorage.setItem("tradezella_journal_perfil", JSON.stringify(userProfile));
      alert("¡Perfil guardado localmente correctamente!");
    }
  };

  const handleExportCSV = () => {
    const plan = userProfile.plan || "Free";
    if (plan === "Free") {
      setUpgradeReason("export");
      setUpgradeModalOpen(true);
      return;
    }

    // Convert trades to beautiful CSV rows
    const headers = ["ID", "Simbolo", "Accion", "Cantidad", "Precio Entrada", "Precio Salida", "P&L Neto", "Fecha", "Hora", "Notas", "Setups", "Errores"];
    const csvRows = [headers.join(",")];

    trades.forEach((t) => {
      const row = [
        t.id,
        t.symbol,
        t.action,
        t.quantity,
        t.entryPrice,
        t.exitPrice || "",
        t.netPnl,
        t.date,
        t.time || "",
        `"${(t.notes || "").replace(/"/g, '""')}"`,
        `"${(t.setups || []).join(";")}"`,
        `"${(t.mistakes || []).join(";")}"`
      ];
      csvRows.push(row.join(","));
    });

    const csvBlob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `tradyum_journal_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Restore factory defaults
  const handleResetApplicationData = async () => {
    if (confirm("Esto restablecerá todas las cuentas y operaciones a los datos originales de ejemplo. ¿Proceder?")) {
      if (currentUser) {
        try {
          const userId = currentUser.uid;
          await seedCloudData(userId, [], [], []);
          alert("¡Se han restablecido los datos en la Nube con los valores de muestra!");
        } catch (error) {
          console.error("Error resetting applet data cloud: ", error);
        }
      } else {
        localStorage.removeItem("tradezella_journal_trades");
        localStorage.removeItem("tradezella_journal_accounts");
        localStorage.removeItem("tradezella_journal_diario");
        localStorage.removeItem("tradezella_journal_perfil");

        setTrades(INITIAL_TRADES.map((t, idx) => ({ ...t, accountId: idx % 2 === 0 ? "fondeo" : "demo" })));
        setAccounts(getDefaultAccounts());
        setJournalEntries([]);
        setUserProfile({
          name: "Invitado",
          email: ""
        });
        setSelectedAccountId("all");
        setSelectedDate(null);
      }
    }
  };

  // 1. Dynamic filtering based on active dropdown account
  const tradesFilteredByAccount = useMemo(() => {
    if (selectedAccountId === "all") {
      return trades;
    }
    return trades.filter(t => t.accountId === selectedAccountId);
  }, [trades, selectedAccountId]);

  // Accounts summary calculations for "Cuentas" tab
  const totalBalanceSum = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [accounts]);

  const activeAccountsCount = useMemo(() => {
    return accounts.filter(acc => acc.status === "Activa").length;
  }, [accounts]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#08090b] text-[#f1f5f9] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div>
        <p className="text-xs text-slate-400 font-mono animate-pulse">Iniciando Tradyum Cloud...</p>
      </div>
    );
  }

  if (!currentUser && !isOfflineMode) {
    return (
      <div className="min-h-screen bg-[#08090b] text-[#f1f5f9] flex items-center justify-center p-4 selection:bg-blue-500/30 selection:text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.04),transparent_65%)] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-[#111317] border border-white/5 rounded-2xl p-7 md:p-8 space-y-8 shadow-2xl shadow-black/80 relative overflow-hidden"
        >
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#2563eb]/5 rounded-full filter blur-xl -mr-16 -mt-16 pointer-events-none" />

          {/* Logo with central focus */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-20 h-20 bg-slate-950/40 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner">
              <CompassLogo className="w-15 h-15" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight font-display">Tradyum</h2>
              <p className="text-xs text-slate-400 font-medium font-sans">Sincronización en tiempo real (Web & Móvil)</p>
            </div>
          </div>

          {/* Core Feature bullet cards */}
          <div className="space-y-4 pt-1">
            <div className="flex items-start gap-3 bg-white/2 p-3.5 rounded-xl border border-white/5">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-[#38bdf8] shrink-0 mt-0.5">
                <CloudLightning className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-slate-300 font-display">Sincronización Instantánea</h4>
                <p className="text-[10.5px] text-slate-500 leading-normal mt-0.5">
                  Tus trades, cuentas y notas se replican al instante entre tu PC y tu teléfono móvil.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/2 p-3.5 rounded-xl border border-white/5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-slate-300 font-display">Base de Datos Firestore</h4>
                <p className="text-[10.5px] text-slate-500 leading-normal mt-0.5">
                  Conexión segura y persistente en la nube protegida con reglas de seguridad estrictas.
                </p>
              </div>
            </div>
          </div>

          {/* Social Sign-In Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-[#2563eb] hover:bg-blue-600 active:scale-[0.99] text-white font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 cursor-pointer"
            >
              {/* Inline SVG for Google logo */}
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.24 10.285V13.4H19.127C18.852 14.965 17.247 18.004 12.24 18.004C7.91 18.004 4.374 14.427 4.374 10.03C4.374 5.632 7.91 2.055 12.24 2.055C14.7 2.055 16.345 3.08 17.287 3.981L19.714 1.647C17.955 0.003 15.34 -1.189 12.24 -1.189C6.033 -1.189 1 3.844 1 10.051S6.033 21.291 12.24 21.291C18.718 21.291 23.033 16.754 23.033 10.305C23.033 9.56 22.955 8.985 22.857 8.591L12.24 8.576V10.285Z"/>
              </svg>
              Iniciar sesión con Google
            </button>

            <button
              onClick={() => setIsOfflineMode(true)}
              className="w-full bg-slate-950 hover:bg-slate-900 border border-white/5 hover:border-white/10 text-slate-400 hover:text-slate-300 font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              Explorar en Modo Invitado (Offline)
            </button>
          </div>

          <div className="text-center text-[10px] text-slate-600 font-mono">
            Tradyum vc2.4 • Transacciones seguras y encriptadas
          </div>
        </motion.div>
      </div>
    );
  }

  if (window.location.pathname === "/checkout-simulation") {
    return <CheckoutSimulator />;
  }

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f1f5f9] font-sans antialiased flex flex-col md:flex-row overflow-x-hidden">
      
      {/* Mobile Top Header Banner (Highly Polished) */}
      <div className="md:hidden flex items-center justify-between px-5 py-3.5 bg-[#12111a] border-b border-white/5 sticky top-0 z-30 shadow-md shadow-black/30">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-slate-950/40 rounded-xl flex items-center justify-center border border-white/5 shadow-inner">
            <CompassLogo className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xs font-black text-white tracking-widest font-display uppercase">Tradyum</h2>
            <p className="text-[9px] text-slate-500 font-bold font-mono uppercase tracking-widest">Cloud Journal</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Cuentas Quick Toggle */}
          <button 
            onClick={() => {
              if (activeTab === "cuentas") {
                setActiveTab("dashboard");
              } else {
                setActiveTab("cuentas");
              }
            }}
            className={`p-1.5 rounded-lg transition-all border ${
              activeTab === "cuentas" 
                ? "bg-white/10 text-white border-white/10" 
                : "bg-slate-900 text-slate-400 border-white/5 hover:bg-white/5"
            }`}
            title="Cuentas"
          >
            <Wallet className="w-4 h-4 text-xs" />
          </button>

          {/* Profile Quick Toggle */}
          <button 
            onClick={() => {
              if (activeTab === "configuracion") {
                setActiveTab("dashboard");
              } else {
                setActiveTab("configuracion");
              }
            }}
            className={`relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs font-mono transition-all border ${
              activeTab === "configuracion" 
                ? "border-indigo-400 bg-indigo-500/10 text-[#a78bfa]" 
                : "border-white/10 bg-slate-900 text-slate-300"
            }`}
            title="Perfil / Ajustes"
          >
            {userProfile.name.charAt(0).toUpperCase()}
            {currentUser && (
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-[#111317]"></span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* 1. PERSISTENT LEFT SIDEBAR                */}
      {/* ========================================== */}
      <aside className="hidden md:flex md:w-64 bg-[#12111a] border-r border-white/5 flex-col justify-between shrink-0 z-40">
        
        <div>
          {/* Top Logo Banner without blue block background - aligned to screen 2 */}
          <div className="p-6 flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-950/40 rounded-xl flex items-center justify-center border border-white/5 shadow-inner">
              <CompassLogo className="w-9 h-9" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-white font-black text-sm uppercase tracking-wider font-display">
                Tradyum
              </span>
              <span className="text-[9px] text-slate-500 font-bold font-mono uppercase tracking-widest mt-0.5">
                Cloud Journal
              </span>
            </div>
          </div>
 
          {/* Navigation Section */}
          <div className="px-4 py-2">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-4.5 pl-3.5">
              NAVEGACIÓN
            </span>
 
            <nav className="space-y-1.5 block">
              {/* Option 1: Dashboard */}
              <button
                onClick={() => {
                  setActiveTab("dashboard");
                  setSelectedDate(null);
                }}
                className={`w-full flex items-center gap-3.5 px-4.5 py-3 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-[#211d33] text-indigo-300 shadow-sm border border-indigo-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/2"
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${activeTab === "dashboard" ? "text-indigo-400" : "text-slate-400"}`} />
                Dashboard
              </button>
 
              {/* Option 2: Operaciones */}
              <button
                onClick={() => setActiveTab("operaciones")}
                className={`w-full flex items-center gap-3.5 px-4.5 py-3 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === "operaciones"
                    ? "bg-[#211d33] text-indigo-300 shadow-sm border border-indigo-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/2"
                }`}
              >
                <TrendingUp className={`w-4 h-4 ${activeTab === "operaciones" ? "text-indigo-400" : "text-slate-400"}`} />
                Operaciones
              </button>
 
              {/* Option 3: Calendario */}
              <button
                onClick={() => {
                  setActiveTab("calendario");
                  setSelectedDate(null);
                }}
                className={`w-full flex items-center gap-3.5 px-4.5 py-3 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === "calendario"
                    ? "bg-[#211d33] text-indigo-300 shadow-sm border border-indigo-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/2"
                }`}
              >
                <CalendarIcon className={`w-4 h-4 ${activeTab === "calendario" ? "text-indigo-400" : "text-slate-400"}`} />
                Calendario
              </button>
 
              {/* Option 5: Cuentas */}
              <button
                onClick={() => setActiveTab("cuentas")}
                className={`w-full flex items-center gap-3.5 px-4.5 py-3 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === "cuentas"
                    ? "bg-[#211d33] text-indigo-300 shadow-sm border border-indigo-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/2"
                }`}
              >
                <Wallet className={`w-4 h-4 ${activeTab === "cuentas" ? "text-indigo-400" : "text-slate-400"}`} />
                Cuentas
              </button>
 
              {/* Option: Importar Trades */}
              <button
                onClick={() => setActiveTab("importar")}
                className={`w-full flex items-center gap-3.5 px-4.5 py-3 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === "importar"
                    ? "bg-[#211d33] text-indigo-300 shadow-sm border border-indigo-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/2"
                }`}
              >
                <Upload className={`w-4 h-4 ${activeTab === "importar" ? "text-indigo-400" : "text-slate-400"}`} />
                Importar Trades
              </button>
 
              {/* Option 5: config */}
              <button
                onClick={() => setActiveTab("configuracion")}
                className={`w-full flex items-center gap-3.5 px-4.5 py-3 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === "configuracion"
                    ? "bg-[#211d33] text-indigo-300 shadow-sm border border-indigo-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/2"
                }`}
              >
                <Settings className={`w-4 h-4 ${activeTab === "configuracion" ? "text-indigo-400" : "text-slate-400"}`} />
                Configuración
              </button>

              {/* Option 6: Planes Premium */}
              <button
                onClick={() => setActiveTab("planes")}
                className={`w-full flex items-center justify-between px-4.5 py-3 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === "planes"
                    ? "bg-[#211d33] text-indigo-300 shadow-sm border border-indigo-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/2"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Sparkles className={`w-4 h-4 ${activeTab === "planes" ? "text-indigo-400" : "text-amber-400"}`} />
                  <span>Planes Premium</span>
                </div>
                {userProfile.plan === "Free" && (
                  <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">PRO</span>
                )}
              </button>
            </nav>
          </div>
        </div>
 
        {/* Sidebar Footer: Profile info */}
        <div className="p-4 border-t border-white/5 flex flex-col gap-3 bg-[#0d0a14]/60">
          {currentUser ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold font-mono text-xs text-white">
                  {userProfile.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white truncate">{userProfile.name}</span>
                  <span className="text-[9px] text-emerald-400 font-bold font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> SYNC ACTIVADO
                  </span>
                </div>
              </div>
              <button 
                onClick={handleGoogleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold font-mono text-xs text-slate-400">
                  {userProfile.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-400 truncate">Modo Invitado</span>
                  <span className="text-[9px] text-amber-500 font-bold font-mono">OFFLINE ONLY</span>
                </div>
              </div>
              <button
                onClick={handleGoogleLogin}
                className="w-full bg-[#2563eb] hover:bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <CloudLightning className="w-3.5 h-3.5" /> Sincronizar Google
              </button>
            </div>
          )}
        </div>
 
      </aside>

      {/* ========================================== */}
      {/* 2. MAIN HUB INTERACTION AND WINDOWS        */}
      {/* ========================================== */}
      <main className="flex-1 p-4 md:p-7 pb-24 md:pb-7 space-y-6 max-w-7xl mx-auto w-full flex flex-col justify-between">
        
        {/* Banner de bloqueo por límite alcanzado en toda la pantalla / viewport */}
        {progressPct >= 100 && (
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-4.5 rounded-xl font-semibold flex flex-col md:flex-row items-center justify-between text-center md:text-left gap-4 shadow-xl border border-rose-500 animate-in fade-in slide-in-from-top-4 duration-300" id="lockout-hud-banner">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl text-white animate-bounce shrink-0">
                <Lock className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-extrabold tracking-tight md:text-base font-display">
                  Límite diario alcanzado — modo solo lectura activado
                </h3>
                <p className="text-[11px] md:text-xs text-rose-100 font-medium mt-0.5">
                  Protegiste tu cuenta hoy. Volvé mañana con la mente fresca.
                </p>
              </div>
            </div>
            <div className="text-xs font-mono bg-black/45 border border-white/10 px-3.5 py-2 rounded-lg shrink-0 flex items-center gap-2">
              <span className="w-2 h-2 bg-rose-400 rounded-full animate-ping"></span>
              Hoy: <span className="font-extrabold">{todayPnl < 0 ? `-$${Math.abs(todayPnl).toFixed(2)}` : `$${todayPnl.toFixed(2)}`}</span> <span className="text-white/20">|</span> Límite: -${Math.abs(dailyLossLimit).toFixed(2)}
            </div>
          </div>
        )}
        
        <div>
          {/* ========================================== */}
          {/* TAB 1: DASHBOARD VIEW CONTENT             */}
          {/* ========================================== */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-200" id="view-dashboard">
              
              {/* Dashboard Hero Header exactly like Screenshot 1 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
                    Dashboard de Trading
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Resumen de tu rendimiento y operaciones
                  </p>
                </div>

                {/* Accounts Wallet Selector */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-slate-500">
                      <Wallet className="w-4 h-4" />
                    </span>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="bg-[#111317] border border-white/10 text-xs text-slate-200 rounded-lg pl-8 pr-8 py-1.5 focus:outline-none focus:border-[#2563eb] cursor-pointer appearance-none min-w-[160px]"
                    >
                      <option value="all">Todas las Cuentas</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    disabled={progressPct >= 100}
                    onClick={() => {
                      if (progressPct >= 100) return;
                      setIsAddOpen(true);
                    }}
                    className={`font-semibold text-xs py-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-all ${
                      progressPct >= 100
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5 shadow-none"
                        : "bg-[#2563eb] hover:bg-blue-700 active:scale-95 text-white shadow-lg shadow-blue-500/10 cursor-pointer"
                    }`}
                    title={progressPct >= 100 ? "Límite diario alcanzado — Operaciones bloqueadas" : "Registrar operación"}
                  >
                    <Plus className="w-4 h-4" /> Log Trade Record
                  </button>
                </div>
              </div>

              {/* Control de riesgo diario */}
              <div className="bg-[#1e152d] border border-white/5 rounded-xl p-5" id="daily-risk-card">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left branding, description & input */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-[#2563eb]/10 text-[#2563eb]">
                          <AlertCircle className="w-4 h-4" />
                        </span>
                        <h3 className="text-sm font-bold text-white font-display">Control de riesgo diario</h3>
                      </div>
                      <p className="text-[11px] text-[#ccc3db] mt-0.5">
                        Protección de fondos contra overtrading y pérdida máxima
                      </p>
                    </div>
                    
                    {/* Input container */}
                    <div className="flex items-center gap-2 bg-[#130f22]/60 px-3 py-1.5 rounded-lg border border-white/5">
                      <span className="text-xs text-slate-400 font-medium">Límite Diario:</span>
                      <div className="flex items-center gap-0.5 bg-slate-950/50 border border-white/10 px-2.5 py-0.5 rounded-md">
                        <span className="text-rose-400 font-mono text-xs font-semibold">-$</span>
                        <input 
                          type="number"
                          min="0"
                          value={dailyLossLimit === 0 ? "" : Math.abs(dailyLossLimit)}
                          onChange={(e) => {
                            const num = parseFloat(e.target.value);
                            const finalVal = isNaN(num) ? 0 : -Math.abs(num);
                            setDailyLossLimit(finalVal);
                            localStorage.setItem("tradyum_daily_loss_limit", String(finalVal));
                          }}
                          className="bg-transparent text-white text-xs font-mono font-bold focus:outline-none w-14"
                          placeholder="200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: progress, today's status & values */}
                  <div className="flex-1 max-w-md w-full space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">
                        {todayTrades.length === 0 ? (
                          <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Sin operaciones hoy — límite intacto
                          </span>
                        ) : (
                          <span className="text-slate-300">
                            Pérdida hoy: <span className={`font-mono font-bold ${todayPnl < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                              {todayPnl < 0 ? `-$${Math.abs(todayPnl).toFixed(2)}` : `$${todayPnl.toFixed(2)}`}
                            </span>
                            <span className="text-slate-500 mx-1.5">/</span>
                            Límite: <span className="font-mono text-slate-400">-${Math.abs(dailyLossLimit).toFixed(2)}</span>
                          </span>
                        )}
                      </span>
                      
                      {/* Status indicator */}
                      <div>
                        {(() => {
                          if (progressPct >= 100) {
                            return (
                              <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest font-mono uppercase animate-pulse">
                                BLOQUEADO
                              </span>
                            );
                          } else if (progressPct > 80) {
                            return (
                              <span className="bg-red-500/20 text-red-500 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest font-mono uppercase">
                                ROJO
                              </span>
                            );
                          } else if (progressPct >= 50) {
                            return (
                              <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest font-mono uppercase">
                                AMARILLO
                              </span>
                            );
                          } else {
                            return (
                              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest font-mono uppercase">
                                VERDE
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>

                    {/* Colorful progress bar */}
                    <div className="w-full bg-slate-950/60 rounded-full h-2.5 overflow-hidden p-[1.5px] border border-white/5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          progressPct >= 100 
                            ? "bg-rose-600 animate-pulse shadow-[0_0_12px_rgba(225,29,72,0.4)]"
                            : progressPct > 80
                            ? "bg-rose-550 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                            : progressPct >= 50
                            ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                            : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Displaying 4 cards metrics (Spanish formatted labels) */}
              <DashboardStats trades={tradesFilteredByAccount} />

              {/* Double Visual Layout: Balance Chart & Rapid summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Left area: Performance Charts (contains Equity Curve and Stats side-by-side) */}
                <div className="lg:col-span-9" id="dashboard-charts-container">
                  <PerformanceCharts 
                    trades={tradesFilteredByAccount} 
                    userPlan={userProfile.plan} 
                    onUpgradeClick={() => {
                      setUpgradeReason("stats");
                      setUpgradeModalOpen(true);
                    }}
                  />
                </div>

                {/* Right area: Resumen Rápido identical to Screenshot 1 */}
                <div className="lg:col-span-3 bg-[#1e152d] border border-white/5 rounded-xl p-5 flex flex-col justify-between h-[360px]" id="instant-metrics-plate">
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">Resumen Rápido</h3>
                    <p className="text-[11px] text-[#ccc3db] mt-0.5">Ratios de volumen en el mes activo</p>
                  </div>

                  {/* Resumen rows stacked pills exactly like Screenshot 1 colors */}
                  <div className="space-y-2 mt-4 flex-1 flex flex-col justify-center">
                    
                    {/* Row 1: Total de Operaciones */}
                    <div className="bg-[#130f22]/60 p-2.5 px-3.5 rounded-lg border border-white/5 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">Total de Operaciones</span>
                      <span className="font-mono text-white text-sm font-bold">{tradesFilteredByAccount.length}</span>
                    </div>

                    {/* Row 2: Operaciones Abiertas (blank exit code or calculated placeholder) */}
                    <div className="bg-[#130f22]/60 p-2.5 px-3.5 rounded-lg border border-white/5 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">Operaciones Abiertas</span>
                      <span className="font-mono text-slate-400 text-sm">0</span>
                    </div>

                    {/* Row 3: Operaciones Cerradas (matching all total count) */}
                    <div className="bg-[#130f22]/60 p-2.5 px-3.5 rounded-lg border border-white/5 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">Operaciones Cerradas</span>
                      <span className="font-mono text-white text-sm font-bold">{tradesFilteredByAccount.length}</span>
                    </div>

                    {/* Row 4: Trades Ganadores (Green badge indicators) */}
                    <div className="bg-[#10b981]/10 p-2.5 px-3.5 rounded-lg border border-emerald-500/10 flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#10b981] font-bold">Trades Ganadores</span>
                      <span className="font-mono text-[#10b981] text-sm font-bold">
                        {tradesFilteredByAccount.filter(t => t.status === "Win").length}
                      </span>
                    </div>

                    {/* Row 5: Trades Perdedores (Red badge indicators) */}
                    <div className="bg-[#f43f5e]/10 p-2.5 px-3.5 rounded-lg border border-rose-500/10 flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#f43f5e] font-bold">Trades Perdedores</span>
                      <span className="font-mono text-[#f43f5e] text-sm font-bold">
                        {tradesFilteredByAccount.filter(t => t.status === "Loss").length}
                      </span>
                    </div>

                  </div>
                </div>

              </div>

              {/* Botton Area: Operaciones Recientes matching column lists from Screenshot 1 */}
              <div className="bg-[#1e152d] border border-white/5 rounded-xl p-5" id="recientes-table-box">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">Operaciones Recientes</h3>
                    <p className="text-[11px] text-slate-500">Historial de las últimas ejecuciones registradas</p>
                  </div>
                  <button
                    onClick={() => setActiveTab("operaciones")}
                    className="text-xs font-bold text-[#2563eb] hover:text-blue-400 transition-colors"
                  >
                    Ver todas las operaciones &rarr;
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg bg-slate-950/25 border border-white/5">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#14161c] border-b border-white/5 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                      <tr>
                        <th className="px-4 py-3">Símbolo</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Entrada</th>
                        <th className="px-4 py-3">Salida</th>
                        <th className="px-4 py-3">P&L</th>
                        <th className="px-4 py-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tradesFilteredByAccount.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            No hay operaciones registradas en esta cuenta. Loguea una nueva operación con el botón superior.
                          </td>
                        </tr>
                      ) : (
                        tradesFilteredByAccount.slice(0, 5).map(t => {
                          const isSuccess = t.netPnl >= 0;
                          return (
                            <tr key={t.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3.5 font-bold text-white font-mono">{t.symbol}</td>
                              <td className="px-4 py-3.5">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                                  t.action === "Buy" ? "bg-blue-500/10 text-blue-400" : "bg-rose-500/10 text-rose-400"
                                }`}>
                                  {t.action === "Buy" ? "Long" : "Short"}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 font-mono">${t.entryPrice.toFixed(2)}</td>
                              <td className="px-4 py-3.5 font-mono">${t.exitPrice.toFixed(2)}</td>
                              <td className={`px-4 py-3.5 font-mono font-bold ${isSuccess ? "text-emerald-400" : "text-rose-400"}`}>
                                {isSuccess ? "▲" : "▼"} {isSuccess ? "+" : ""}${t.netPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <span className="bg-[#08090b] text-xs font-semibold px-2.5 py-0.5 rounded-full border border-white/10 text-slate-300">
                                  Cerrada
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trade Coach Advice */}
              <TradeCoach 
                trades={tradesFilteredByAccount} 
                userPlan={userProfile.plan} 
                onUpgradeClick={() => {
                  setUpgradeReason("ai_coach");
                  setUpgradeModalOpen(true);
                }}
              />

            </div>
          )}

          {/* ========================================== */}
          {/* TAB 2: OPERACIONES VIEW LIST               */}
          {/* ========================================== */}
          {activeTab === "operaciones" && (
            <div className="space-y-6 animate-in fade-in duration-200" id="view-operaciones">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
                    Mis Operaciones
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gestiona y analiza tus trades
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportCSV}
                    className="bg-[#1e152d] hover:bg-[#130f22] text-slate-300 border border-white/5 font-semibold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderDot className="w-4 h-4 text-indigo-400" /> Exportar CSV
                  </button>
                  <button
                    disabled={progressPct >= 100}
                    onClick={() => {
                      if (progressPct >= 100) return;
                      setIsAddOpen(true);
                    }}
                    className={`font-semibold text-xs py-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-all ${
                      progressPct >= 100
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5 shadow-none"
                        : "bg-[#2563eb] hover:bg-blue-700 text-white cursor-pointer"
                    }`}
                    title={progressPct >= 100 ? "Límite diario alcanzado" : "Nueva Operación"}
                  >
                    <Plus className="w-4 h-4" /> Nueva Operación
                  </button>
                </div>
              </div>

              {/* Full Interactive Trades Column List identically matching Screenshot 6 */}
              <div className="bg-[#111317] border border-white/5 rounded-xl p-5 space-y-4">
                <div className="overflow-x-auto rounded-lg bg-slate-950/25 border border-white/5">
                  <table className="w-full text-left text-xs text-[#cbd5e1]">
                    <thead className="bg-[#14161c] border-b border-white/5 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                      <tr>
                        <th className="px-5 py-3">Símbolo</th>
                        <th className="px-5 py-3">Tipo</th>
                        <th className="px-5 py-3">Mercado</th>
                        <th className="px-5 py-3">Cantidad</th>
                        <th className="px-5 py-3">P&L</th>
                        <th className="px-5 py-3">Imagen</th>
                        <th className="px-5 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {trades.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                            Estás en cero operaciones. Registra una nueva transacción haciendo clic arriba.
                          </td>
                        </tr>
                      ) : (
                        trades.map(t => {
                          const isWin = t.netPnl >= 0;
                          return (
                            <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                              <td className="px-5 py-4 font-bold text-white font-mono text-sm">{t.symbol}</td>
                              <td className="px-5 py-4">
                                <span className={`px-2.5 py-0.5 rounded text-[9px] font-mono font-extrabold ${
                                  t.action === "Buy" ? "bg-blue-500/10 text-blue-400" : "bg-rose-500/10 text-rose-400"
                                }`}>
                                  {t.action === "Buy" ? "Long" : "Short"}
                                </span>
                              </td>
                              <td className="px-5 py-4 font-medium text-slate-300">{t.assetType}s</td>
                              <td className="px-5 py-4 font-mono font-medium text-slate-400">{t.quantity}</td>
                              <td className={`px-5 py-4 font-mono font-extrabold ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                                {isWin ? "+" : ""}${t.netPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-5 py-4">
                                {t.screenshot ? (
                                  <div 
                                    onClick={() => setSelectedTrade(t)}
                                    className="w-7 h-7 rounded border border-white/10 overflow-hidden cursor-pointer hover:border-indigo-400 transition-all flex items-center justify-center bg-[#0d0e12]" 
                                    title="Ver captura de pantalla"
                                  >
                                    <img 
                                      src={t.screenshot} 
                                      alt="mini" 
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                ) : (
                                  <div 
                                    onClick={() => setSelectedTrade(t)}
                                    className="p-1.5 rounded bg-white/5 inline-block text-slate-500 hover:text-white cursor-pointer text-xs" 
                                    title="Ver detalles de la operación"
                                  >
                                    📊
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setSelectedTrade(t)}
                                    className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
                                    title="Inspeccionar"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTrade(t.id)}
                                    className="p-1.5 rounded bg-rose-500/10 border border-rose-500/15 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================== */}
          {/* TAB 3: CALENDARIO VIEW                     */}
          {/* ========================================== */}
          {activeTab === "calendario" && (
            <div className="space-y-6 animate-in fade-in duration-200" id="view-calendario">
              <CalendarView
                trades={trades}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
          )}

          {/* Diario section removed by user request */}

          {/* ========================================== */}
          {/* TAB 5: MIS CUENTAS VIEW                    */}
          {/* ========================================== */}
          {activeTab === "cuentas" && (
            <div className="space-y-6 animate-in fade-in duration-200" id="view-cuentas">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
                    Mis Cuentas
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gestiona tus cuentas de trading y limites de fondos
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsNewAccountOptionOpen(!isNewAccountOptionOpen)}
                    className="bg-[#2563eb] hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs py-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Nueva Cuenta
                  </button>
                </div>
              </div>

              {/* Dynamic trigger popup / panel for new accounts creation precisely matching image 3 */}
              {isNewAccountOptionOpen && (
                <form 
                  onSubmit={handleCreateAccount} 
                  className="bg-[#111317] border border-white/10 rounded-xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-150"
                >
                  <h3 className="text-sm font-bold text-white font-display">Registrar Cuenta Nueva</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1 block">Nombre de la Cuenta</label>
                      <input
                        type="text"
                        value={newAccName}
                        placeholder="Ej. Fondeo Apex, Real IBKR, DEMO"
                        onChange={(e) => setNewAccName(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#2563eb]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1 block">Balance Inicial ($)</label>
                      <input
                        type="number"
                        min="0"
                        value={newAccBalance}
                        onChange={(e) => setNewAccBalance(Number(e.target.value))}
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#2563eb] font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1 block">Tipo de Cuenta</label>
                      <select
                        value={newAccType}
                        onChange={(e) => setNewAccType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#2563eb]"
                      >
                        <option value="Fondeo">Fondeo (Apex, Earn2Trade)</option>
                        <option value="Demo">Demo (Simulado)</option>
                        <option value="Real">Real (Capital Personal)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsNewAccountOptionOpen(false)}
                      className="px-3.5 py-1.5 text-xs text-slate-400 bg-transparent hover:text-white rounded-lg transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-[#2563eb] hover:bg-blue-700 rounded-lg cursor-pointer"
                    >
                      Crear Cuenta
                    </button>
                  </div>
                </form>
              )}

              {/* Cuentas Top summary widget block (Spanish - identical to Screenshot 3 layout) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                
                {/* Metric 1: Balance Total */}
                <div className="bg-[#111317] border border-white/5 p-4 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Balance Total</span>
                    <span className="text-xl font-mono font-bold text-emerald-400 block">${totalBalanceSum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="w-10 h-10 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    $
                  </div>
                </div>

                {/* Metric 2: Total Cuentas */}
                <div className="bg-[#111317] border border-white/5 p-4 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Cuentas</span>
                    <span className="text-xl font-mono font-bold text-[#38bdf8] block">{accounts.length}</span>
                  </div>
                  <div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center text-[#38bdf8]">
                    💼
                  </div>
                </div>

                {/* Metric 3: Cuentas Activas */}
                <div className="bg-[#111317] border border-white/5 p-4 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Cuentas Activas</span>
                    <span className="text-xl font-mono font-bold text-blue-400 block">{activeAccountsCount}</span>
                  </div>
                  <div className="w-10 h-10 rounded bg-[#2563eb]/10 flex items-center justify-center text-[#2563eb]">
                    📈
                  </div>
                </div>

              </div>

              {/* Dynamic accounts list cards grid precisely matching Screenshot 3 styling with added Metrics Dashboards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {accounts.map(acc => {
                  // Calculate specific account trade statistics
                  const accTrades = trades.filter(t => t.accountId === acc.id);
                  const accPnl = accTrades.reduce((s, curr) => s + curr.netPnl, 0);
                  const pnlPercent = acc.initialBalance > 0 ? (accPnl / acc.initialBalance) * 100 : 0;
                  const isExpanded = expandedAccountDashboardId === acc.id;

                  return (
                    <div 
                      key={acc.id} 
                      className={`bg-[#111317] border border-white/5 rounded-xl overflow-hidden shadow-lg transition-all duration-300 ${
                        isExpanded ? "md:col-span-2 border-indigo-500/20 shadow-indigo-950/20 shadow-2xl" : "hover:scale-[1.002]"
                      }`}
                    >
                      {/* Card Header name and action triggers */}
                      <div className="p-4 bg-slate-950/25 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold font-display text-sm">{acc.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                            acc.type === "Fondeo" ? "bg-amber-500/10 text-amber-400" : acc.type === "Demo" ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {acc.type}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedAccountDashboardId(isExpanded ? null : acc.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                              isExpanded 
                                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" 
                                : "bg-slate-900 text-slate-400 border-white/5 hover:border-white/10 hover:text-white"
                            }`}
                            title="Ver Dashboard de Métricas"
                          >
                            <LayoutDashboard className="w-3.5 h-3.5" />
                            {isExpanded ? "Ocultar Dashboard" : "Ver Dashboard"}
                          </button>

                          <button
                            onClick={() => handleDeleteAccount(acc.id)}
                            className="bg-slate-900 border border-white/5 text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:border-rose-500/10 transition-colors cursor-pointer"
                            title="Eliminar Cuenta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Card Balance Stats block matching Screenshot 3 exactly */}
                      <div className="p-5 space-y-4">
                        
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Balance Actual</span>
                          <span className="text-xl font-mono font-bold text-white block mt-0.5">${(acc.initialBalance + accPnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </div>

                        {/* Balance rows detail stack */}
                        <div className="space-y-2 border-t border-white/5 pt-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Balance Inicial</span>
                            <span className="font-mono text-slate-300 font-semibold">${acc.initialBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">P&L</span>
                            <span className={`font-mono font-extrabold ${accPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {accPnl >= 0 ? "+" : ""}${accPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({accPnl >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%)
                            </span>
                          </div>
                        </div>

                        {/* Active state tag */}
                        <div className="pt-2 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Activa
                          </span>

                          <span className="text-[10px] text-slate-500 font-mono">
                            {accTrades.length} operaciones registradas
                          </span>
                        </div>

                        {/* Dedicated Dashboard Section inside Account Card if expanded */}
                        {isExpanded && (
                          <div className="border-t border-white/5 pt-5 mt-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest font-display flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                                  Métricas de Rendimiento: {acc.name}
                                </h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">Métricas dinámicas calculadas exclusivamente para esta cuenta</p>
                              </div>
                            </div>

                            {/* Render stats summary cards */}
                            <div className="p-1 px-1 bg-[#090a0d]/60 rounded-xl border border-white/5">
                              <DashboardStats trades={accTrades} />
                            </div>

                            {/* Render advanced charts & setups/mistakes diagnostics */}
                            <div className="p-1 px-1 bg-[#090a0d]/60 rounded-xl border border-white/5">
                              <PerformanceCharts 
                                trades={accTrades} 
                                userPlan={userProfile.plan} 
                                onUpgradeClick={() => {
                                  setUpgradeReason("stats");
                                  setUpgradeModalOpen(true);
                                }}
                              />
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ========================================== */}
          {/* TAB 6: CONFIGURACION VIEW                  */}
          {/* ========================================== */}
          {activeTab === "configuracion" && (
            <div className="space-y-6 animate-in fade-in duration-200" id="view-configuracion">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
                    Configuración
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Administra tu perfil y preferencias
                  </p>
                </div>
              </div>

              {/* Form card precisely matching values inside Screenshot 2 */}
              <div className="max-w-xl mx-auto bg-[#111317] border border-white/5 rounded-xl overflow-hidden shadow-xl mt-4">
                
                {/* Header Profile Badge */}
                <div className="p-4 bg-slate-950/25 border-b border-white/5 flex items-center gap-3">
                  <div className="p-2 rounded bg-blue-600/10 text-blue-400">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">Perfil</h3>
                    <p className="text-[11px] text-slate-500">Actualiza tu información personal</p>
                  </div>
                </div>

                {/* Form fields identical to Screenshot 2 layout */}
                <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
                  
                  {/* Email row field (Disabled exactly like visual) */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block font-display">Email</label>
                    <input
                      type="email"
                      value={userProfile.email}
                      disabled
                      className="w-full bg-slate-900 border border-transparent rounded-lg p-2.5 text-xs text-slate-500 cursor-not-allowed font-sans select-none"
                    />
                    <span className="text-[10px] text-slate-500 font-medium block pt-0.5 text-slate-500 leading-none">
                      El email no se puede modificar
                    </span>
                  </div>

                  {/* Complete Name field (Editable) */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block font-display">Nombre Completo</label>
                    <input
                      type="text"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                      required
                      placeholder="Escribe tu nombre"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#2563eb] font-sans"
                    />
                  </div>

                  {/* Actions buttons */}
                  <div className="flex justify-between items-center pt-3 border-t border-white/5">
                    <button
                      type="button"
                      onClick={handleResetApplicationData}
                      className="px-3.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold bg-transparent hover:bg-rose-950/10 rounded-lg transition-colors cursor-pointer border border-rose-500/10"
                    >
                      Restablecer Datos de Muestra
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-[#2563eb] hover:bg-blue-700 rounded-lg shadow-lg hover:shadow-blue-500/10 transition-colors cursor-pointer"
                    >
                      Guardar Cambios
                    </button>
                  </div>

                </form>

              </div>

            </div>
          )}

          {activeTab === "importar" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <ImportTradesView 
                accounts={accounts}
                existingTrades={trades}
                onImport={handleImportTrades}
                onCancel={() => setActiveTab("dashboard")}
                progressPct={progressPct}
              />
            </div>
          )}

          {activeTab === "planes" && (
            <div className="space-y-6 animate-in fade-in duration-200" id="view-planes">
              <PricingTable 
                currentPlan={userProfile.plan || "Free"} 
                userId={currentUser?.uid || "guest"} 
                userEmail={currentUser?.email || "guest@tradyum.com"} 
              />
            </div>
          )}
        </div>

        {/* Footer Info */}
        <footer className="h-8 bg-[#090a0c] text-[10px] text-slate-500 flex items-center justify-between shrink-0 font-mono mt-8 border-t border-white/5 pt-2">
          <span>Broker Connected: Stable Feed OK</span>
          <span>© 2026 Tradyum Dashboard</span>
        </footer>

      </main>

      {/* ========================================== */}
      {/* 3. CORE PORTAL MODAL DIALOGS               */}
      {/* ========================================== */}
      <AddTradeModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAddTrade={handleAddTrade}
        accounts={accounts}
      />

      <TradeDetailsModal
        trade={selectedTrade}
        onClose={() => setSelectedTrade(null)}
        onDeleteTrade={handleDeleteTrade}
        onUpdateNotes={handleUpdateNotes}
      />

      {/* Floating Payment Success Toast */}
      {paymentSuccessToast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl shadow-2xl p-4 border border-emerald-400/30 flex items-start gap-3 animate-bounce">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-xs">¡Activado Correctamente!</h4>
            <p className="text-[10px] text-emerald-100 mt-1 leading-relaxed">{paymentSuccessToast}</p>
          </div>
          <button 
            onClick={() => setPaymentSuccessToast(null)}
            className="text-white/60 hover:text-white text-xs font-bold leading-none select-none pl-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Firebase Auth Error Diagnostics Modal */}
      {authError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" id="auth-error-diagnostics-modal">
          <div className="w-full max-w-lg bg-[#111318] border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl text-left flex flex-col justify-between">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="w-10 h-10 bg-red-500/15 border border-red-500/25 text-red-500 rounded-full flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white font-display">
                    Error de Autenticación de Firebase
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Código de Error: {authError.code || "unknown"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {authError.code === "auth/unauthorized-domain" ? (
                  <>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      El dominio desde el que estás intentando iniciar sesión (<span className="text-red-400 font-black font-mono bg-red-500/10 px-1.5 py-0.5 rounded">{authError.domain}</span>) no está autorizado en tu consola de Firebase.
                    </p>
                    
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
                      <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Info className="w-4 h-4 shrink-0" /> ¿Cómo solucionarlo en 1 minuto?
                      </h4>
                      <ol className="text-[11px] text-slate-300 list-decimal pl-4 space-y-1.5 leading-relaxed">
                        <li>
                          Entrá a tu <a href="https://console.firebase.google.com/project/tradyum-865e7/authentication/providers" target="_blank" rel="noopener noreferrer" className="text-blue-400 font-bold hover:underline inline-flex items-center gap-0.5">
                            Consola de Firebase (sección Auth)
                          </a>.
                        </li>
                        <li>
                          Andá a la pestaña <span className="font-bold text-white">Configuración</span> (Settings) &gt; <span className="font-bold text-white">Dominios autorizados</span> (Authorized domains).
                        </li>
                        <li>
                          Hacé clic en <span className="font-bold text-white">Agregar dominio</span> y agregá:
                          <div className="mt-1.5 flex flex-col gap-1">
                            <code className="text-[10px] text-emerald-400 font-black font-mono bg-[#090a0c] px-2 py-1 rounded border border-white/5 w-full select-all">tradyum.vercel.app</code>
                            {authError.domain && authError.domain !== "tradyum.vercel.app" && authError.domain !== "localhost" && (
                              <code className="text-[10px] text-sky-400 font-black font-mono bg-[#090a0c] px-2 py-1 rounded border border-white/5 w-full select-all">{authError.domain}</code>
                            )}
                          </div>
                        </li>
                        <li>
                          ¡Listo! Volvé a recargar la página y apretá de nuevo "Iniciar sesión con Google".
                        </li>
                      </ol>
                    </div>
                  </>
                ) : authError.code === "auth/popup-blocked" ? (
                  <>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      El navegador bloqueó la ventana emergente de inicio de sesión de Google.
                    </p>
                    <div className="bg-[#181920] border border-white/5 rounded-xl p-3.5">
                      <h4 className="text-xs font-bold text-white mb-1">Solución:</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Por favor, permití las ventanas emergentes (popups) para este sitio en la barra de direcciones de tu navegador y volvé a intentarlo.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Ha ocurrido un error inesperado al intentar autenticarse con tu proyecto de Firebase.
                    </p>
                    <div className="bg-[#181920] border border-white/5 rounded-xl p-3 text-left">
                      <p className="text-[10.5px] text-red-300 font-mono leading-normal break-all">
                        {authError.message}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                <a 
                  href="https://console.firebase.google.com/project/tradyum-865e7/authentication/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl text-center shadow-lg shadow-red-600/10 hover:shadow-red-600/25 transition-all"
                >
                  Ir a Consola Firebase
                </a>
                <button
                  onClick={() => setAuthError(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs py-2.5 px-4 rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  Ignorar y cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Plan Upgrade Gateway Modal Dialog */}
      {upgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="upgrade-gateway-modal">
          <div className="w-full max-w-md bg-[#161224] border border-[#3b2d5c] rounded-2xl overflow-hidden shadow-2xl text-center flex flex-col justify-between">
            
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 rounded-full flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>

              <div>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Suscripciones Tradyum
                </span>
                
                <h3 className="text-lg font-black text-white font-display mt-2">
                  {upgradeReason === "limit_30" && "Límite de Operaciones Alcanzado"}
                  {upgradeReason === "ai_coach" && "Desbloquea el Coach de Riesgo AI"}
                  {upgradeReason === "stats" && "Diagnósticos y Estadísticas Avanzadas"}
                  {upgradeReason === "multi_account" && "Sincroniza Múltiples Cuentas"}
                  {upgradeReason === "export" && "Exporta Reportes en PDF & CSV"}
                  {!upgradeReason && "Actualiza tu Suscripción"}
                </h3>

                <p className="text-xs text-slate-300 mt-2 leading-relaxed px-2">
                  {upgradeReason === "limit_30" && "Has alcanzado el límite de 30 transacciones mensuales del Plan Free. Actualízate hoy a Pro o Elite para guardar trades ilimitados y continuar operando."}
                  {upgradeReason === "ai_coach" && "La auditoría cognitiva de Gemini AI analiza tus errores (FOMO, revancha, avaricia) para darte retroalimentación profesional. Disponible en el Plan Pro y Elite."}
                  {upgradeReason === "stats" && "Los diagnósticos avanzados calculan cuáles son tus setups más rentables y cuáles errores te están costando miles de dólares. Requiere Plan Pro o Elite."}
                  {upgradeReason === "multi_account" && "La gestión y agregación simultánea de múltiples cuentas de fondeo o de simulación requiere los privilegios del Plan Elite."}
                  {upgradeReason === "export" && "Descarga tu bitácora de transacciones formateada para auditorías fiscales, portafolios de fondeo o análisis en Excel. Requiere Plan Pro o Elite."}
                  {!upgradeReason && "Sube de nivel para acceder a recursos y optimizar tus retornos hoy mismo."}
                </p>
              </div>

              {/* Plans Quick Comparative grid preview */}
              <div className="bg-[#0f0b1a] border border-white/5 rounded-xl p-3 text-left space-y-1.5 text-[11px] text-slate-300 font-medium">
                <div className="flex justify-between items-center bg-[#130f22]/60 p-1.5 px-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-400">Plan Pro ($14/mes):</span>
                  <span className="font-bold text-indigo-400">Trades Ilimitados & AI Coach</span>
                </div>
                <div className="flex justify-between items-center bg-[#130f22]/60 p-1.5 px-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-400">Plan Elite ($21/mes):</span>
                  <span className="font-bold text-pink-400">Múltiples Cuentas & AI Avanzado</span>
                </div>
              </div>
            </div>

            {/* Bottom Modal Actions footer */}
            <div className="p-4 bg-slate-950/40 border-t border-white/5 flex gap-3 text-xs font-bold justify-end">
              <button
                onClick={() => {
                  setUpgradeModalOpen(false);
                  setUpgradeReason("");
                }}
                className="px-4 py-2 bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-300 rounded-lg cursor-pointer font-semibold"
              >
                Cerrar
              </button>
              
              <button
                onClick={() => {
                  setUpgradeModalOpen(false);
                  setUpgradeReason("");
                  setActiveTab("planes");
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white rounded-lg cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all font-bold"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Explorar Planes Premium
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MOBILE BOTTOM FLOATING NAVIGATION BAR     */}
      {/* ========================================== */}
      <div className="md:hidden fixed bottom-1 left-3 right-3 z-50 bg-[#0d0e12]/92 backdrop-blur-md border border-white/5 rounded-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.9)] pb-4.5 pt-3 px-6 flex items-center justify-between">
        
        {/* Tab 1: Dashboard (LayoutGrid icon) */}
        <button
          onClick={() => {
            setActiveTab("dashboard");
            setSelectedDate(null);
          }}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "dashboard"
              ? "text-white scale-110 active:scale-100"
              : "text-slate-500 hover:text-slate-200"
          }`}
        >
          <LayoutGrid className={`w-5.5 h-5.5 ${activeTab === "dashboard" ? "text-indigo-400 stroke-[2.5]" : "stroke-[2]"}`} />
        </button>

        {/* Tab 2: Cuentas (Wallet icon) */}
        <button
          onClick={() => {
            setActiveTab("cuentas");
          }}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "cuentas"
              ? "text-white scale-110 active:scale-100"
              : "text-slate-500 hover:text-slate-200"
          }`}
        >
          <Wallet className={`w-5.5 h-5.5 ${activeTab === "cuentas" ? "text-indigo-400 stroke-[2.5]" : "stroke-[2]"}`} />
        </button>

        {/* Action Button: Center Floating Plus Button with dynamic blueprint shadows exactly like screenshot */}
        <div className="relative -top-5">
          <motion.button
            whileTap={progressPct >= 100 ? {} : { scale: 0.92 }}
            disabled={progressPct >= 100}
            onClick={() => {
              if (progressPct >= 100) return;
              setIsAddOpen(true);
            }}
            className={`w-13 h-13 rounded-full flex items-center justify-center border-[3px] border-[#08090b] transition-all duration-150 ${
              progressPct >= 100
                ? "bg-rose-950 text-rose-500 cursor-not-allowed shadow-none"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/40 cursor-pointer hover:scale-105"
            }`}
            title={progressPct >= 100 ? "Límite diario alcanzado" : "Nueva Operación"}
          >
            {progressPct >= 100 ? (
              <Lock className="w-5 h-5 stroke-[2.5]" />
            ) : (
              <Plus className="w-5.5 h-5.5 stroke-[3]" />
            )}
          </motion.button>
          {/* Glow backdrop pulse ring */}
          {progressPct < 100 && (
            <div className="absolute inset-0 bg-indigo-500/15 rounded-full blur-md -z-10 pointer-events-none animate-pulse"></div>
          )}
        </div>

        {/* Tab 3: Operaciones (TrendingUp icon for metrics) */}
        <button
          onClick={() => setActiveTab("operaciones")}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "operaciones"
              ? "text-white scale-110 active:scale-100"
              : "text-slate-500 hover:text-slate-200"
          }`}
        >
          <TrendingUp className={`w-5.5 h-5.5 ${activeTab === "operaciones" ? "text-indigo-400 stroke-[2.5]" : "stroke-[2]"}`} />
        </button>

        {/* Tab 4: Calendario (Calendar icon) */}
        <button
          onClick={() => {
            setActiveTab("calendario");
            setSelectedDate(null);
          }}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "calendario"
              ? "text-white scale-110 active:scale-100"
              : "text-slate-500 hover:text-slate-200"
          }`}
        >
          <CalendarIcon className={`w-5.5 h-5.5 ${activeTab === "calendario" ? "text-indigo-400 stroke-[2.5]" : "stroke-[2]"}`} />
        </button>

        {/* Tab 5: Importar (Upload icon) */}
        <button
          onClick={() => {
            setActiveTab("importar");
          }}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "importar"
              ? "text-white scale-110 active:scale-100"
              : "text-slate-500 hover:text-slate-200"
          }`}
          title="Importar CSV"
        >
          <Upload className={`w-5.5 h-5.5 ${activeTab === "importar" ? "text-indigo-400 stroke-[2.5]" : "stroke-[2]"}`} />
        </button>

      </div>

    </div>
  );
}
