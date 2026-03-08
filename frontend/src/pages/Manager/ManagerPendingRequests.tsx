import React, { useState, useEffect, useCallback } from 'react';
import {
  Check, X, Clock, Package, User, Calendar, MessageSquare,
  RefreshCw, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Eye, Loader2, Filter, Search, Building2,
} from 'lucide-react';
import axios from 'axios';

// ─── API ──────────────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Detail {
  id_detail: number;
  id_produit: number;
  produit?: { nom?: string; nom_produit?: string };
  nom?: string;
  quantite: number;
  statut?: string;
}
interface Demande {
  id_demande: number;
  date_demande: string;
  statut: string;
  commentaire: string | null;
  demandeur?: { prenom: string; nom: string; email?: string; departement?: { nom: string } | null } | null;
  demandeur_nom?: string;
  demandeur_prenom?: string;
  departement_nom?: string;
  details: Detail[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const getProduitNom = (d: Detail) =>
  d.produit?.nom ?? d.produit?.nom_produit ?? d.nom ?? `Produit #${d.id_produit}`;

const getDemandeurNom = (d: Demande) =>
  d.demandeur ? `${d.demandeur.prenom} ${d.demandeur.nom}` : `${d.demandeur_prenom ?? ''} ${d.demandeur_nom ?? ''}`.trim() || '—';

const getDemandeurInitials = (d: Demande) => {
  const prenom = d.demandeur?.prenom ?? d.demandeur_prenom ?? '';
  const nom    = d.demandeur?.nom    ?? d.demandeur_nom    ?? '';
  return `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase();
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ msg: string; type: 'success' | 'error'; onClose: () => void }> = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white text-sm font-semibold transition-all animate-in slide-in-from-bottom-4 ${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
    {type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
  </div>
);

// ─── Action Modal ─────────────────────────────────────────────────────────────
const ActionModal: React.FC<{
  demande: Demande;
  onClose: () => void;
  onApprove: (id: number, comment: string) => Promise<void>;
  onReject: (id: number, comment: string) => Promise<void>;
  submitting: boolean;
}> = ({ demande, onClose, onApprove, onReject, submitting }) => {
  const [comment, setComment] = useState('');
  const [action, setAction]   = useState<'approve' | 'reject' | null>(null);

  const handleSubmit = () => {
    if (action === 'approve') onApprove(demande.id_demande, comment);
    else if (action === 'reject') onReject(demande.id_demande, comment);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">Demande #{demande.id_demande}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Soumise le {fmt(demande.date_demande)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Demande info */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Demandeur</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 ml-auto">{getDemandeurNom(demande)}</span>
            </div>
            {(demande.demandeur?.departement?.nom ?? demande.departement_nom) && (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">Département</span>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 ml-auto">
                  {demande.demandeur?.departement?.nom ?? demande.departement_nom}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Date</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 ml-auto">{fmt(demande.date_demande)}</span>
            </div>

            {/* Articles */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Articles demandés</p>
              <div className="space-y-1.5">
                {demande.details.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-indigo-400 shrink-0" />
                      {getProduitNom(d)}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">×{d.quantite}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Commentaire employé */}
            {demande.commentaire && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className="text-xs text-gray-500 italic">"{demande.commentaire}"</p>
              </div>
            )}
          </div>

          {/* Comment textarea */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MessageSquare className="w-3.5 h-3.5" />
              Commentaire
              {action === 'reject' && <span className="text-red-500 ml-1">* obligatoire pour refus</span>}
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder="Votre commentaire (optionnel pour approbation)..."
              className="w-full text-sm px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none transition"
            />
          </div>

          {/* Buttons */}
          {!action ? (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setAction('approve')} className="flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
                <Check className="w-4 h-4" /> Approuver
              </button>
              <button onClick={() => setAction('reject')} className="flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
                <X className="w-4 h-4" /> Refuser
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`text-xs font-semibold text-center py-2 rounded-lg ${action === 'approve' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                {action === 'approve' ? '✓ Approbation de la demande' : '✗ Refus de la demande'}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setAction(null)} className="py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-sm transition-colors">
                  Retour
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || (action === 'reject' && !comment.trim())}
                  className={`flex items-center justify-center gap-2 py-2.5 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${action === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirmer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Demande Card ─────────────────────────────────────────────────────────────
const DemandeCard: React.FC<{ demande: Demande; onAction: (d: Demande) => void }> = ({ demande, onAction }) => {
  const [expanded, setExpanded] = useState(false);
  const initials = getDemandeurInitials(demande);
  const nom      = getDemandeurNom(demande);

  return (
    <div className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-amber-400 dark:hover:border-amber-600 transition-all">
      {/* Top stripe */}
      <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{initials || '??'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md">#{demande.id_demande}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md">
                <Clock className="w-3 h-3" /> En attente
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">{nom}</p>
            <p className="text-xs text-gray-400">{fmt(demande.date_demande)}</p>
          </div>
        </div>

        {/* Articles preview */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {demande.details.slice(0, 3).map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-lg">
              <Package className="w-3 h-3 text-indigo-400 shrink-0" />
              {getProduitNom(d)} ×{d.quantite}
            </span>
          ))}
          {demande.details.length > 3 && (
            <span className="text-xs text-gray-400 self-center">+{demande.details.length - 3} autres</span>
          )}
        </div>

        {/* Expandable detail */}
        {expanded && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl space-y-1.5">
            {demande.details.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Package className="w-3 h-3 text-indigo-400 shrink-0" />
                  {getProduitNom(d)}
                </span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">×{d.quantite}</span>
              </div>
            ))}
            {demande.commentaire && (
              <p className="text-xs text-gray-500 italic border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">"{demande.commentaire}"</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAction(demande)}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            <Eye className="w-3.5 h-3.5" /> Traiter
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ManagerPendingRequests: React.FC = () => {
  const [demandes, setDemandes]     = useState<Demande[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<Demande | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      // Only fetch EN_ATTENTE_DEPT demandes for this page
      const r = await api.get('/dept/demandes');
      const pending = (r.data as Demande[]).filter(d => d.statut === 'EN_ATTENTE_DEPT');
      setDemandes(pending);
    } catch {
      showToast('Erreur lors du chargement', 'error');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id: number, commentaire: string) => {
    setSubmitting(true);
    try {
      await api.post(`/dept/demandes/${id}/approuver`, { commentaire });
      showToast('Demande approuvée ✓', 'success');
      setSelected(null);
      fetchData(true);
    } catch (err: any) {
      showToast(err.response?.data?.message ?? 'Erreur lors de l\'approbation', 'error');
    } finally { setSubmitting(false); }
  };

  const handleReject = async (id: number, commentaire: string) => {
    setSubmitting(true);
    try {
      await api.post(`/dept/demandes/${id}/refuser`, { commentaire });
      showToast('Demande refusée', 'success');
      setSelected(null);
      fetchData(true);
    } catch (err: any) {
      showToast(err.response?.data?.message ?? 'Erreur lors du refus', 'error');
    } finally { setSubmitting(false); }
  };

  const filtered = demandes.filter(d => {
    const nom = getDemandeurNom(d);
    return `${nom} #${d.id_demande}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="w-full min-h-screen  p-4 sm:p-6">
  <div className="w-full space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Demandes en attente</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Validez ou refusez les demandes de votre département</p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* Alert banner */}
        {!loading && demandes.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {demandes.length} demande{demandes.length > 1 ? 's' : ''} en attente de votre validation
            </span>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, numéro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-sm"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-gray-700 dark:text-gray-200">
              {search ? 'Aucun résultat' : 'Tout est traité !'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {search ? 'Essayez un autre terme de recherche' : 'Aucune demande en attente pour le moment'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(d => (
              <DemandeCard key={d.id_demande} demande={d} onAction={setSelected} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ActionModal
          demande={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          submitting={submitting}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ManagerPendingRequests;