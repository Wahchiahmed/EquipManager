import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, RefreshCw,
  ChevronLeft, ChevronRight,
  X, Calendar, Building2, User, Package, MessageSquare,
  CheckCircle, XCircle, Clock, Truck, AlertTriangle,
  Hash, Shield, BarChart2,
} from 'lucide-react';
import api from '@/lib/api';
import { ApiDemande } from './adminTypes';
import { PageHeader, LoadingSpinner } from './AdminShared';
import StatusBadge from '@/components/StatusBadge';

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const STATUT_CFG: Record<string, {
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
}> = {
  EN_ATTENTE_DEPT:       { label: 'Attente dept',   icon: Clock,         color: 'text-amber-700 dark:text-amber-300',    bg: 'bg-amber-50 dark:bg-amber-900/30'    },
  EN_ATTENTE_STOCK:      { label: 'Attente stock',  icon: Clock,         color: 'text-blue-700 dark:text-blue-300',      bg: 'bg-blue-50 dark:bg-blue-900/30'      },
  VALIDEE:               { label: 'Validée',         icon: CheckCircle,   color: 'text-emerald-700 dark:text-emerald-300',bg: 'bg-emerald-50 dark:bg-emerald-900/30'},
  PARTIELLEMENT_VALIDEE: { label: 'Partielle',       icon: AlertTriangle, color: 'text-orange-700 dark:text-orange-300',  bg: 'bg-orange-50 dark:bg-orange-900/30'  },
  REFUSEE_DEPT:          { label: 'Refusée dept',   icon: XCircle,       color: 'text-red-700 dark:text-red-300',        bg: 'bg-red-50 dark:bg-red-900/30'        },
  REFUSEE_STOCK:         { label: 'Refusée stock',  icon: XCircle,       color: 'text-red-700 dark:text-red-300',        bg: 'bg-red-50 dark:bg-red-900/30'        },
  LIVREE:                { label: 'Livrée',          icon: Truck,         color: 'text-violet-700 dark:text-violet-300',  bg: 'bg-violet-50 dark:bg-violet-900/30'  },
};

