import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Activity, 
  Server, 
  Check, 
  X, 
  AlertTriangle,
  Coins,
  TrendingUp
} from 'lucide-react';
import { Account, AccountType, BrokerType } from '../types';

interface AccountsViewProps {
  accounts: Account[];
  onCreateAccount: (acc: Partial<Account>) => Promise<void>;
  onUpdateAccount: (id: string, acc: Partial<Account>) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onSelectAccount: (id: string) => void;
  activeAccountId: string | null;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onSelectAccount,
  activeAccountId
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingAccId, setEditingAccId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('demo');
  const [broker, setBroker] = useState<BrokerType>('generic');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [initialBalance, setInitialBalance] = useState('50000');
  const [currentBalance, setCurrentBalance] = useState('50000');
  const [color, setColor] = useState('#3b82f6');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setType('demo');
    setBroker('generic');
    setAccountNumber('');
    setCurrency('USD');
    setInitialBalance('50000');
    setCurrentBalance('50000');
    setColor('#3b82f6');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<Account> = {
        name: name.trim(),
        type,
        broker,
        account_number: accountNumber.trim() || undefined,
        currency,
        initial_balance: parseFloat(initialBalance) || 0,
        current_balance: parseFloat(currentBalance) || parseFloat(initialBalance) || 0,
        color,
        is_active: true
      };

      if (editingAccId) {
        await onUpdateAccount(editingAccId, payload);
        setEditingAccId(null);
      } else {
        await onCreateAccount(payload);
        setIsCreating(false);
      }
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (acc: Account) => {
    setEditingAccId(acc.id);
    setName(acc.name);
    setType(acc.type);
    setBroker(acc.broker);
    setAccountNumber(acc.account_number || '');
    setCurrency(acc.currency);
    setInitialBalance(String(acc.initial_balance));
    setCurrentBalance(String(acc.current_balance));
    setColor(acc.color || '#3b82f6');
    setIsCreating(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`⚠️ ¿Estás absolutamente seguro de eliminar la cuenta "${name}"?\n¡ATENCIÓN!: Se eliminarán en cascada todos los trades, importaciones y estadísticas diarias asociadas a esta cuenta en Supabase.`)) {
      await onDeleteAccount(id);
    }
  };

  return (
    <div id="accounts-view-root" className="space-y-6">
      {/* View Header */}
      <div id="accounts-header" className="flex items-center justify-between">
        <div>
          <h2 id="accounts-view-title" className="font-display font-semibold text-xl tracking-tight text-[#ebd7ff]">
            Cuentas de Journaling
          </h2>
          <p id="accounts-view-desc" className="text-xs text-purple-300/60 mt-1">
            Crea y administra tus cuentas simuladas, de fondeo (Apex, Lilu, FTMO) o cuentas personales.
          </p>
        </div>

        {!isCreating && (
          <button
            id="create-account-btn"
            onClick={() => { resetForm(); setEditingAccId(null); setIsCreating(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-[#9333ea] to-[#db2777] hover:opacity-90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-purple-500/10 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Nueva Cuenta
          </button>
        )}
      </div>

      {isCreating ? (
        /* Account creation form */
        <form id="account-form" onSubmit={handleSubmit} className="bg-[#180e22] border border-[#c084fc]/15 rounded-2xl p-6 glow-blue max-w-2xl space-y-5">
          <div id="account-form-header" className="flex items-center justify-between pb-3 border-b border-purple-950/30">
            <h3 id="account-form-title" className="font-display font-medium text-sm text-[#ebd7ff]">
              {editingAccId ? 'Editar Cuenta de Trading' : 'Crear Nueva Cuenta de Trading'}
            </h3>
            <button
              id="cancel-form-btn"
              type="button"
              onClick={() => { setIsCreating(false); resetForm(); }}
              className="p-1 px-2.5 rounded-lg text-xs bg-[#12071a] border border-purple-950/40 text-purple-300/60 hover:text-purple-200 transition-colors"
            >
              Cancelar
            </button>
          </div>

          <div id="account-form-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5">Nombre de Cuenta *</label>
              <input
                type="text"
                placeholder="ej. Apex $50k Futures"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] focus:outline-none rounded-xl py-2.5 px-3.5 text-xs text-slate-200 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5">N° de Cuenta / ID</label>
              <input
                type="text"
                placeholder="ej. APEX-12345"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] focus:outline-none rounded-xl py-2.5 px-3.5 text-xs text-slate-200 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5">Tipo de Cuenta</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] focus:outline-none rounded-xl py-2.5 px-3.5 text-xs text-slate-200 transition-all font-sans"
              >
                <option value="funded">Fondeo (Funded)</option>
                <option value="demo">Demo (Simulación)</option>
                <option value="personal">Personal / Real (Self-Funded)</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5">Broker / Origen de Datos</label>
              <select
                value={broker}
                onChange={(e) => setBroker(e.target.value as BrokerType)}
                className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] focus:outline-none rounded-xl py-2.5 px-3.5 text-xs text-slate-200 transition-all font-sans"
              >
                <option value="ninjatrader">NinjaTrader</option>
                <option value="tradovate">Tradovate</option>
                <option value="mt4">MetaTrader 4 (MT4)</option>
                <option value="mt5">MetaTrader 5 (MT5)</option>
                <option value="tradingview">TradingView</option>
                <option value="generic">Genérico (CSV)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5">Balance Inicial (USD) *</label>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] focus:outline-none rounded-xl py-2.5 px-3.5 text-xs text-slate-200 transition-all font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5">Balance Actual (USD) *</label>
              <input
                type="number"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] focus:outline-none rounded-xl py-2.5 px-3.5 text-xs text-slate-200 transition-all font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5">Divisa</label>
              <input
                type="text"
                placeholder="USD"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] focus:outline-none rounded-xl py-2.5 px-3.5 text-xs text-slate-200 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-1.5">Color Temático</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 bg-transparent border-0 rounded-lg cursor-pointer"
                />
                <span className="text-xs font-mono text-purple-300/60">{color}</span>
              </div>
            </div>
          </div>

          <div id="form-actions" className="flex gap-3 justify-end pt-3 border-t border-purple-950/30">
            <button
              id="submit-account-btn"
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#9333ea] to-[#db2777] hover:opacity-90 text-white font-semibold text-xs py-2 px-4 rounded-xl disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Guardando...' : editingAccId ? 'Actualizar Cuenta' : 'Crear Cuenta'}
            </button>
          </div>
        </form>
      ) : (
        /* List of Accounts */
        <div id="accounts-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc) => {
            const isSelected = acc.id === activeAccountId;
            const absoluteChange = acc.current_balance - acc.initial_balance;
            const percentageChange = acc.initial_balance > 0 ? (absoluteChange / acc.initial_balance) * 100 : 0;
            const profitFormat = new Intl.NumberFormat('es-US', { style: 'currency', currency: acc.currency }).format(absoluteChange);
            const balanceFormat = new Intl.NumberFormat('es-US', { style: 'currency', currency: acc.currency }).format(acc.current_balance);

            return (
              <div
                key={acc.id}
                style={{ borderColor: isSelected ? acc.color || '#ebd7ff' : '#c084fc30' }}
                className={`flex flex-col bg-[#180e22] border rounded-2xl p-5 hover:scale-[1.01] transition-all relative ${isSelected ? 'shadow-xl shadow-purple-500/10 bg-[#1f112c]' : 'border-[#c084fc]/15 hover:border-[#c084fc]/30'}`}
              >
                {/* Account Type Ribbon */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    style={{ backgroundColor: `${acc.color || '#ebd7ff'}20`, color: acc.color || '#ebd7ff' }}
                    className="text-[9.5px] font-mono font-bold uppercase tracking-widest py-1 px-3 rounded-full"
                  >
                    {acc.type === 'funded' ? 'Fondeo' : acc.type === 'demo' ? 'Simulada' : acc.type === 'personal' ? 'Personal' : 'Otros'}
                  </span>

                  <span className="text-[10px] font-mono text-purple-400/50 uppercase">
                    {acc.broker}
                  </span>
                </div>

                {/* Account Name */}
                <h3 className="font-display font-semibold text-sm text-slate-100 leading-tight">
                  {acc.name}
                </h3>
                {acc.account_number && (
                  <span className="text-[10px] font-mono text-purple-400/50 mt-1 block">
                    N°: {acc.account_number}
                  </span>
                )}

                {/* Metrics */}
                <div className="mt-5 space-y-2.5 flex-grow border-t border-purple-950/30 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-purple-400/60">Balance Inicial:</span>
                    <span className="text-xs font-mono text-purple-300">
                      {new Intl.NumberFormat('es-US', { style: 'currency', currency: acc.currency }).format(acc.initial_balance)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-purple-400/60">Balance Actual:</span>
                    <span className={`text-xs font-semibold font-mono ${acc.current_balance >= acc.initial_balance ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {balanceFormat}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-purple-400/60">PnL Neto Total:</span>
                    <span className={`text-xs font-bold font-mono ${absoluteChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {absoluteChange >= 0 ? '+' : ''}{profitFormat} ({percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* Actions Panel */}
                <div className="flex gap-2 items-center justify-between mt-5 pt-3.5 border-t border-purple-950/30">
                  <button
                    onClick={() => onSelectAccount(acc.id)}
                    className={`text-[10px] uppercase font-mono font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#9333ea] to-[#db2777] text-white'
                        : 'bg-[#12071a] border border-purple-950/40 text-purple-300/60 hover:text-[#ebd7ff]'
                    }`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5" /> : null} Set Activa
                  </button>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleStartEdit(acc)}
                      className="p-2 rounded-lg bg-[#12071a] border border-purple-950/40 text-purple-400 hover:text-fuchsia-400 hover:border-fuchsia-500/20 cursor-pointer transition-colors"
                      title="Editar Cuenta"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id, acc.name)}
                      className="p-2 rounded-lg bg-[#12071a] border border-purple-950/40 text-purple-400 hover:text-rose-400 hover:border-rose-500/20 cursor-pointer transition-colors"
                      title="Eliminar Cuenta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
