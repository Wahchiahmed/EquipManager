import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Package, Plus, ArrowUp, RefreshCw,
  CheckCircle2, X, MessageSquare, Loader2, TrendingDown,
  ShieldAlert, Search,
} from 'lucide-react';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Produit {
  id: number;
  nom: string;
  description: string | null;
  reference: string | null;
  quantite: number;
  seuil_alerte: number;
  categorie_nom: string | null;
  en_alerte: boolean;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ msg: string; type: 'success' | 'error'; onClose: () => void }> = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-semibold ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
    {type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
    <span>{msg}</span>
    <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
  </div>
);

// ─── Add Stock Modal ──────────────────────────────────────────────────────────
const AddStockModal: React.FC<{
  produits: Produit[];
  preselected?: Produit | null;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ produits, preselected, onClose, onSuccess, showToast }) => {
  const [selProduct, setSelProduct] = useState(preselected ? String(preselected.id) : '');
  const [qty, setQty]               = useState('');
  const [note, setNote]             = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selProd = produits.find(p => p.id === Number(selProduct));

  const handleSubmit = async () => {
    if (!selProduct || !qty) return;
    setSubmitting(true);
    try {
      await api.post('/stock/entree', {
        id_produit: Number(selProduct),
        quantite:   Number(qty),
        note:       note || undefined,
      });
      showToast('Entrée de stock enregistrée ✓', 'success');
      onSuccess();
      onClose();
    } catch (e: any) {
      showToast(e.response?.data?.message ?? "Erreur lors de l'entrée", 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white">Entrée de stock</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">Produit</label>
            <select value={selProduct} onChange={e => setSelProduct(e.target.value)}
              className="w-full text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 bg-white dark:bg-gray-900">
              <option value="">Sélectionner un produit...</option>
              {produits.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nom} {p.en_alerte ? '⚠ ' : ''}(stock : {p.quantite})
                </option>
              ))}
            </select>
          </div>

          {selProd && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl border ${selProd.en_alerte ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800/50' : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:border-green-800/50'}`}>
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span>Stock actuel : <strong>{selProd.quantite}</strong> / seuil : <strong>{selProd.seuil_alerte}</strong></span>
              {selProd.en_alerte && <AlertTriangle className="w-3.5 h-3.5 ml-auto" />}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">Quantité à ajouter</label>
            <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="Ex : 50"
              className="w-full text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white dark:bg-gray-900" />
            {selProd && Number(qty) > 0 && (
              <p className="text-xs text-gray-500 mt-1.5">
                Nouveau stock : <strong className="text-green-600 text-sm">{selProd.quantite + Number(qty)}</strong>
                {selProd.en_alerte && selProd.quantite + Number(qty) >= selProd.seuil_alerte && (
                  <span className="ml-2 text-green-600 font-semibold">✓ Alerte résolue</span>
                )}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Note <span className="text-gray-400 ml-1 font-normal">(optionnel)</span>
            </label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ex : Réception commande fournisseur"
              className="w-full text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white dark:bg-gray-900" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Annuler</button>
          <button onClick={handleSubmit} disabled={!selProduct || !qty || submitting}
            className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Alert Card ───────────────────────────────────────────────────────────────
const AlertCard: React.FC<{ produit: Produit; onRestock: (p: Produit) => void }> = ({ produit, onRestock }) => {
  const pct = Math.min(100, Math.round((produit.quantite / produit.seuil_alerte) * 100));
  const isCritical = produit.quantite === 0;
  const isLow = pct <= 50;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all ${isCritical ? 'border-red-300 dark:border-red-800' : isLow ? 'border-orange-200 dark:border-orange-800/50' : 'border-amber-200 dark:border-amber-800/50'}`}>
      {/* Top */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCritical ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'}`}>
          {isCritical
            ? <ShieldAlert className="w-5 h-5 text-red-600" />
            : <AlertTriangle className="w-5 h-5 text-amber-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{produit.nom}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {produit.categorie_nom ?? '—'}
            {produit.reference && <span className="ml-2 font-mono">{produit.reference}</span>}
          </p>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${isCritical ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
          {isCritical ? 'Rupture' : 'Alerte'}
        </span>
      </div>

      {/* Stock level */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500">Niveau de stock</span>
          <span className={`font-bold ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
            {produit.quantite} / {produit.seuil_alerte} min.
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-500' : isLow ? 'bg-orange-400' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          {isCritical ? '⚠ Rupture de stock' : `Manque ${produit.seuil_alerte - produit.quantite} unité${produit.seuil_alerte - produit.quantite > 1 ? 's' : ''}`}
        </p>
      </div>

      <button onClick={() => onRestock(produit)}
        className="w-full flex items-center justify-center gap-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm">
        <Plus className="w-3.5 h-3.5" /> Réapprovisionner
      </button>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const StockAlerts: React.FC = () => {
  const [produits, setProduits]       = useState<Produit[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [preselected, setPreselected] = useState<Produit | null>(null);
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState<'all' | 'rupture' | 'alerte'>('all');
  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const r = await api.get('/stock/produits');
      setProduits(r.data);
    } catch { showToast('Erreur de chargement', 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRestock = (p: Produit) => { setPreselected(p); setShowModal(true); };
  const handleGlobalAdd = () => { setPreselected(null); setShowModal(true); };

  const alerts   = produits.filter(p => p.en_alerte);
  const ruptures = alerts.filter(p => p.quantite === 0);
  const lowStock = alerts.filter(p => p.quantite > 0);

  const displayed = alerts
    .filter(p => {
      const matchSearch = p.nom.toLowerCase().includes(search.toLowerCase()) || (p.reference ?? '').toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === 'all' ? true : filterType === 'rupture' ? p.quantite === 0 : p.quantite > 0;
      return matchSearch && matchType;
    })
    .sort((a, b) => a.quantite - b.quantite);

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-9xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Alertes de stock</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {loading ? '…' : alerts.length === 0
                ? 'Tous les produits sont bien approvisionnés'
                : `${alerts.length} produit${alerts.length > 1 ? 's' : ''} sous le seuil d'alerte`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchData(true)} disabled={refreshing}
              className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleGlobalAdd}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-sm transition-colors">
              <Plus className="w-4 h-4" /> Entrée de stock
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'En alerte',   value: alerts.length,   color: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-900/30',  icon: AlertTriangle },
              { label: 'Rupture',     value: ruptures.length, color: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-900/30',      icon: ShieldAlert },
              { label: 'Stock faible',value: lowStock.length, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: TrendingDown },
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

        {/* No alerts state */}
        {!loading && alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-3xl flex items-center justify-center mb-5">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <p className="text-xl font-bold text-gray-700 dark:text-gray-200">Tout est OK !</p>
            <p className="text-sm text-gray-400 mt-1.5">Aucun produit sous le seuil d'alerte</p>
            <button onClick={handleGlobalAdd} className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" /> Faire une entrée de stock
            </button>
          </div>
        )}

        {/* Filters */}
        {!loading && alerts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Rechercher un produit..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none w-44" />
            </div>
            <div className="flex gap-1.5 ml-auto">
              {[
                { key: 'all',     label: `Tous (${alerts.length})` },
                { key: 'rupture', label: `Rupture (${ruptures.length})` },
                { key: 'alerte',  label: `Faible (${lowStock.length})` },
              ].map(opt => (
                <button key={opt.key} onClick={() => setFilterType(opt.key as any)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterType === opt.key ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid of alert cards */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 h-44 animate-pulse" />
            ))}
          </div>
        ) : displayed.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map(p => (
              <AlertCard key={p.id} produit={p} onRestock={handleRestock} />
            ))}
          </div>
        ) : search ? (
          <div className="text-center py-12 text-sm text-gray-400">Aucun résultat pour "{search}"</div>
        ) : null}

        {/* All products table (non-alert) */}
        {!loading && alerts.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Produits OK ({produits.filter(p => !p.en_alerte).length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50">
                    {['Produit', 'Catégorie', 'Stock', 'Seuil'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {produits.filter(p => !p.en_alerte).map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.nom}</p>
                        {p.reference && <p className="text-xs font-mono text-gray-400">{p.reference}</p>}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{p.categorie_nom ?? '—'}</td>
                      <td className="px-5 py-3 text-sm font-bold text-green-600">{p.quantite}</td>
                      <td className="px-5 py-3 text-xs text-gray-400">{p.seuil_alerte}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <AddStockModal
          produits={produits}
          preselected={preselected}
          onClose={() => { setShowModal(false); setPreselected(null); }}
          onSuccess={() => fetchData(true)}
          showToast={showToast}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default StockAlerts;