const DETAIL_STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: 'text-amber-700 dark:text-amber-300',     bg: 'bg-amber-100 dark:bg-amber-900/40'     },
  accepte:    { label: 'Accepté',    color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  refuse:     { label: 'Refusé',     color: 'text-red-700 dark:text-red-300',         bg: 'bg-red-100 dark:bg-red-900/40'         },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const initials = (prenom: string, nom: string) =>
  `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?';

// ─── Pagination ───────────────────────────────────────────────────────────────

const Pagination: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}> = ({ page, totalPages, total, onChange }) => {
  if (totalPages <= 1) return null;

  const start = (page - 1) * PER_PAGE + 1;
  const end   = Math.min(page * PER_PAGE, total);

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/20 select-none">
      <p className="text-xs text-muted-foreground hidden sm:block">
        <span className="font-semibold text-foreground">{start}–{end}</span> sur{' '}
        <span className="font-semibold text-foreground">{total}</span> demande{total > 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground
                     hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Préc.</span>
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="w-8 text-center text-xs text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-colors ${
                p === page
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground
                     hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <span className="hidden sm:inline">Suiv.</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ─── Detail slide-in panel ────────────────────────────────────────────────────

const DemandeDetailPanel: React.FC<{
  demande: ApiDemande;
  onClose: () => void;
}> = ({ demande, onClose }) => {
  const prenom   = demande.demandeur_prenom ?? demande.demandeur?.prenom ?? '';
  const nom      = demande.demandeur_nom    ?? demande.demandeur?.nom    ?? '';
  const dept     = demande.departement_nom  ?? demande.demandeur?.departement?.nom ?? '—';
  const cfg      = STATUT_CFG[demande.statut];
  const StatIcon = cfg?.icon ?? Clock;

  const accepted = demande.details.filter(d => d.statut === 'accepte').length;
  const refused  = demande.details.filter(d => d.statut === 'refuse').length;
  const pending  = demande.details.filter(d => d.statut === 'en_attente').length;

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-[2px]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex flex-col w-full max-w-xl bg-card border-l border-border shadow-2xl
                      animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="shrink-0 px-6 py-5 border-b border-border bg-gradient-to-br from-primary/5 via-card to-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Demande</span>
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  #{demande.id_demande}
                </span>
              </div>
              <h2 className="text-lg font-black text-foreground leading-tight">{prenom} {nom}</h2>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 shrink-0" />{dept}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {cfg && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${cfg.bg} ${cfg.color}`}>
                  <StatIcon className="w-3.5 h-3.5" />{cfg.label}
                </div>
              )}
              <button
                onClick={onClose}
                title="Fermer (Échap)"
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {([
              { label: 'Date de demande',    value: fmtDateTime(demande.date_demande),         icon: Calendar    },
              { label: 'Département',        value: dept,                                       icon: Building2   },
              { label: 'Resp. département',  value: demande.responsable_dept    ?? '—',         icon: User        },
              { label: 'Resp. stock',        value: demande.responsable_stock   ?? '—',         icon: Shield      },
              { label: 'Valid. département', value: fmtDateTime(demande.date_validation_dept),  icon: CheckCircle },
              { label: 'Valid. stock',       value: fmtDateTime(demande.date_validation_stock), icon: Package     },
            ] as const).map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-start gap-2.5 bg-muted/40 rounded-xl px-3.5 py-3">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3 h-3 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">{label}</p>
                  <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Commentaire */}
          {demande.commentaire && (
            <div className="bg-muted/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Commentaire</p>
              </div>
              <p className="text-sm text-foreground leading-relaxed italic">"{demande.commentaire}"</p>
            </div>
          )}

          {/* Summary pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted text-foreground">
              <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
              {demande.details.length} article{demande.details.length !== 1 ? 's' : ''}
            </div>
            {accepted > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                              bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="w-3.5 h-3.5" />{accepted} accepté{accepted > 1 ? 's' : ''}
              </div>
            )}
            {refused > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                              bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <XCircle className="w-3.5 h-3.5" />{refused} refusé{refused > 1 ? 's' : ''}
              </div>
            )}
            {pending > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                              bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                <Clock className="w-3.5 h-3.5" />{pending} en attente
              </div>
            )}
          </div>

          {/* Detail lines */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Package className="w-3.5 h-3.5" /> Lignes de la demande
            </h3>

            {demande.details.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 bg-muted/30 rounded-xl">
                Aucune ligne enregistrée
              </p>
            ) : (
              <div className="space-y-2">
                {demande.details.map((detail, i) => {
                  const dCfg    = DETAIL_STATUT_CFG[detail.statut] ?? { label: detail.statut, color: 'text-gray-600', bg: 'bg-gray-100' };
                  const prodNom = detail.produit_nom ?? detail.nom ?? `Produit #${detail.id_produit}`;
                  const stockOk = detail.quantite === undefined || detail.quantite >= detail.quantite;

                  return (
                    <div
                      key={detail.id_detail ?? i}
                      className="flex items-start gap-3 p-3.5 bg-muted/30 hover:bg-muted/50
                                 rounded-xl border border-border/50 transition-colors"
                    >
                      <span className="shrink-0 w-6 h-6 rounded-md bg-muted flex items-center justify-center
                                       text-[10px] font-bold text-muted-foreground mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{prodNom}</p>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${dCfg.bg} ${dCfg.color}`}>
                            {dCfg.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                          {detail.reference && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Hash className="w-2.5 h-2.5" />{detail.reference}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            Qté : <span className="font-bold text-foreground">{detail.quantite}</span>
                          </span>
                          {detail.quantite !== undefined && (
                            <span className="text-[11px] text-muted-foreground">
                              Stock :{' '}
                              <span className={`font-bold ${stockOk ? 'text-emerald-600' : 'text-red-500'}`}>
                                {detail.quantite}
                              </span>
                            </span>
                          )}
                        </div>
                        {(detail.commentaire_stock ?? detail.commentaire_stock) && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 bg-muted px-2.5 py-1.5
                                        rounded-lg italic border-l-2 border-border">
                            {detail.commentaire_stock ?? detail.commentaire_stock}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Créée le <span className="font-semibold text-foreground">{fmtDate(demande.date_demande)}</span>
          </p>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-border border border-border
                       text-sm font-semibold text-foreground rounded-xl transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const AdminToutesLesDemandes: React.FC = () => {
  const [demandes, setDemandes]         = useState<ApiDemande[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [page, setPage]                 = useState(1);
  const [selected, setSelected]         = useState<ApiDemande | null>(null);

  const fetchDemandes = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/demandes?per_page=500');
      setDemandes(r.data?.data ?? r.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDemandes(); }, [fetchDemandes]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterStatut]);

  // Filtering
  const filtered = demandes.filter(d => {
    const prenom = d.demandeur_prenom ?? d.demandeur?.prenom ?? '';
    const nom    = d.demandeur_nom    ?? d.demandeur?.nom    ?? '';
    const dept   = d.departement_nom  ?? d.demandeur?.departement?.nom ?? '';
    const matchSearch = !search
      || `${prenom} ${nom} ${dept} #${d.id_demande}`.toLowerCase().includes(search.toLowerCase());
    const matchStatut = !filterStatut || d.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const statuts    = [...new Set(demandes.map(d => d.statut))].sort();

  return (
    <>
      <div className="space-y-6">

        <PageHeader
          title="Toutes les demandes"
          subtitle="Vue globale de toutes les demandes de la plateforme"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',      value: demandes.length,                                                                                    color: 'text-foreground',    bg: 'bg-muted/60'                           },
            { label: 'En attente', value: demandes.filter(d => d.statut.includes('ATTENTE')).length,                                          color: 'text-amber-600',     bg: 'bg-amber-50 dark:bg-amber-900/20'      },
            { label: 'Traitées',   value: demandes.filter(d => ['VALIDEE', 'PARTIELLEMENT_VALIDEE', 'LIVREE'].includes(d.statut)).length,      color: 'text-emerald-600',   bg: 'bg-emerald-50 dark:bg-emerald-900/20'  },
            { label: 'Refusées',   value: demandes.filter(d => d.statut.includes('REFUSEE')).length,                                          color: 'text-red-600',       bg: 'bg-red-50 dark:bg-red-900/20'          },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3.5 border border-border/50`}>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">

          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">
                Demandes{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  ({filtered.length}{filtered.length !== demandes.length ? `/${demandes.length}` : ''})
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Nom, département, #ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg
                             focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 w-52"
                />
              </div>
              <select
                value={filterStatut}
                onChange={e => setFilterStatut(e.target.value)}
                className="py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none"
              >
                <option value="">Tous statuts</option>
                {statuts.map(s => (
                  <option key={s} value={s}>{STATUT_CFG[s]?.label ?? s}</option>
                ))}
              </select>
              <button
                onClick={fetchDemandes}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-muted border border-border rounded-lg hover:bg-border transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
              </button>
            </div>
          </div>

          {/* Table body */}
          {loading ? (
            <LoadingSpinner />
          ) : paginated.length === 0 ? (
            <div className="py-14 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">
                {search || filterStatut ? 'Aucun résultat pour ces filtres.' : 'Aucune demande trouvée.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    {['#', 'Demandeur', 'Département', 'Date', 'Statut', 'Produits', 'Resp. Dept', 'Resp. Stock'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((d, idx) => {
                    const prenom = d.demandeur_prenom ?? d.demandeur?.prenom ?? '—';
                    const nom    = d.demandeur_nom    ?? d.demandeur?.nom    ?? '—';
                    const dept   = d.departement_nom  ?? d.demandeur?.departement?.nom ?? '—';
                    const cfg    = STATUT_CFG[d.statut];

                    return (
                      <tr
                        key={d.id_demande ?? idx}
                        onClick={() => setSelected(d)}
                        className="hover:bg-primary/5 transition-colors cursor-pointer group"
                        title="Cliquer pour voir les détails"
                      >
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono font-bold text-primary group-hover:underline">
                            #{d.id_demande}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center
                                            text-[10px] font-bold text-primary shrink-0">
                              {initials(prenom, nom)}
                            </div>
                            <span className="text-sm font-medium text-foreground whitespace-nowrap">
                              {prenom} {nom}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{dept}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(d.date_demande)}
                        </td>
                        <td className="px-4 py-3">
                          {cfg ? (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.color}`}>
                              <cfg.icon className="w-3 h-3" />{cfg.label}
                            </span>
                          ) : (
                            <StatusBadge status={d.statut as any} />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {Array.isArray(d.details) && d.details.length > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">{d.details.length}</span>
                              {' '}article{d.details.length > 1 ? 's' : ''}
                              {' · '}
                              {d.details.slice(0, 2).map(x => x.produit_nom ?? x.nom ?? `#${x.id_produit}`).join(', ')}
                              {d.details.length > 2 ? '…' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {d.responsable_dept ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {d.responsable_stock ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination bar */}
          {!loading && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              onChange={setPage}
            />
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <DemandeDetailPanel
          demande={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
};

export default AdminToutesLesDemandes;