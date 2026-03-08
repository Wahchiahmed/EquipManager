// src/pages/stock/StockRequests.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Check, X, Package, AlertTriangle, RefreshCw, CheckCircle2,
  Truck, Eye, CheckCheck, MinusCircle,
  Loader2, ChevronDown, ChevronUp, Search,
} from 'lucide-react';
import api from '@/lib/api';
import LotConsumptionDetails from './../Admin/LotConsumptionDetails';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DetailLigne {
  id_detail: number;
  id_produit: number;
  nom: string | null;
  reference: string | null;
  quantite: number;
  quantite_dispo: number;
  statut: 'en_attente' | 'accepte' | 'refuse';
  commentaire_stock: string | null;
}
interface Demande {
  id_demande: number;
  date_demande: string;
  statut: string;
  commentaire: string | null;
  demandeur: { id: number; nom: string; prenom: string; departement: { nom: string } | null } | null;
  details: DetailLigne[];
  date_validation_dept: string | null;
  date_validation_stock: string | null;
  responsable_dept: string | null;
  responsable_stock: string | null;
}
interface LigneDecision {
  id_detail: number;
  statut: 'en_attente' | 'accepte' | 'refuse';
  commentaire_stock: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Statuts où les lots ont déjà été consommés
const STATUTS_AVEC_LOTS = ['VALIDEE', 'PARTIELLEMENT_VALIDEE', 'LIVREE', 'REFUSEE_STOCK'];

const DEMANDE_STATUS: Record<string, { label: string; cls: string }> = {
  EN_ATTENTE_DEPT:       { label: 'Att. Dept',  cls: 'bg-amber-100 text-amber-800'  },
  EN_ATTENTE_STOCK:      { label: 'Att. Stock', cls: 'bg-purple-100 text-purple-800' },
  VALIDEE:               { label: 'Validée',    cls: 'bg-green-100 text-green-800'   },
  PARTIELLEMENT_VALIDEE: { label: 'Partielle',  cls: 'bg-blue-100 text-blue-800'     },
  LIVREE:                { label: 'Livrée',     cls: 'bg-teal-100 text-teal-800'     },
  REFUSEE_STOCK:         { label: 'Ref. Stock', cls: 'bg-red-100 text-red-800'       },
  REFUSEE_DEPT:          { label: 'Ref. Dept',  cls: 'bg-red-100 text-red-800'       },
};

const LIGNE_STATUS: Record<string, { label: string; rowCls: string; dotCls: string }> = {
  en_attente: { label: 'En attente', rowCls: 'border-amber-200 bg-amber-50/40', dotCls: 'bg-amber-400' },
  accepte:    { label: 'Accepté',   rowCls: 'border-green-200 bg-green-50/60', dotCls: 'bg-green-500' },
  refuse:     { label: 'Refusé',    rowCls: 'border-red-200 bg-red-50/60',     dotCls: 'bg-red-500'   },
};

// ─── Shared Components ────────────────────────────────────────────────────────
const DemandeBadge: React.FC<{ status: string }> = ({ status }) => {
  const c = DEMANDE_STATUS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${c.cls}`}>{c.label}</span>;
};

const LigneBadge: React.FC<{ statut: string }> = ({ statut }) => {
  const c = LIGNE_STATUS[statut];
  if (!c) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold">
      <span className={`w-1.5 h-1.5 rounded-full ${c.dotCls}`} />
      {c.label}
    </span>
  );
};

const Toast: React.FC<{ msg: string; type: 'success' | 'error'; onClose: () => void }> = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-semibold ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
    {type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
    <span>{msg}</span>
    <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
  </div>
);

// ─── Per-Line Decision Modal ──────────────────────────────────────────────────
const DemandeModal: React.FC<{
  demande: Demande;
  onClose: () => void;
  onUpdated: (d: Demande) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ demande, onClose, onUpdated, showToast }) => {
  const canEdit   = demande.statut === 'EN_ATTENTE_STOCK';
  const canLivrer = demande.statut === 'VALIDEE' || demande.statut === 'PARTIELLEMENT_VALIDEE';
  const hasLots   = STATUTS_AVEC_LOTS.includes(demande.statut);

  const [decisions, setDecisions] = useState<LigneDecision[]>(() =>
    demande.details.map(d => ({
      id_detail: d.id_detail,
      statut: d.statut,
      commentaire_stock: d.commentaire_stock ?? '',
    }))
  );
  const [submitting, setSubmitting]   = useState(false);
  const [confirmLivrer, setConfirmLivrer] = useState(false);

  const pendingCount = decisions.filter(d => d.statut === 'en_attente').length;
  const accepteCount = decisions.filter(d => d.statut === 'accepte').length;
  const refuseCount  = decisions.filter(d => d.statut === 'refuse').length;
  const allDecided   = pendingCount === 0;
  const missingMotif = decisions.some(d => d.statut === 'refuse' && !d.commentaire_stock.trim());

  const setLigneStatut  = (id: number, statut: 'accepte' | 'refuse') =>
    setDecisions(p => p.map(d => d.id_detail === id ? { ...d, statut } : d));
  const setLigneComment = (id: number, val: string) =>
    setDecisions(p => p.map(d => d.id_detail === id ? { ...d, commentaire_stock: val } : d));
  const acceptAll = () => setDecisions(p => p.map(d => ({ ...d, statut: 'accepte' as const })));
  const refuseAll = () => setDecisions(p => p.map(d => ({ ...d, statut: 'refuse' as const })));

  const handleSubmitLignes = async () => {
    if (!allDecided) { showToast('Traitez toutes les lignes avant de confirmer.', 'error'); return; }
    if (missingMotif) { showToast('Ajoutez un motif pour chaque ligne refusée.', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await api.post(`/stock/demandes/${demande.id_demande}/valider-lignes`, {
        lignes: decisions.map(d => ({
          id_detail: d.id_detail,
          statut: d.statut,
          commentaire_stock: d.commentaire_stock || undefined,
        })),
      });
      onUpdated(res.data.demande as Demande);
      const msg = refuseCount === 0
        ? `✓ Demande validée — ${accepteCount} ligne(s) acceptée(s)`
        : accepteCount === 0 ? `Demande refusée`
        : `Validation partielle : ${accepteCount} acceptée(s), ${refuseCount} refusée(s)`;
      showToast(msg, 'success');
      onClose();
    } catch (e: any) {
      showToast(e.response?.data?.message ?? 'Erreur lors de la validation', 'error');
    } finally { setSubmitting(false); }
  };

  const handleLivrer = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/stock/demandes/${demande.id_demande}/livrer`);
      onUpdated(res.data.demande as Demande);
      showToast('Demande marquée comme livrée 🚚');
      onClose();
    } catch (e: any) {
      showToast(e.response?.data?.message ?? 'Erreur', 'error');
    } finally { setSubmitting(false); }
  };

  const summaryLabel = !allDecided
    ? `${pendingCount} ligne(s) à traiter`
    : refuseCount === 0  ? 'Toutes les lignes seront acceptées → VALIDÉE'
    : accepteCount === 0 ? 'Toutes les lignes seront refusées → REFUSÉE'
    :                       `${accepteCount} acceptée(s) + ${refuseCount} refusée(s) → PARTIELLE`;

  const summaryColor = !allDecided ? 'bg-amber-50 border-amber-200 text-amber-800'
    : refuseCount === 0  ? 'bg-green-50 border-green-200 text-green-800'
    : accepteCount === 0 ? 'bg-red-50 border-red-200 text-red-800'
    :                       'bg-blue-50 border-blue-200 text-blue-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-foreground">Demande #{demande.id_demande}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {demande.demandeur?.prenom} {demande.demandeur?.nom}
              {demande.demandeur?.departement && ` · ${demande.demandeur.departement.nom}`}
              {` · ${fmt(demande.date_demande)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DemandeBadge status={demande.statut} />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {canEdit && (
            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs text-muted-foreground mr-auto font-medium">Actions rapides :</span>
              <button onClick={acceptAll} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
                <CheckCheck className="w-3.5 h-3.5" /> Tout accepter
              </button>
              <button onClick={refuseAll} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors">
                <MinusCircle className="w-3.5 h-3.5" /> Tout refuser
              </button>
            </div>
          )}

          {demande.details.map(det => {
            const dec     = decisions.find(d => d.id_detail === det.id_detail)!;
            const stockOk = det.quantite_dispo >= det.quantite;
            const cfg     = LIGNE_STATUS[dec.statut];
            return (
              <div key={det.id_detail} className={`rounded-xl border p-3 space-y-2.5 transition-all ${cfg.rowCls}`}>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{det.nom}</span>
                      {det.reference && <span className="text-[10px] font-mono text-muted-foreground border border-border px-1 rounded">{det.reference}</span>}
                      {!canEdit && <LigneBadge statut={det.statut} />}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs">
                      <span className="text-muted-foreground">Demandé : <strong className="text-foreground">{det.quantite}</strong></span>
                      <span className={`font-semibold flex items-center gap-1 ${stockOk ? 'text-green-600' : 'text-red-500'}`}>
                        Dispo : {det.quantite_dispo}
                        {!stockOk && <AlertTriangle className="w-3 h-3" />}
                      </span>
                    </div>
                    {!canEdit && det.commentaire_stock && (
                      <p className="mt-1 text-[11px] italic text-muted-foreground">"{det.commentaire_stock}"</p>
                    )}
                    {/* ── FIFO: lots consommés par ligne (mode readonly, ligne acceptée) ── */}
                    {!canEdit && det.statut === 'accepte' && hasLots && (
                      <LotConsumptionDetails
                        detailDemandeId={det.id_detail}
                        endpointPrefix="/stock"
                        compact={true}
                        defaultOpen={false}
                      />
                    )}
                  </div>
                  {canEdit && <div className="shrink-0"><LigneBadge statut={dec.statut} /></div>}
                </div>

                {canEdit && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button onClick={() => setLigneStatut(det.id_detail, 'accepte')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${dec.statut === 'accepte' ? 'bg-green-500 text-white border-green-500 shadow-sm' : 'border-border hover:border-green-400 hover:bg-green-50 hover:text-green-700 text-muted-foreground'}`}>
                        <Check className="w-3.5 h-3.5" /> Accepter
                      </button>
                      <button onClick={() => setLigneStatut(det.id_detail, 'refuse')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${dec.statut === 'refuse' ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'border-border hover:border-red-400 hover:bg-red-50 hover:text-red-700 text-muted-foreground'}`}>
                        <X className="w-3.5 h-3.5" /> Refuser
                      </button>
                    </div>
                    {dec.statut === 'refuse' && (
                      <input type="text" autoFocus placeholder="Motif du refus (obligatoire)…" value={dec.commentaire_stock}
                        onChange={e => setLigneComment(det.id_detail, e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200 bg-white placeholder:text-muted-foreground" />
                    )}
                    {dec.statut === 'accepte' && (
                      <input type="text" placeholder="Commentaire optionnel…" value={dec.commentaire_stock}
                        onChange={e => setLigneComment(det.id_detail, e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white placeholder:text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {canEdit && (
            <div className={`text-xs px-3 py-2.5 rounded-lg border font-medium flex items-center gap-2 ${summaryColor}`}>
              <span>{summaryLabel}</span>
            </div>
          )}

          {/* ── FIFO: résumé global de consommation de lots pour la demande entière ── */}
          {!canEdit && hasLots && (
            <div className="pt-1 border-t border-border/60">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 mt-3">
                Résumé FIFO — consommation globale
              </p>
              <LotConsumptionDetails
                demandeId={demande.id_demande}
                endpointPrefix="/stock"
                compact={false}
                defaultOpen={false}
              />
            </div>
          )}

          {canLivrer && confirmLivrer && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm text-teal-800 font-medium flex items-center gap-2">
              <Truck className="w-4 h-4 shrink-0" />
              Confirmer la livraison ? Le demandeur recevra les articles acceptés.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 space-y-2">
          {canEdit && (
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">Annuler</button>
              <button onClick={handleSubmitLignes} disabled={submitting || !allDecided || missingMotif}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {submitting ? 'Enregistrement…' : 'Valider la décision'}
              </button>
            </div>
          )}
          {canLivrer && !confirmLivrer && (
            <button onClick={() => setConfirmLivrer(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors">
              <Truck className="w-4 h-4" /> Marquer comme livrée
            </button>
          )}
          {canLivrer && confirmLivrer && (
            <div className="flex gap-3">
              <button onClick={() => setConfirmLivrer(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted">← Retour</button>
              <button onClick={handleLivrer} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmer la livraison
              </button>
            </div>
          )}
          {!canEdit && !canLivrer && (
            <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Filter pills ─────────────────────────────────────────────────────────────
const FILTER_OPTS = [
  { key: 'EN_ATTENTE_STOCK',      label: 'À valider'  },
  { key: 'VALIDEE',               label: 'Validées'   },
  { key: 'PARTIELLEMENT_VALIDEE', label: 'Partielles' },
  { key: 'LIVREE',                label: 'Livrées'    },
  { key: 'REFUSEE_STOCK',         label: 'Refusées'   },
  { key: 'all',                   label: 'Toutes'     },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
const StockRequests: React.FC = () => {
  const [demandes, setDemandes]           = useState<Demande[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [filterStatut, setFilterStatut]   = useState('EN_ATTENTE_STOCK');
  const [search, setSearch]               = useState('');
  const [activeDemande, setActiveDemande] = useState<Demande | null>(null);
  const [toast, setToast]                 = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [expanded, setExpanded]           = useState<number | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const r = await api.get('/stock/demandes');
      setDemandes(r.data?.data ?? r.data);
    } catch { showToast('Erreur de chargement', 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdated = (updated: Demande) => {
    setDemandes(prev => prev.map(d => d.id_demande === updated.id_demande ? updated : d));
  };

  const filtered = demandes.filter(d => {
    const nom         = `${d.demandeur?.prenom ?? ''} ${d.demandeur?.nom ?? ''}`;
    const matchSearch = `${nom} #${d.id_demande}`.toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === 'all' ? true : d.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const pendingCount   = demandes.filter(d => d.statut === 'EN_ATTENTE_STOCK').length;
  const toDeliverCount = demandes.filter(d => ['VALIDEE','PARTIELLEMENT_VALIDEE'].includes(d.statut)).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Demandes de stock</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Validez les demandes ligne par ligne
              {pendingCount > 0    && <span className="ml-2 font-semibold text-purple-600">· {pendingCount} à valider</span>}
              {toDeliverCount > 0  && <span className="ml-2 font-semibold text-teal-600">· {toDeliverCount} à livrer</span>}
            </p>
          </div>
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* Delivery alert */}
        {!loading && toDeliverCount > 0 && (
          <div className="flex items-center gap-3 px-5 py-3.5 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 rounded-2xl">
            <Truck className="w-5 h-5 text-teal-500 shrink-0" />
            <span className="text-sm font-semibold text-teal-800 dark:text-teal-300">
              {toDeliverCount} demande{toDeliverCount > 1 ? 's' : ''} validée{toDeliverCount > 1 ? 's' : ''} en attente de livraison
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30 w-40" />
          </div>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {FILTER_OPTS.map(opt => {
              const count = opt.key === 'all' ? demandes.length : demandes.filter(d => d.statut === opt.key).length;
              return (
                <button key={opt.key} onClick={() => setFilterStatut(opt.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${filterStatut === opt.key ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                  {opt.label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filterStatut === opt.key ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <p className="font-semibold text-gray-700 dark:text-gray-200">{search ? 'Aucun résultat' : 'Aucune demande'}</p>
              <p className="text-sm text-gray-400 mt-1">{search ? 'Essayez un autre terme' : 'Aucune demande pour ce filtre'}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(d => {
                const insufficient = d.details.some(det => det.quantite_dispo < det.quantite);
                const isOpen        = expanded === d.id_demande;
                const isPending     = d.statut === 'EN_ATTENTE_STOCK';
                const isToDeliver   = ['VALIDEE','PARTIELLEMENT_VALIDEE'].includes(d.statut);

                return (
                  <div key={d.id_demande} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <div className="flex items-start gap-4 px-5 py-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isToDeliver ? 'bg-teal-100 dark:bg-teal-900/40' : isPending ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        {isToDeliver
                          ? <Truck className="w-4 h-4 text-teal-600" />
                          : <Package className={`w-4 h-4 ${isPending ? 'text-purple-600' : 'text-gray-500'}`} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">#{d.id_demande}</span>
                          <DemandeBadge status={d.statut} />
                          {insufficient && isPending && (
                            <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Stock insuffisant
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {d.demandeur?.prenom} {d.demandeur?.nom}
                          {d.demandeur?.departement && ` · ${d.demandeur.departement.nom}`}
                          {` · ${fmt(d.date_demande)}`}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {d.details.map((det, i) => (
                            <span key={i} className={`text-xs px-2 py-1 rounded-md font-medium border ${
                              det.statut === 'accepte' ? 'bg-green-50 border-green-200 text-green-700'
                              : det.statut === 'refuse' ? 'bg-red-50 border-red-200 text-red-600 line-through'
                              : det.quantite_dispo < det.quantite ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                            }`}>
                              {det.quantite}× {det.nom}
                              {det.quantite_dispo < det.quantite && isPending && ` (${det.quantite_dispo} dispo)`}
                            </span>
                          ))}
                        </div>

                        {isOpen && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl space-y-2 text-xs">
                            {d.details.map(det => (
                              <div key={det.id_detail} className="flex items-center justify-between">
                                <span className="text-gray-700 dark:text-gray-300 font-medium">{det.nom}</span>
                                <div className="flex items-center gap-3 text-gray-500">
                                  <span>Demandé: <strong className="text-gray-800 dark:text-gray-200">{det.quantite}</strong></span>
                                  <span className={det.quantite_dispo < det.quantite ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>
                                    Dispo: {det.quantite_dispo}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${LIGNE_STATUS[det.statut]?.rowCls ?? 'bg-gray-100'}`}>
                                    {LIGNE_STATUS[det.statut]?.label ?? det.statut}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {d.commentaire && <p className="italic text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-2">"{d.commentaire}"</p>}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isPending && (
                          <button onClick={() => setActiveDemande(d)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                            <Eye className="w-3 h-3" /> Traiter
                          </button>
                        )}
                        {isToDeliver && (
                          <button onClick={() => setActiveDemande(d)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors">
                            <Truck className="w-3 h-3" /> Livrer
                          </button>
                        )}
                        {!isPending && !isToDeliver && (
                          <button onClick={() => setActiveDemande(d)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
                            <Eye className="w-3 h-3" /> Voir
                          </button>
                        )}
                        <button onClick={() => setExpanded(isOpen ? null : d.id_demande)}
                          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                          {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
              {filtered.length} demande{filtered.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {activeDemande && (
        <DemandeModal demande={activeDemande} onClose={() => setActiveDemande(null)} onUpdated={handleUpdated} showToast={showToast} />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default StockRequests;