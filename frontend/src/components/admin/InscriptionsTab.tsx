// ─────────────────────────────────────────────────────────────────────────────
// InscriptionsTab.tsx — standalone component to drop into AdminDashboard
// Import and add to the tabs array + render section
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import {
  Check, X, Clock, UserCheck, UserX, Search, RefreshCw,
  Loader2, AlertTriangle, ChevronDown, ChevronUp, Mail,
  BadgeCheck, ShieldX,
} from 'lucide-react';
import api from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApiInscription {
  id: number;
  nom: string; prenom: string; email: string; cin: string | null;
  telephone: string | null; role_id: number; role_nom: string;
  statut: 'en_attente' | 'accepte' | 'refuse';
  commentaire_admin: string | null;
  traite_par_nom: string | null; traite_le: string | null;
  created_at: string;
}

interface InscriptionStats {
  en_attente: number; acceptes: number; refuses: number; total: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const roleLabel = (nom: string) => {
  const m: Record<string, string> = {
    'employe': 'Employé', 'responsable departement': 'Resp. Département',
    'responsable stock': 'Resp. Stock', 'admin': 'Admin',
  };
  return m[nom.toLowerCase()] ?? nom;
};

const statutCfg = {
  en_attente: { label: 'En attente', cls: 'bg-amber-100 text-amber-800',  icon: Clock      },
  accepte:    { label: 'Accepté',   cls: 'bg-green-100 text-green-800',   icon: UserCheck  },
  refuse:     { label: 'Refusé',    cls: 'bg-red-100 text-red-800',       icon: UserX      },
};

// ── Decision Modal ─────────────────────────────────────────────────────────────

const DecisionModal: React.FC<{
  demande: ApiInscription;
  action: 'accepter' | 'refuser';
  onClose: () => void;
  onDone: (updated: ApiInscription) => void;
}> = ({ demande, action, onClose, onDone }) => {
  const [commentaire, setCommentaire] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const isAccept = action === 'accepter';

  const handleSubmit = async () => {
    if (!isAccept && !commentaire.trim()) {
      setError('Veuillez fournir un motif de refus.');
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/admin/inscriptions/${demande.id}/${action}`, {
        commentaire: commentaire || undefined,
      });
      onDone(res.data.demande);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Une erreur est survenue.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className={`px-6 py-5 rounded-t-2xl ${isAccept ? 'bg-green-50 dark:bg-green-950/30 border-b border-green-200/50' : 'bg-red-50 dark:bg-red-950/30 border-b border-red-200/50'}`}>
          <div className="flex items-center gap-3">
            {isAccept
              ? <BadgeCheck className="w-6 h-6 text-green-600 shrink-0" />
              : <ShieldX    className="w-6 h-6 text-red-600 shrink-0"   />}
            <div>
              <h3 className="font-bold text-foreground">{isAccept ? 'Accepter la demande' : 'Refuser la demande'}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{demande.prenom} {demande.nom} · {demande.email}</p>
            </div>
            <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {isAccept ? (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200/50 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400">
              Un compte sera créé pour <strong>{demande.prenom} {demande.nom}</strong> avec le rôle <strong>{roleLabel(demande.role_nom)}</strong>. 
              Un email de confirmation sera envoyé à <strong>{demande.email}</strong>.
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
              La demande sera refusée. Un email de notification sera envoyé à <strong>{demande.email}</strong>.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
              {isAccept ? 'Message (optionnel)' : 'Motif du refus *'}
            </label>
            <textarea
              rows={3} value={commentaire} onChange={e => setCommentaire(e.target.value)}
              placeholder={isAccept ? 'Message de bienvenue…' : 'Expliquez la raison du refus…'}
              className="w-full px-3 py-2.5 text-sm bg-muted border border-transparent rounded-xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-colors ${isAccept ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isAccept ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {loading ? 'Traitement…' : isAccept ? 'Accepter & créer le compte' : 'Refuser la demande'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main InscriptionsTab component ─────────────────────────────────────────────

const InscriptionsTab: React.FC = () => {
  const [demandes, setDemandes]   = useState<ApiInscription[]>([]);
  const [stats, setStats]         = useState<InscriptionStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterStatut, setFilterStatut] = useState<'en_attente' | 'accepte' | 'refuse' | 'all'>('en_attente');
  const [modal, setModal]         = useState<{ demande: ApiInscription; action: 'accepter' | 'refuser' } | null>(null);
  const [expanded, setExpanded]   = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        api.get(`/admin/inscriptions?statut=${filterStatut}`),
        api.get('/admin/inscriptions/stats'),
      ]);
      setDemandes(d.data);
      setStats(s.data);
    } finally { setLoading(false); }
  }, [filterStatut]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDone = (updated: ApiInscription) => {
    setDemandes(prev => prev.map(d => d.id === updated.id ? updated : d).filter(d => {
      if (filterStatut === 'all') return true;
      return d.statut === filterStatut;
    }));
    // Refresh stats
    api.get('/admin/inscriptions/stats').then(r => setStats(r.data));
  };

  const filtered = demandes.filter(d => {
    const q = search.toLowerCase();
    return !q || `${d.prenom} ${d.nom} ${d.email} ${d.cin ?? ''}`.toLowerCase().includes(q);
  });

  const pendingCount = stats?.en_attente ?? 0;

  return (
    <>
      {modal && (
        <DecisionModal
          demande={modal.demande}
          action={modal.action}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}

      <div className="space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'En attente', value: stats?.en_attente ?? 0, cls: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/50', pulse: (stats?.en_attente ?? 0) > 0 },
            { label: 'Acceptées',  value: stats?.acceptes   ?? 0, cls: 'text-green-600', bg: 'bg-green-50  dark:bg-green-950/20  border-green-200/50',  pulse: false },
            { label: 'Refusées',   value: stats?.refuses    ?? 0, cls: 'text-red-600',   bg: 'bg-red-50    dark:bg-red-950/20    border-red-200/50',    pulse: false },
            { label: 'Total',      value: stats?.total      ?? 0, cls: 'text-foreground', bg: 'bg-card border-border', pulse: false },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-4 ${s.bg}`}>
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                {s.pulse && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                )}
              </div>
              <p className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Main table card */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">
              Demandes d'inscription
              {pendingCount > 0 && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">{pendingCount} en attente</span>
              )}
            </h2>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input type="text" placeholder="Nom, email, CIN..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-48" />
              </div>

