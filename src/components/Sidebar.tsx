import React from 'react';
import { 
  BarChart3, 
  BookOpen, 
  Calendar as CalendarIcon, 
  FolderLock, 
  UploadCloud, 
  LogOut, 
  User, 
  DollarSign,
  TrendingUp,
  Briefcase
} from 'lucide-react';
import { Account } from '../types';
import { AppLogo } from './AppLogo';

interface SidebarProps {
  accounts: Account[];
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;
  activeTab: 'dashboard' | 'journal' | 'calendar' | 'accounts';
  setActiveTab: (tab: 'dashboard' | 'journal' | 'calendar' | 'accounts') => void;
  userProfile: { name: string; email: string } | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  accounts,
  activeAccountId,
  setActiveAccountId,
  activeTab,
  setActiveTab,
  userProfile,
  onLogout
}) => {
  const activeAccount = accounts.find(a => a.id === activeAccountId);

  return (
    <aside id="sidebar-panel" className="w-64 bg-[#11091a] border-r border-[#c084fc]/10 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Brand Header */}
      <div id="brand-header" className="p-6 border-b border-[#c084fc]/10 flex items-center gap-3">
        <AppLogo size={36} />
        <div>
          <h1 id="brand-title" className="font-display font-bold text-lg leading-none tracking-tight text-slate-100">
            Tradyum
          </h1>
          <span id="brand-subtitle" className="text-[10px] font-mono uppercase tracking-wider text-purple-400/70">
            Professional Journal
          </span>
        </div>
      </div>

      {/* Global Account Selector */}
      <div id="account-selector-container" className="px-4 py-4 border-b border-[#c084fc]/10">
        <label id="account-selector-label" className="block text-[10px] font-mono uppercase text-purple-300/50 tracking-wider mb-2 px-1">
          Historial de Cuenta
        </label>
        <div id="account-selector-inner" className="relative">
          <select
            id="global-account-select"
            value={activeAccountId || ''}
            onChange={(e) => setActiveAccountId(e.target.value || null)}
            className="w-full bg-[#181022] border border-[#c084fc]/15 focus:border-[#d946ef] rounded-xl px-3.5 py-2.5 text-xs text-[#ebd7ff] focus:outline-none focus:ring-1 focus:ring-[#d946ef] font-sans transition-all appearance-none cursor-pointer"
          >
            <option value="">Todas las cuentas</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.type.toUpperCase()})
              </option>
            ))}
          </select>
          <div id="select-dropdown-indicator" className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-purple-400/60 text-[10px]">
            ▼
          </div>
        </div>

        {activeAccount && (
          <div id="active-account-pill" className="mt-3 flex items-center justify-between bg-[#181022]/60 p-2.5 rounded-xl border border-[#c084fc]/10">
            <span id="active-account-balance-label" className="text-[11px] text-[#ccc3db]/70">Balance Actual:</span>
            <span id="active-account-balance-val" className={`text-xs font-semibold font-mono ${activeAccount.current_balance >= activeAccount.initial_balance ? 'text-emerald-400' : 'text-rose-400'}`}>
              {new Intl.NumberFormat('es-US', { style: 'currency', currency: activeAccount.currency || 'USD' }).format(activeAccount.current_balance)}
            </span>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav id="sidebar-navigation" className="flex-1 px-3 py-4 space-y-1">
        <button
          id="nav-tab-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium font-display transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-[#c084fc]/10 text-[#f5f3ff] border-l-4 border-[#c084fc] font-semibold font-bold'
              : 'text-purple-300/60 hover:bg-[#1a1024] hover:text-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Dashboard General
        </button>

        <button
          id="nav-tab-journal"
          onClick={() => setActiveTab('journal')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium font-display transition-all cursor-pointer ${
            activeTab === 'journal'
              ? 'bg-[#c084fc]/10 text-[#f5f3ff] border-l-4 border-[#c084fc] font-semibold font-bold'
              : 'text-purple-300/60 hover:bg-[#1a1024] hover:text-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Bitácora (Journal)
        </button>

        <button
          id="nav-tab-calendar"
          onClick={() => setActiveTab('calendar')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium font-display transition-all cursor-pointer ${
            activeTab === 'calendar'
              ? 'bg-[#c084fc]/10 text-[#f5f3ff] border-l-4 border-[#c084fc] font-semibold font-bold'
              : 'text-purple-300/60 hover:bg-[#1a1024] hover:text-slate-100'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          Calendario
        </button>

        <button
          id="nav-tab-accounts"
          onClick={() => setActiveTab('accounts')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium font-display transition-all cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-[#c084fc]/10 text-[#f5f3ff] border-l-4 border-[#c084fc] font-semibold font-bold'
              : 'text-purple-300/60 hover:bg-[#1a1024] hover:text-slate-100'
          }`}
        >
          <FolderLock className="w-4 h-4" />
          Cuentas de Trading
        </button>


      </nav>

      {/* User Session Footer */}
      <div id="sidebar-footer" className="p-4 border-t border-[#c084fc]/10 flex flex-col gap-3">
        {userProfile ? (
          <div id="user-profile-widget" className="flex flex-col gap-2 bg-[#181022] p-3 rounded-xl border border-[#c084fc]/15">
            <div id="user-profile-main" className="flex items-center gap-2.5">
              <div id="user-avatar-placeholder" className="w-7 h-7 rounded-lg bg-[#c084fc]/20 text-[#c084fc] flex items-center justify-center font-bold text-xs uppercase">
                <User className="w-3.5 h-3.5" />
              </div>
              <div id="user-meta" className="overflow-hidden">
                <p id="user-profile-name" className="text-xs font-semibold text-[#ebd7ff] truncate leading-tight">
                  {userProfile.name}
                </p>
                <span id="user-profile-email" className="text-[9.5px] font-mono text-purple-400/50 truncate block">
                  {userProfile.email}
                </span>
              </div>
            </div>

            <button
              id="user-logout-btn"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-1 rounded-lg text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-purple-950/40 transition-colors font-mono cursor-pointer"
            >
              <LogOut className="w-3 h-3" /> Cerrar Sesión
            </button>
          </div>
        ) : (
          <div id="guest-notice" className="text-center p-3 text-[10px] font-mono text-purple-400/40 leading-normal">
            Modo offline activo
          </div>
        )}
      </div>
    </aside>
  );
};
