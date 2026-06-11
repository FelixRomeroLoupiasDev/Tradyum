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
          <div className="relative inline-block select-none group">
            {/* Ambient Glow */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#c084fc] via-[#6366f1] to-[#38bdf8] opacity-75 blur-md group-hover:opacity-100 group-hover:blur-lg transition duration-500 animate-pulse" />
            {/* Border Gradient Container */}
            <div className="absolute inset-0 rounded-full p-[1.5px] bg-gradient-to-r from-[#c084fc] via-[#6366f1] to-[#38bdf8]" />
            {/* Main Button */}
            <button
              id="create-account-btn"
              onClick={() => { resetForm(); setEditingAccId(null); setIsCreating(true); }}
              className="relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#08020e] text-slate-100 hover:text-white text-xs font-semibold tracking-wide cursor-pointer transition-colors duration-300 shadow-2xl"
              style={{
                boxShadow: 'inset 0 0 10px rgba(168, 85, 247, 0.2)',
              }}
            >
              {/* Mini background sparkles */}
              <div className="absolute inset-0 rounded-full overflow-hidden opacity-45 pointer-events-none">
                <div className="absolute top-1 left-4 w-1 h-1 bg-white rounded-full animate-ping [animation-delay:0.2s]" />
                <div className="absolute top-2 right-6 w-0.5 h-0.5 bg-white rounded-full animate-ping [animation-delay:0.7s]" />
                <div className="absolute bottom-1 left-8 w-0.5 h-0.5 bg-white rounded-full animate-ping [animation-delay:1.2s]" />
                <div className="absolute top-1.5 right-12 w-1.5 h-1.5 bg-pink-400/20 rounded-full animate-ping [animation-delay:1.8s]" />
              </div>
              
              <span className="text-sm font-bold text-[#c084fc] group-hover:scale-125 transition duration-300">+</span>
              <span className="font-semibold tracking-wider">Nueva Cuenta</span>
            </button>
          </div>
        )}
      </div>

      {isCreating ? (
        /* Account creation form */
        <form id="account-form" onSubmit={handleSubmit} className="bg-[#180e22] border border-[#c084fc]/15 rounded-2xl p-6 glow-blue max-w-2xl space-y-5">
          <div id="account-form-header" className="flex items-center justify-between pb-3 border-b border-purple-950/30">
            <h3 id="account-form-title" className="font-display font-semibold text-slate-100 text-sm">
              {editingAccId ? 'Editar Cuenta' : 'Nueva Cuenta'}
            </h3>
            <button
              id="cancel-form-icon-btn"
              type="button"
              onClick={() => { setIsCreating(false); resetForm(); }}
              className="p-1.5 rounded-lg bg-[#12071a] border border-purple-950/40 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div id="account-form-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nombre *</label>
              <input
                type="text"
                placeholder="ej. Fondeo FTMO, Demo..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] focus:outline-none rounded-xl py-2.5 px-3.5 text-xs text-slate-200 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] focus:outline-none rounded-xl py-2.5 px-3.5 text-xs text-slate-200 transition-all font-sans cursor-pointer"
              >
                <option value="funded">Fondeo</option>
                <option value="demo">Demo</option>
                <option value="personal">Personal</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Balance Inicial ($) *</label>
              <input
                type="number"
                placeholder="25000"
                value={initialBalance}
                onChange={(e) => {
                  setInitialBalance(e.target.value);
                  setCurrentBalance(e.target.value);
                }}
                className="w-full bg-[#12071a] border border-[#c084fc]/15 focus:border-[#d946ef] focus:outline-none rounded-xl py-2.5 px-3.5 text-xs text-slate-200 transition-all font-mono"
                required
              />
            </div>
          </div>

          <div id="form-actions" className="flex gap-3 justify-end pt-5 border-t border-purple-950/30 items-center">
            <button
              id="cancel-form-btn-bottom"
              type="button"
              onClick={() => { setIsCreating(false); resetForm(); }}
              className="px-5 py-2.5 bg-[#12071a] hover:bg-[#1e152d] border border-purple-950/40 text-slate-400 hover:text-white rounded-full text-xs font-semibold cursor-pointer transition-all focus:outline-none"
            >
              Cancelar
            </button>
            <div className="relative inline-block select-none group">
              {/* Ambient Glow */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#c084fc] via-[#6366f1] to-[#38bdf8] opacity-75 blur-md group-hover:opacity-100 group-hover:blur-lg transition duration-500 animate-pulse" />
              {/* Border Gradient Container */}
              <div className="absolute inset-0 rounded-full p-[1.5px] bg-gradient-to-r from-[#c084fc] via-[#6366f1] to-[#38bdf8]" />
              {/* Main Button */}
              <button
                id="submit-account-btn"
                type="submit"
                disabled={isSubmitting}
                className="relative flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#08020e] text-slate-100 hover:text-white text-xs font-semibold tracking-wide cursor-pointer transition-colors duration-300 shadow-2xl disabled:opacity-50"
                style={{
                  boxShadow: 'inset 0 0 10px rgba(168, 85, 247, 0.2)',
                }}
              >
                {/* Mini background sparkles */}
                <div className="absolute inset-0 rounded-full overflow-hidden opacity-45 pointer-events-none">
                  <div className="absolute top-1 left-4 w-1 h-1 bg-white rounded-full animate-ping [animation-delay:0.2s]" />
                  <div className="absolute top-2 right-6 w-0.5 h-0.5 bg-white rounded-full animate-ping [animation-delay:0.7s]" />
                  <div className="absolute bottom-1 left-8 w-0.5 h-0.5 bg-white rounded-full animate-ping [animation-delay:1.2s]" />
                  <div className="absolute top-1.5 right-12 w-1.5 h-1.5 bg-pink-400/20 rounded-full animate-ping [animation-delay:1.8s]" />
                </div>
                
                <span className="text-sm font-bold text-[#c084fc] group-hover:scale-125 transition duration-300">
                  {editingAccId ? '✓' : '+'}
                </span>
                <span className="font-semibold tracking-wider">
                  {isSubmitting ? 'Guardando...' : editingAccId ? 'Actualizar Cuenta' : 'Crear Cuenta'}
                </span>
              </button>
            </div>
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