              {/* Statut filter tabs */}
              <div className="flex gap-1 bg-muted p-0.5 rounded-lg">
                {([
                  { key: 'en_attente', label: 'En attente' },
                  { key: 'accepte',    label: 'Acceptées'  },
                  { key: 'refuse',     label: 'Refusées'   },
                  { key: 'all',        label: 'Toutes'     },
                ] as const).map(opt => (
                  <button key={opt.key} onClick={() => setFilterStatut(opt.key)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${filterStatut === opt.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              <button onClick={fetchAll} disabled={loading} className="p-1.5 bg-muted rounded-lg border border-transparent hover:border-border transition-colors disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <UserCheck className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune demande trouvée</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(d => {
                const cfg = statutCfg[d.statut];
                const Ico = cfg.icon;
                const isExpanded = expanded === d.id;
                return (
                  <div key={d.id} className="hover:bg-muted/20 transition-colors">
                    {/* Main row */}
                    <div className="flex items-center gap-4 px-5 py-4">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                        {d.prenom[0]}{d.nom[0]}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{d.prenom} {d.nom}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                            {roleLabel(d.role_nom)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />{d.email}
                          </span>
                          {d.cin && <span className="text-xs text-muted-foreground">CIN : {d.cin}</span>}
                          <span className="text-xs text-muted-foreground">{d.created_at}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {d.statut === 'en_attente' && (
                          <>
                            <button onClick={() => setModal({ demande: d, action: 'accepter' })}
                              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                              <Check className="w-3.5 h-3.5" /> Accepter
                            </button>
                            <button onClick={() => setModal({ demande: d, action: 'refuser' })}
                              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                              <X className="w-3.5 h-3.5" /> Refuser
                            </button>
                          </>
                        )}
                        {d.statut !== 'en_attente' && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Ico className="w-3.5 h-3.5" />
                            {d.traite_par_nom && <span>par {d.traite_par_nom}</span>}
                            {d.traite_le && <span>· {d.traite_le}</span>}
                          </div>
                        )}
                        <button onClick={() => setExpanded(isExpanded ? null : d.id)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-5 pb-4 ml-13 border-t border-border/50 pt-3 bg-muted/10">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs ml-[52px]">
                          {[
                            ['Téléphone', d.telephone ?? '—'],
                            ['CIN', d.cin ?? '—'],
                            ['Rôle demandé', roleLabel(d.role_nom)],
                            ['Soumis le', d.created_at],
                            d.commentaire_admin ? ['Commentaire admin', d.commentaire_admin] : null,
                            d.traite_par_nom ? ['Traité par', `${d.traite_par_nom} · ${d.traite_le ?? ''}`] : null,
                          ].filter(Boolean).map(([label, value]) => (
                            <div key={label}>
                              <span className="text-muted-foreground">{label} : </span>
                              <span className="text-foreground font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InscriptionsTab;