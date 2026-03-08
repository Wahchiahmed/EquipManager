// src/pages/stock/StockMovements.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowUp, ArrowDown, RefreshCw, AlertTriangle, CheckCircle2,
  X, Search, Filter, Package, ChevronLeft, ChevronRight, Layers,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import api from '@/lib/api';
import LotConsumptionDetails from './../Admin/LotConsumptionDetails';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Mouvement {
  id: number;
  id_produit: number;
  type_mouvement: 'IN' | 'OUT';
  quantite_mouvement: number;
  quantite_avant: number;
  quantite_apres: number;
  date_mouvement: string;
  created_at: string;
  note: string | null;
  id_demande: number | null;
  produit: { id_produit: number; nom_produit: string; reference: string | null } | null;
  user: { id: number; prenom: string; nom: string } | null;
}

interface StatsData {
  par_mois: { mois: number; entrees: number; sorties: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ msg: string; type: 'success' | 'error'; onClose: () => void }> = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-semibold ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
    {type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
    <span>{msg}</span>
    <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
  </div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}</span>
          <span className="font-bold text-gray-900 dark:text-white ml-auto pl-4">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const StockMovements: React.FC = () => {
  const [mouvements, setMouvements]   = useState<Mouvement[]>([]);
  const [stats, setStats]             = useState<StatsData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState<'all' | 'IN' | 'OUT'>('all');
  const [page, setPage]               = useState(1);
  const [lastPage, setLastPage]       = useState(1);
  const [total, setTotal]             = useState(0);
  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchData = useCallback(async (p = 1, silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [mRes, sRes] = await Promise.all([
        api.get('/stock/mouvements', { params: { page: p, per_page: 20 } }),
        api.get('/stock/stats'),
      ]);
      const payload = mRes.data;
      if (payload && typeof payload === 'object' && 'data' in payload) {
        setMouvements(payload.data);
        setLastPage(payload.last_page ?? 1);
        setTotal(payload.total ?? payload.data.length);
      } else {
        setMouvements(payload);
        setTotal(payload.length);
      }
      setStats(sRes.data);
    } catch { showToast('Erreur de chargement', 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(page); }, [fetchData, page]);

  const filtered = mouvements.filter(m => {
    const prodNom     = m.produit?.nom_produit ?? '';
    const matchSearch = `${prodNom} ${m.user?.prenom ?? ''} ${m.user?.nom ?? ''} #${m.id_demande ?? ''}`.toLowerCase().includes(search.toLowerCase());
    const matchType   = filterType === 'all' ? true : m.type_mouvement === filterType;
    return matchSearch && matchType;
  });

  const chartData = (stats?.par_mois ?? []).map(m => ({
    mois:    MONTHS[m.mois - 1] ?? `M${m.mois}`,
    entrees: m.entrees,
    sorties: m.sorties,
  }));

  const totalIN  = mouvements.filter(m => m.type_mouvement === 'IN').reduce((s, m) => s + m.quantite_mouvement, 0);
  const totalOUT = mouvements.filter(m => m.type_mouvement === 'OUT').reduce((s, m) => s + m.quantite_mouvement, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Mouvements de stock</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Historique complet des entrées et sorties</p>
          </div>
          <button onClick={() => fetchData(page, true)} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* KPIs */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total mouvements', value: total,    color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30', icon: Package  },
              { label: 'Entrées (page)',   value: totalIN,  color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30',  icon: ArrowUp  },
              { label: 'Sorties (page)',   value: totalOUT, color: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-900/30',      icon: ArrowDown },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4">Entrées / Sorties par mois</h3>
            {loading ? (
              <div className="h-[180px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">Pas encore de données</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.15)" />
                  <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="entrees" name="Entrées" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3 }} />
                  <Line type="monotone" dataKey="sorties" name="Sorties" stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4">Flux net mensuel (Entrées − Sorties)</h3>
            {loading ? (
              <div className="h-[180px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">Pas encore de données</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData.map(d => ({ ...d, net: d.entrees - d.sorties }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netPositive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.15)" />
                  <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="net" name="Flux net" stroke="#10b981" strokeWidth={2} fill="url(#netPositive)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Produit, utilisateur, demande..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-52" />
          </div>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg ml-auto">
            {[{ key: 'all', label: 'Tous' }, { key: 'IN', label: 'Entrées' }, { key: 'OUT', label: 'Sorties' }].map(opt => (
              <button key={opt.key} onClick={() => setFilterType(opt.key as any)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filterType === opt.key ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Movements list */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Filter className="w-8 h-8 text-gray-300 mb-3" />
              <p className="font-semibold text-gray-600 dark:text-gray-300">Aucun mouvement trouvé</p>
              <p className="text-sm text-gray-400 mt-1">Essayez un autre filtre</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filtered.map(m => (
                <div key={m.id} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Type indicator */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${m.type_mouvement === 'IN' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                      {m.type_mouvement === 'IN'
                        ? <ArrowUp className="w-5 h-5 text-green-600" />
                        : <ArrowDown className="w-5 h-5 text-red-500" />}
                    </div>

                    {/* Product & meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {m.produit?.nom_produit ?? `Produit #${m.id_produit}`}
                        </p>
                        {m.produit?.reference && (
                          <span className="text-[11px] font-mono text-gray-400 border border-gray-200 dark:border-gray-600 px-1.5 rounded">{m.produit.reference}</span>
                        )}
                        {m.id_demande && (
                          <span className="text-[11px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 px-1.5 py-0.5 rounded">
                            Demande #{m.id_demande}
                          </span>
                        )}
                        {/* FIFO badge visible indicator for OUT rows */}
                        {m.type_mouvement === 'OUT' && (
                          <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Layers className="w-2.5 h-2.5" /> FIFO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmt(m.date_mouvement ?? m.created_at)}
                        {m.user && ` · ${m.user.prenom} ${m.user.nom}`}
                        {m.note && <span className="italic ml-2">"{m.note}"</span>}
                      </p>

                      {/* ── FIFO: lots consommés (lazy-loaded, collapsible) ── */}
                      {m.type_mouvement === 'OUT' && (
                        <LotConsumptionDetails
                          mouvementId={m.id}
                          endpointPrefix="/stock"
                          compact={true}
                          defaultOpen={false}
                        />
                      )}
                    </div>

                    {/* Stock change */}
                    <div className="text-right shrink-0">
                      <p className={`text-base font-extrabold ${m.type_mouvement === 'IN' ? 'text-green-600' : 'text-red-500'}`}>
                        {m.type_mouvement === 'IN' ? '+' : '−'}{m.quantite_mouvement}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <span className="font-mono">{m.quantite_avant}</span>
                        <span className="mx-1 text-gray-300">→</span>
                        <span className="font-mono font-semibold text-gray-600 dark:text-gray-300">{m.quantite_apres}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-400">
                Page <strong>{page}</strong> / {lastPage} · {total} mouvement{total > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" /> Préc.
                </button>
                <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page === lastPage}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  Suiv. <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default StockMovements;