import React, { useState, useEffect } from 'react';
import { 
  CloudLightning, 
  Activity, 
  Lock, 
  Mail, 
  User, 
  AlertCircle,
  TrendingUp,
  Cpu,
  BookmarkCheck,
  Zap,
  Globe,
  ShieldAlert,
  Unlock
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from './supabase';
import { Account, Trade, Profile, DailyStats } from './types';

// Import Custom Modular Components
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { JournalView } from './components/JournalView';
import { CalendarView } from './components/CalendarView';
import { AccountsView } from './components/AccountsView';
import { AppLogo } from './components/AppLogo';
import AddTradeModal from './components/AddTradeModal';

export default function App() {
  // Authentication & Session
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(true); // Fallback offline mode
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authLogoZoom, setAuthLogoZoom] = useState<number>(1.1);

  // Core Applet State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'calendar' | 'accounts'>('dashboard');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);

  // Page loading spinner
  const [appLoading, setAppLoading] = useState(true);

  // Core risk control and blocking calculation values
  const activeAccount = accounts.find(a => a.id === activeAccountId);
  const localToday = new Date();
  const yccc = localToday.getFullYear();
  const mccc = String(localToday.getMonth() + 1).padStart(2, '0');
  const dccc = String(localToday.getDate()).padStart(2, '0');
  const localTodayStr = `${yccc}-${mccc}-${dccc}`;

  const todayTrades = activeAccount 
    ? trades.filter(t => t.account_id === activeAccountId && t.exit_time && t.exit_time.split('T')[0] === localTodayStr)
    : [];

  const todayPnL = todayTrades.reduce((sum, t) => sum + (t.net_pnl || 0), 0);
  const isAccountBlocked = false;

  // Initialize Auth Observer
  useEffect(() => {
    setAppLoading(true);
    let subscription: any = null;

    try {
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (session?.user) {
            setCurrentUser(session.user);
            setIsOfflineMode(false);
            fetchProfileAndData(session.user);
          } else {
            // Fallback to offline localstorage if not logged in
            loadOfflineDemoData();
            setAppLoading(false);
          }
        })
        .catch((err) => {
          console.warn("[Supabase Auth] Fallback to Offline Mode due to session load issue:", err);
          loadOfflineDemoData();
          setAppLoading(false);
        });

      const authChangeRes = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setCurrentUser(session.user);
          setIsOfflineMode(false);
          fetchProfileAndData(session.user);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
      });
      if (authChangeRes && authChangeRes.data) {
        subscription = authChangeRes.data.subscription;
      }
    } catch (err) {
      console.warn("[Supabase Auth] Failed to register auth changes. Entering fallback offline mode.", err);
      loadOfflineDemoData();
      setAppLoading(false);
    }

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Fetch all Supabase data for the logged-in user
  const fetchProfileAndData = async (user: any) => {
    setAppLoading(true);
    try {
      // 1. Fetch or create Profile
      let { data: profile, error: pError } = await supabase
        .from('profiles')
        .select()
        .eq('id', user.id)
        .single();

      if (pError || !profile) {
        // Automatically create a profile row if missing
        const newProfile = {
          id: user.id,
          email: user.email || '',
          full_name: authFullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Trader',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        };
        const { data: createdProf, error: insError } = await supabase
          .from('profiles')
          .upsert(newProfile)
          .select()
          .single();
        
        if (!insError && createdProf) {
          profile = createdProf;
        }
      }

      if (profile) {
        setUserProfile(profile);
      }

      // 2. Fetch Accounts
      const { data: fetchedAccounts, error: aError } = await supabase
        .from('accounts')
        .select()
        .eq('user_id', user.id);

      let workingAccounts = fetchedAccounts || [];

      // If no accounts exist in Supabase, create a default sample one
      if (workingAccounts.length === 0 && !aError) {
        const defaultAccount: Partial<Account> = {
          user_id: user.id,
          name: 'Apex $50k Principal',
          type: 'funded',
          broker: 'ninjatrader',
          account_number: 'APEX-99827',
          currency: 'USD',
          initial_balance: 50000,
          current_balance: 50000,
          is_active: true,
          color: '#3b82f6'
        };

        const { data: insAcc, error: insertAccError } = await supabase
          .from('accounts')
          .insert(defaultAccount)
          .select();

        if (!insertAccError && insAcc && insAcc.length > 0) {
          workingAccounts = insAcc;
        }
      }

      setAccounts(workingAccounts);

      if (workingAccounts.length > 0) {
        // Set first account active by default
        setActiveAccountId(workingAccounts[0].id);
      }

      // 3. Fetch Trades
      const { data: fetchedTrades, error: tError } = await supabase
        .from('trades')
        .select()
        .eq('user_id', user.id);

      if (!tError && fetchedTrades) {
        setTrades(fetchedTrades);
      }

      // 4. Fetch daily stats
      const { data: fStats, error: sError } = await supabase
        .from('daily_stats')
        .select()
        .eq('user_id', user.id);
      if (!sError && fStats) {
        setDailyStats(fStats);
      }

    } catch (err) {
      console.error("Error retrieving Supabase profile or metrics: ", err);
    } finally {
      setAppLoading(false);
    }
  };

  // Seed sample mock data for offline simulation or new profiles
  const loadOfflineDemoData = () => {
    const cachedAccounts = localStorage.getItem('tradyum_local_accounts');
    const cachedTrades = localStorage.getItem('tradyum_local_trades');

    if (cachedAccounts && cachedTrades) {
      const parsedAcc = JSON.parse(cachedAccounts);
      const parsedTr = JSON.parse(cachedTrades);
      setAccounts(parsedAcc);
      setTrades(parsedTr);
      if (parsedAcc.length > 0) {
        setActiveAccountId(parsedAcc[0].id);
      }
    } else {
      const demoAccounts: Account[] = [
        {
          id: 'demo-acc-1',
          user_id: 'offline',
          name: 'Apex Fund $100K',
          type: 'funded',
          broker: 'ninjatrader',
          account_number: 'APEX-FF-19283',
          currency: 'USD',
          initial_balance: 100000,
          current_balance: 104250,
          is_active: true,
          color: '#3b82f6',
          balance: 104250
        },
        {
          id: 'demo-acc-2',
          user_id: 'offline',
          name: 'My Personal Live Account',
          type: 'personal',
          broker: 'tradovate',
          account_number: 'TV-LIVE-8273',
          currency: 'USD',
          initial_balance: 10000,
          current_balance: 9340,
          is_active: true,
          color: '#10b981',
          balance: 9340
        }
      ] as any;

      const demoTrades: Trade[] = [
        {
          id: 'dem-tr-1',
          user_id: 'offline',
          account_id: 'demo-acc-1',
          symbol: 'NQ 09-26',
          asset_class: 'futures',
          direction: 'long',
          entry_price: 18450.50,
          exit_price: 18475.25,
          quantity: 2,
          entry_time: new Date(Date.now() - 86400 * 2000).toISOString(), // 2 days ago
          exit_time: new Date(Date.now() - 86400 * 1990).toISOString(),
          gross_pnl: 990.00,
          commission: 8.24,
          net_pnl: 981.76,
          status: 'closed',
          import_source: 'manual',
          notes: 'Entrada perfecta tras rompimiento del nivel Fibonacci 61.8%. Aguantado con paciencia.',
          tags: ['fibonacci', 'trend-following'],
          rating: 5,
          emotions: ['Disciplinados', 'Calma']
        },
        {
          id: 'dem-tr-2',
          user_id: 'offline',
          account_id: 'demo-acc-1',
          symbol: 'NQ 09-26',
          asset_class: 'futures',
          direction: 'short',
          entry_price: 18512.00,
          exit_price: 18525.50,
          quantity: 3,
          entry_time: new Date(Date.now() - 86400 * 1000).toISOString(), // Yesterday
          exit_time: new Date(Date.now() - 86400 * 995).toISOString(),
          gross_pnl: -810.00,
          commission: 12.36,
          net_pnl: -822.36,
          status: 'closed',
          import_source: 'manual',
          notes: 'Mala lectura del orden flow. Entré tarde en corto sintiendo miedo a perder el movimiento.',
          tags: ['fomo', 'order-flow'],
          rating: 2,
          emotions: ['FOMO', 'Miedo']
        },
        {
          id: 'dem-tr-3',
          user_id: 'offline',
          account_id: 'demo-acc-1',
          symbol: 'ES 09-26',
          asset_class: 'futures',
          direction: 'long',
          entry_price: 5410.25,
          exit_price: 5431.50,
          quantity: 4,
          entry_time: new Date(Date.now() - 36000 * 100).toISOString(), // Today
          exit_time: new Date(Date.now() - 36000 * 90).toISOString(),
          gross_pnl: 4250.00,
          commission: 16.48,
          net_pnl: 4233.52,
          status: 'closed',
          import_source: 'manual',
          notes: 'Gran rally americano. Operación perfecta siguiendo la pauta de las 10:00 AM.',
          tags: ['trend', 'bell-curve'],
          rating: 4,
          emotions: ['Pacientes', 'Calma']
        },
        {
          id: 'dem-tr-4',
          user_id: 'offline',
          account_id: 'demo-acc-2',
          symbol: 'EURUSD',
          asset_class: 'forex',
          direction: 'short',
          entry_price: 1.08450,
          exit_price: 1.08510,
          quantity: 100000,
          entry_time: new Date(Date.now() - 36000 * 40).toISOString(),
          exit_time: new Date(Date.now() - 36000 * 30).toISOString(),
          gross_pnl: -600.00,
          commission: 10.00,
          net_pnl: -610.00,
          status: 'closed',
          import_source: 'manual',
          notes: 'Pérdida por test de liquidez contra mi stop. No me di cuenta del calendario microeconómico.',
          tags: ['news', 'forex-spread'],
          rating: 3,
          emotions: ['Exceso', 'Venganza']
        }
      ] as any[] as Trade[];

      localStorage.setItem('tradyum_local_accounts', JSON.stringify(demoAccounts));
      localStorage.setItem('tradyum_local_trades', JSON.stringify(demoTrades));

      setAccounts(demoAccounts);
      setTrades(demoTrades);
      setActiveAccountId(demoAccounts[0].id);
    }
  };

  // HANDLERS FOR PERSISTENT OR LOCAL CHANGES
  const handleCreateAccount = async (payload: Partial<Account>) => {
    if (isOfflineMode) {
      const newAcc: Account = {
        balance: payload.current_balance ?? payload.initial_balance ?? 0,
        id: `local-acc-${Date.now()}`,
        user_id: 'offline',
        name: payload.name || 'Sample Account',
        type: payload.type || 'demo',
        broker: payload.broker || 'generic',
        account_number: payload.account_number,
        currency: payload.currency || 'USD',
        initial_balance: payload.initial_balance || 0,
        current_balance: payload.current_balance || 0,
        is_active: true,
        color: payload.color || '#3b82f6'
      };
      const updated = [...accounts, newAcc];
      setAccounts(updated);
      localStorage.setItem('tradyum_local_accounts', JSON.stringify(updated));
      setActiveAccountId(newAcc.id);
    } else {
      // Supabase persistent insertion
      const completeAcc = { ...payload, user_id: currentUser.id };
      const { data, error } = await supabase
        .from('accounts')
        .insert(completeAcc)
        .select();

      if (!error && data && data.length > 0) {
        setAccounts([...accounts, data[0] as Account]);
        setActiveAccountId(data[0].id);
      } else {
        throw new Error(error?.message || 'Fallo de inserción');
      }
    }
  };

  const handleUpdateAccount = async (id: string, payload: Partial<Account>) => {
    if (isOfflineMode) {
      const updated = accounts.map(a => a.id === id ? { ...a, ...payload } : a);
      setAccounts(updated);
      localStorage.setItem('tradyum_local_accounts', JSON.stringify(updated));
    } else {
      const { error } = await supabase
        .from('accounts')
        .update(payload)
        .eq('id', id);

      if (!error) {
        setAccounts(accounts.map(a => a.id === id ? { ...a, ...payload } as Account : a));
      } else {
        throw new Error(error.message);
      }
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (isOfflineMode) {
      const remainingAccounts = accounts.filter(a => a.id !== id);
      const remainingTrades = trades.filter(t => t.account_id !== id);
      setAccounts(remainingAccounts);
      setTrades(remainingTrades);
      localStorage.setItem('tradyum_local_accounts', JSON.stringify(remainingAccounts));
      localStorage.setItem('tradyum_local_trades', JSON.stringify(remainingTrades));
      
      if (activeAccountId === id) {
        setActiveAccountId(remainingAccounts[0]?.id || null);
      }
    } else {
      // Supabase cascade deletion
      // Delete trades first to maintain foreign key constraints securely
      const { error: tErr } = await supabase
        .from('trades')
        .delete()
        .eq('account_id', id);

      const { error: dErr } = await supabase
        .from('daily_stats')
        .delete()
        .eq('account_id', id);

      const { error: aErr } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

      if (!aErr) {
        setAccounts(accounts.filter(a => a.id !== id));
        setTrades(trades.filter(t => t.account_id !== id));
        if (activeAccountId === id) {
          setActiveAccountId(accounts.find(a => a.id !== id)?.id || null);
        }
      } else {
        alert(`Error borrando la cuenta de Supabase: ${aErr.message}`);
      }
    }
  };

  const handleUpdateTradeDetails = async (tradeId: string, updates: Partial<Trade>) => {
    if (isOfflineMode) {
      const updated = trades.map(t => t.id === tradeId ? { ...t, ...updates } : t);
      setTrades(updated);
      localStorage.setItem('tradyum_local_trades', JSON.stringify(updated));
    } else {
      const { error } = await supabase
        .from('trades')
        .update(updates)
        .eq('id', tradeId);

      if (!error) {
        setTrades(trades.map(t => t.id === tradeId ? { ...t, ...updates } : t));
      } else {
        throw new Error(error.message);
      }
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (isOfflineMode) {
      const updated = trades.filter(t => t.id !== tradeId);
      setTrades(updated);
      localStorage.setItem('tradyum_local_trades', JSON.stringify(updated));
    } else {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', tradeId);

      if (!error) {
        setTrades(trades.filter(t => t.id !== tradeId));
      } else {
        alert(`Error eliminando trade de Supabase: ${error.message}`);
      }
    }
  };

  const handleImportTrades = async (accountId: string, newTrades: Trade[]): Promise<{ imported: number; skipped: number }> => {
    let imported = 0;
    let skipped = 0;

    if (isOfflineMode) {
      // Check duplicate against current trades in offline list
      const finalTrades = [...trades];
      newTrades.forEach(tr => {
        const isDuplicate = trades.some(t => t.broker_trade_id && t.broker_trade_id === tr.broker_trade_id && t.account_id === accountId);
        if (!isDuplicate) {
          finalTrades.push({ ...tr, id: `local-tr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` });
          imported++;
        } else {
          skipped++;
        }
      });

      // Recalculate account balance based on net pnl sum of imported trades
      let balanceDelta = 0;
      newTrades.forEach(t => balanceDelta += t.net_pnl);

      const modifiedAccounts = accounts.map(a => {
        if (a.id === accountId) {
          return { ...a, current_balance: a.current_balance + balanceDelta };
        }
        return a;
      });

      setAccounts(modifiedAccounts);
      setTrades(finalTrades);
      localStorage.setItem('tradyum_local_accounts', JSON.stringify(modifiedAccounts));
      localStorage.setItem('tradyum_local_trades', JSON.stringify(finalTrades));

    } else {
      // Supabase persistent insertion
      const finalNewTrades: any[] = [];
      for (const tr of newTrades) {
        // Query duplicate
        if (tr.broker_trade_id) {
          const { data: dup, error } = await supabase
            .from('trades')
            .select('id')
            .eq('account_id', accountId)
            .eq('broker_trade_id', tr.broker_trade_id)
            .maybeSingle();

          if (!error && dup) {
            skipped++;
            continue;
          }
        }

        // Prepare object mapping exactly to Supabase keys
        const formatted = {
          user_id: currentUser.id,
          account_id: accountId,
          broker_trade_id: tr.broker_trade_id,
          symbol: tr.symbol,
          asset_class: tr.asset_class,
          direction: tr.direction,
          entry_price: tr.entry_price,
          exit_price: tr.exit_price,
          stop_loss: tr.stop_loss,
          take_profit: tr.take_profit,
          quantity: tr.quantity,
          entry_time: tr.entry_time,
          exit_time: tr.exit_time,
          gross_pnl: tr.gross_pnl,
          commission: tr.commission,
          net_pnl: tr.net_pnl,
          status: tr.status,
          import_source: tr.import_source,
          raw_data: tr.raw_data,
          notes: tr.notes,
          tags: tr.tags,
          emotions: tr.emotions,
          rating: tr.rating,
          screenshot_url: tr.screenshot_url
        };

        finalNewTrades.push(formatted);
      }

      if (finalNewTrades.length > 0) {
        const { data: inserted, error: insErr } = await supabase
          .from('trades')
          .insert(finalNewTrades)
          .select();

        if (!insErr && inserted) {
          setTrades([...trades, ...inserted] as Trade[]);
          imported = inserted.length;

          // Compute balance update
          let totalImportedProfit = 0;
          inserted.forEach(tr => totalImportedProfit += tr.net_pnl);

          const activeAccSpec = accounts.find(a => a.id === accountId);
          if (activeAccSpec) {
            const nextBalance = activeAccSpec.current_balance + totalImportedProfit;
            await supabase
              .from('accounts')
              .update({ current_balance: nextBalance })
              .eq('id', accountId);

            setAccounts(accounts.map(a => a.id === accountId ? { ...a, current_balance: nextBalance } : a));
          }

          // Trigger recalculating and populating daily_stats rows for calendar!
          await seedCloudDailyStats(currentUser.id, accountId, inserted as Trade[]);
        } else {
          throw new Error(insErr?.message || 'Error guardando registros en la base de datos');
        }
      }
    }

    return { imported, skipped };
  };

  // SEED DAILY_STATS TABLE TO ACCURATELY BACKEND THE CALENDAR PNLS
  const seedCloudDailyStats = async (userId: string, accountId: string, importedTrades: Trade[]) => {
    try {
      // Group loaded and new trades by day YYYY-MM-DD
      const dateGroups: Record<string, Trade[]> = {};
      
      const allAccTrades = trades.filter(t => t.account_id === accountId).concat(importedTrades);
      allAccTrades.forEach(t => {
        const day = t.exit_time.split('T')[0];
        if (!dateGroups[day]) dateGroups[day] = [];
        dateGroups[day].push(t);
      });

      for (const [dayString, dayTrades] of Object.entries(dateGroups)) {
        let totalDailyPnl = 0;
        let winning = 0;
        let losing = 0;
        let grossProfit = 0;
        let grossLoss = 0;

        dayTrades.forEach(tr => {
          totalDailyPnl += tr.net_pnl;
          if (tr.net_pnl > 0) {
            winning++;
            grossProfit += tr.net_pnl;
          } else if (tr.net_pnl < 0) {
            losing++;
            grossLoss += Math.abs(tr.net_pnl);
          }
        });

        const dailyRate = dayTrades.length > 0 ? (winning / dayTrades.length) * 100 : 0;
        const profitFactorString = grossLoss > 0 ? (grossProfit / grossLoss) : grossProfit > 0 ? 10 : 0;

        const statPayload = {
          user_id: userId,
          account_id: accountId,
          date: dayString,
          total_trades: dayTrades.length,
          winning_trades: winning,
          losing_trades: losing,
          win_rate: parseFloat(dailyRate.toFixed(1)),
          net_pnl: parseFloat(totalDailyPnl.toFixed(2)),
          profit_factor: parseFloat(profitFactorString.toFixed(2))
        };

        // Upsert into Supabase daily_stats dynamically
        await supabase
          .from('daily_stats')
          .upsert(statPayload, { onConflict: 'user_id,account_id,date' });
      }
    } catch (e) {
      console.error("Failed to seed daily_stats map: ", e);
    }
  };

  const handleSaveManualTrade = async (manualTrade: any) => {
    const assetTypeMap: Record<string, string> = {
      'Futures': 'futures',
      'Stock': 'stocks',
      'Stocks': 'stocks',
      'Options': 'options',
      'Crypto': 'crypto',
      'Forex': 'forex'
    };

    const asset_class = assetTypeMap[manualTrade.assetType] || 'futures';
    const direction = manualTrade.action === 'Buy' ? 'long' : 'short';
    const cleanAccountId = manualTrade.accountId || activeAccountId || null;

    if (!cleanAccountId && accounts.length > 0) {
      alert("Por favor selecciona una Cuenta de Trading antes de guardar tu operación.");
      return;
    }

    const formattedTrade: any = {
      id: manualTrade.id || `trade-${Date.now()}`,
      symbol: manualTrade.symbol,
      asset_class,
      direction,
      entry_price: manualTrade.entryPrice || 0,
      exit_price: manualTrade.exitPrice || 0,
      quantity: manualTrade.quantity || 1,
      entry_time: `${manualTrade.date}T${manualTrade.time || '10:30'}:00`,
      exit_time: `${manualTrade.date}T${manualTrade.time === '10:30' ? '10:45' : manualTrade.time || '10:45'}:00`,
      gross_pnl: manualTrade.pnl || 0,
      commission: 0,
      net_pnl: manualTrade.netPnl || 0,
      status: manualTrade.status || 'Flat',
      import_source: 'manual',
      notes: manualTrade.notes || '',
      screenshot_url: manualTrade.screenshot || null
    };

    if (isOfflineMode) {
      const dbTrade = {
        ...formattedTrade,
        id: `local-tr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        account_id: cleanAccountId
      };

      const finalTrades = [...trades, dbTrade];
      setTrades(finalTrades);
      localStorage.setItem('tradyum_local_trades', JSON.stringify(finalTrades));

      if (cleanAccountId) {
        const modifiedAccounts = accounts.map(a => {
          if (a.id === cleanAccountId) {
            return { ...a, current_balance: a.current_balance + dbTrade.net_pnl };
          }
          return a;
        });
        setAccounts(modifiedAccounts);
        localStorage.setItem('tradyum_local_accounts', JSON.stringify(modifiedAccounts));
      }
      setIsAddTradeOpen(false);
    } else {
      const formatted = {
        user_id: currentUser.id,
        account_id: cleanAccountId,
        symbol: formattedTrade.symbol,
        asset_class: formattedTrade.asset_class,
        direction: formattedTrade.direction,
        entry_price: formattedTrade.entry_price,
        exit_price: formattedTrade.exit_price,
        quantity: formattedTrade.quantity,
        entry_time: formattedTrade.entry_time,
        exit_time: formattedTrade.exit_time,
        gross_pnl: formattedTrade.gross_pnl,
        commission: 0,
        net_pnl: formattedTrade.net_pnl,
        status: formattedTrade.status,
        import_source: 'manual',
        notes: formattedTrade.notes,
        screenshot_url: formattedTrade.screenshot_url
      };

      const { data: inserted, error: insErr } = await supabase
        .from('trades')
        .insert(formatted)
        .select();

      if (!insErr && inserted && inserted.length > 0) {
        setTrades([...trades, inserted[0]] as Trade[]);

        if (cleanAccountId) {
          const activeAccSpec = accounts.find(a => a.id === cleanAccountId);
          if (activeAccSpec) {
            const nextBalance = activeAccSpec.current_balance + formattedTrade.net_pnl;
            await supabase
              .from('accounts')
              .update({ current_balance: nextBalance })
              .eq('id', cleanAccountId);

            setAccounts(accounts.map(a => a.id === cleanAccountId ? { ...a, current_balance: nextBalance } : a));
          }
        }

        await seedCloudDailyStats(currentUser.id, cleanAccountId, [inserted[0] as Trade]);
        setIsAddTradeOpen(false);
      } else {
        alert(insErr?.message || 'Error guardando registros en la base de datos');
      }
    }
  };

  // AUTH ACTIONS
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) return;

    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isRegistering) {
        // Registering
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword.trim(),
          options: {
            data: {
              full_name: authFullName.trim()
            }
          }
        });

        if (error) throw error;
        alert("¡Registro enviado! Verifica tu email para confirmar tu cuenta y sincronizar Tradyum con Supabase en tiempo real.");
        setIsRegistering(false);
      } else {
        // Logging in
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword.trim()
        });

        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || 'Ocurrió un error inesperado al procesar la autenticación');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUserProfile(null);
    setIsOfflineMode(true);
    loadOfflineDemoData();
    setActiveTab('dashboard');
  };

  return (
    <div id="full-app-root" className="min-h-screen bg-[#0c0415] flex font-sans text-slate-100">
      
      {appLoading ? (
        /* Loader spinner */
        <div id="app-loading-spinner" className="min-h-screen flex-1 bg-[#12071a] flex flex-col items-center justify-center gap-4">
          <div className="inline-block w-8 h-8 border-4 border-t-[#c084fc] border-[#2a1640] rounded-full animate-spin" />
          <p className="text-xs font-mono text-purple-400/60 tracking-wider">Cargando Terminal Tradyum...</p>
        </div>
      ) : isOfflineMode && !currentUser ? (
        /* SPlit Authentic login / local demo dashboard page */
        <div id="auth-portal" className="min-h-screen flex-1 flex flex-col md:flex-row bg-[#0a0210] overflow-hidden relative">
          
          {/* Subtle cosmic circle decorations */}
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-fuchsia-500/5 blur-3xl pointer-events-none" />

          {/* Left Panel: Presentation branding */}
          <div id="auth-branding-panel" className="flex-1 p-8 md:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-purple-950/20 bg-[#0d0415]">
            <div className="flex items-center gap-3 text-left">
              <AppLogo size={40} />
              <h1 className="font-display font-bold text-xl tracking-tight text-white">Tradyum</h1>
            </div>

            <div className="max-w-md space-y-6 my-8 text-left">
              <div className="inline-flex items-center gap-1.5 bg-purple-500/10 text-purple-300 border border-[#c084fc]/20 rounded-full py-1 px-3 text-[10px] font-mono font-bold uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5" /> Sincronización en la Nube
              </div>
              
              <h2 className="font-display font-semibold text-3xl leading-tight tracking-tight text-[#ebd7ff] md:text-3xl text-left">
                El diario donde la psicología se encuentra con las matemáticas.
              </h2>
              
              <p className="text-purple-300/60 text-xs leading-relaxed text-left">
                Llevar una bitácora científica es la clave de todo trader consistente. Tradyum te ofrece un entorno unificado con calendarización de calor, calculadora de factor beneficio, ratios de rachas, análisis emocional y multicuenta segura con Supabase.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="bg-[#180e22] border border-[#c084fc]/15 rounded-2xl p-4 text-left">
                  <span className="text-[9px] font-mono text-[#ebd7ff] font-bold uppercase block mb-1">Cero Fricción</span>
                  <p className="text-[11px] text-purple-300/50 leading-normal">Modulo de importación inteligente para NinjaTrader, Tradovate y MetaTrader.</p>
                </div>
                <div className="bg-[#180e22] border border-[#c084fc]/15 rounded-2xl p-4 text-left">
                  <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase block mb-1">Métricas RLS</span>
                  <p className="text-[11px] text-purple-300/50 leading-normal">Máxima seguridad Supabase RLS. Tus trades son solo visibles para ti.</p>
                </div>
              </div>

              {/* Interactive Zoom Logo Showcase */}
              <div className="bg-[#180e22]/60 border border-[#c084fc]/10 rounded-2xl p-4 space-y-3 mt-4 text-left relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-purple-500/5 blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[11px] font-bold text-[#ebd7ff]">Visor de Emblema (Interactive Compass)</h4>
                    <p className="text-[9.5px] text-purple-400/50">Ajusta el zoom para ver en detalle la precisión del compás de trading</p>
                  </div>
                  <span className="text-[8px] font-mono bg-[#c084fc]/10 text-purple-300 border border-[#c084fc]/20 px-2 py-0.5 rounded-full uppercase scale-90">Zoom</span>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#12071a]/70 p-3.5 rounded-xl border border-purple-950/45">
                  <div className="relative p-1 bg-[#180e22] border border-[#c084fc]/15 rounded-full shadow-inner flex items-center justify-center p-2.5 bg-gradient-to-b from-[#1c112a] to-[#12071a]">
                    <AppLogo size={90} zoom={authLogoZoom} />
                  </div>
                  <div className="flex-grow w-full space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-mono">
                      <span className="text-purple-400/70 uppercase">Escala de Lente:</span>
                      <span className="text-[#ebd7ff] bg-purple-500/20 px-2 py-0.5 rounded font-bold">{authLogoZoom.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range"
                      min="1.0"
                      max="3.0"
                      step="0.05"
                      value={authLogoZoom}
                      onChange={(e) => setAuthLogoZoom(parseFloat(e.target.value))}
                      className="w-full h-1 bg-[#2a1640] accent-[#ebd7ff] rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] font-mono text-purple-400/40">
                      <span>1.0x (Original)</span>
                      <span>3.0x (Zoom Máximo)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Offline Sandbox Button */}
            <div className="pt-6 text-left">
              <button
                id="enter-offline-demo-btn"
                onClick={() => setIsOfflineMode(false)}
                className="w-full md:w-auto bg-[#12071a] hover:bg-[#1f112c] border border-[#c084fc]/15 text-purple-300 hover:text-[#ebd7ff] px-5 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                Continuar en Modo Demo (Local)
              </button>
            </div>
          </div>

          {/* Right Panel: Clean login form */}
          <div id="auth-form-panel" className="w-full md:w-[480px] p-8 md:p-12 flex flex-col justify-center bg-[#12071a]/40 border-l border-purple-950/20">
            <div className="w-full max-w-sm mx-auto space-y-6 text-left">
              <div>
                <h2 className="font-display font-semibold text-lg text-[#ebd7ff]">
                  {isRegistering ? 'Crear una cuenta' : 'Inicializar Sesión Cloud'}
                </h2>
                <p className="text-xs text-purple-300/55 mt-1">
                  {isRegistering ? 'Regístrate para guardar y sincronizar tu diario con Supabase.' : 'Introduce tus credenciales para conectar tu diario en vercel.'}
                </p>
              </div>

              {authError && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-400 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{authError}</div>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {isRegistering && (
                  <div>
                    <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5 px-0.5">Nombre Completo</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="ej. Félix Romero"
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#ebd7ff] focus:outline-none transition-all"
                        required
                      />
                      <User className="w-4 h-4 text-purple-450/40 absolute left-3 top-3" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5 px-0.5">Correo Electrónico</label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="ej. felix@tradyum.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#ebd7ff] focus:outline-none transition-all"
                      required
                    />
                    <Mail className="w-4 h-4 text-purple-450/40 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5 px-0.5">Contraseña</label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder={isRegistering ? "Escoge una clave fuerte (min 6)" : "Tu contraseña"}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#ebd7ff] focus:outline-none transition-all"
                      required
                    />
                    <Lock className="w-4 h-4 text-purple-450/40 absolute left-3 top-3" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-gradient-to-r from-[#9333ea] to-[#db2777] hover:opacity-90 disabled:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-purple-500/15"
                >
                  <CloudLightning className="w-4 h-4" />
                  {authLoading ? 'Procesando...' : isRegistering ? 'Crear Registro' : 'Conectarse a la Nube'}
                </button>
              </form>

              <div className="border-t border-[#c084fc]/10 pt-4 text-center">
                <button
                  id="auth-toggle-reg-btn"
                  onClick={() => { setIsRegistering(!isRegistering); setAuthError(null); }}
                  className="text-xs font-mono text-purple-450/50 hover:text-purple-300 underline cursor-pointer hover:no-underline"
                >
                  {isRegistering ? '¿Ya tienes una cuenta? Iniciar Sesión' : '¿Aún sin cuenta? Crea una'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div id="authenticated-app-canvas" className="flex-1 flex min-h-screen relative bg-[#0a0210]">
          
          {/* Siderbar navigation */}
          <Sidebar
            accounts={accounts}
            activeAccountId={activeAccountId}
            setActiveAccountId={setActiveAccountId}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            userProfile={currentUser ? { name: userProfile?.full_name || currentUser.email.split('@')[0], email: currentUser.email } : null}
            onLogout={handleLogout}
          />

          {/* Main workspace scroll canvas */}
          <main id="main-scroll-canvas" className="flex-1 p-6 md:p-10 max-h-screen overflow-y-auto bg-[#0a0210] relative space-y-8">
            
            {/* Topbar welcome bar */}
            {isOfflineMode && (
              <div id="trial-pnl-notice" className="bg-gradient-to-r from-purple-950/40 to-fuchsia-950/20 border border-[#c084fc]/15 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-200">🛠️ Estás en el Módulo Demo Offline</p>
                  <p className="text-[10.5px] text-purple-300/60">Tus datos se guardan temporalmente en tu navegador. Para Sincronizar permanentemente con Supabase, presiona Conectar Nube.</p>
                </div>
                <button
                  onClick={() => { setIsOfflineMode(false); setCurrentUser(null); }}
                  className="bg-[#12071a] hover:bg-[#1f112c] border border-[#c084fc]/15 text-purple-300 py-1.5 px-3.5 rounded-xl text-xs font-mono cursor-pointer transition-colors"
                >
                  Iniciar Sesión Supabase
                </button>
              </div>
            )}

              {/* Rendered Views Router */}
              {activeTab === 'dashboard' && (
                <DashboardView
                  trades={trades}
                  accounts={accounts}
                  activeAccountId={activeAccountId}
                  onUpdateAccount={handleUpdateAccount}
                  onAddTradeRequest={() => setIsAddTradeOpen(true)}
                />
              )}

            {activeTab === 'journal' && (
              <JournalView
                trades={trades}
                accounts={accounts}
                activeAccountId={activeAccountId}
                onUpdateTradeDetails={handleUpdateTradeDetails}
                onDeleteTrade={handleDeleteTrade}
                onAddTradeRequest={() => setIsAddTradeOpen(true)}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView
                trades={trades}
                accounts={accounts}
                activeAccountId={activeAccountId}
              />
            )}

            {activeTab === 'accounts' && (
              <AccountsView
                accounts={accounts}
                onCreateAccount={handleCreateAccount}
                onUpdateAccount={handleUpdateAccount}
                onDeleteAccount={handleDeleteAccount}
                onSelectAccount={setActiveAccountId}
                activeAccountId={activeAccountId}
              />
            )}



          </main>
        </div>
      )}

      <AddTradeModal
        isOpen={isAddTradeOpen}
        onClose={() => setIsAddTradeOpen(false)}
        onAddTrade={handleSaveManualTrade}
        accounts={accounts}
      />
    </div>
  );
}
