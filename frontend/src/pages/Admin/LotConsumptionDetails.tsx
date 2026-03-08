// src/components/admin/LotConsumptionDetails.tsx
// Reusable component that shows which FIFO lots were consumed
// for a mouvement, a detail line, or a whole demande.
//
// Props (pick ONE source):
//   mouvementId    → fetches /[prefix]/mouvements/{id}/lots
//   detailDemandeId → fetches /[prefix]/details/{id}/lots
//   demandeId      → fetches /[prefix]/demandes/{id}/lots  (summary over all lines)
//   lots           → pre-fetched array (skips fetch entirely)
//
// Display modes:
//   compact={true}  → inline collapsible pill-list (default for tables/lines)
//   compact={false} → full card with FIFO index badges and before→after columns

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Layers, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LotDetail {
  id:                 number;
  id_lot:             number;
  numero_lot:         string;
  date_entree:        string | null;
  date_expiration:    string | null;
  quantite_sortie:    number;
  quantite_lot_avant: number;
  quantite_lot_apres: number;
  id_mouvement?:      number | null;
  id_demande?:        number | null;
}

interface Props {
  mouvementId?:      number;
  detailDemandeId?:  number;
  demandeId?:        number;
  lots?:             LotDetail[];

  endpointPrefix?:  '/stock' | '/admin';
  compact?:         boolean;
  defaultOpen?:     boolean;
  className?:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : null;

// ─── Compact view (inline collapsible) ───────────────────────────────────────

const CompactView: React.FC<{ lots: LotDetail[]; open: boolean; onToggle: () => void }> = ({ lots, open, onToggle }) => (
  <div className="mt-2">
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors group"
    >
      <Layers className="w-3 h-3 text-indigo-500 group-hover:text-indigo-600" />
      <span className="text-indigo-600 dark:text-indigo-400">
        {lots.length} lot{lots.length > 1 ? 's' : ''} FIFO consommé{lots.length > 1 ? 's' : ''}
      </span>
      {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
    </button>

    {open && (
      <div className="mt-1.5 flex flex-col gap-1">
        {lots.map((l, i) => (
          <div key={l.id}
            className="flex items-center gap-2 text-[11px] pl-4 py-1 rounded-lg bg-indigo-50/60 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40">
            {/* FIFO index */}
            <span className="w-4 h-4 rounded-sm bg-indigo-200 dark:bg-indigo-700 flex items-center justify-center text-[9px] font-black text-indigo-800 dark:text-indigo-200 shrink-0">
              {i + 1}
            </span>
            {/* Lot number */}
            <span className="font-mono font-semibold text-foreground">{l.numero_lot}</span>
            {/* Date */}
            {fmtDate(l.date_entree) && (
              <span className="text-muted-foreground">· {fmtDate(l.date_entree)}</span>
            )}
            {/* Qty taken */}
            <span className="ml-auto font-bold text-red-600 dark:text-red-400">−{l.quantite_sortie}</span>
            {/* Before → after */}
            <span className="text-muted-foreground font-mono">
              {l.quantite_lot_avant}→<span className="text-foreground font-semibold">{l.quantite_lot_apres}</span>
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─── Full card view ───────────────────────────────────────────────────────────

const FullView: React.FC<{ lots: LotDetail[]; open: boolean; onToggle: () => void }> = ({ lots, open, onToggle }) => {
  const totalConsumed = lots.reduce((s, l) => s + l.quantite_sortie, 0);

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/60 overflow-hidden bg-indigo-50/30 dark:bg-indigo-900/10">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
            Lots FIFO consommés
          </span>
          <span className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 px-2 py-0.5 rounded-full">
            {lots.length} lot{lots.length > 1 ? 's' : ''} · −{totalConsumed} unités
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
      </button>

      {/* Table */}
      {open && (
        <div className="border-t border-indigo-200 dark:border-indigo-800/60">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-indigo-100/60 dark:bg-indigo-900/30 text-left">
                {['#', 'Numéro lot', 'Entrée', 'Expiration', 'Prélevé', 'Avant', 'Après'].map(h => (
                  <th key={h} className="px-3 py-2 font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-100 dark:divide-indigo-800/40">
              {lots.map((l, i) => (
                <tr key={l.id} className="hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors">
                  {/* FIFO index */}
                  <td className="px-3 py-2.5">
                    <span className="w-5 h-5 rounded-md bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                  </td>
                  {/* Lot number */}
                  <td className="px-3 py-2.5 font-mono font-semibold text-foreground">{l.numero_lot}</td>
                  {/* Dates */}
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(l.date_entree) ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {l.date_expiration
                      ? <span className={new Date(l.date_expiration) < new Date() ? 'text-red-500 font-semibold' : ''}>{fmtDate(l.date_expiration)}</span>
                      : <span className="opacity-40">—</span>}
                  </td>
                  {/* Quantity taken */}
                  <td className="px-3 py-2.5">
                    <span className="font-bold text-red-600 dark:text-red-400">−{l.quantite_sortie}</span>
                  </td>
                  {/* Before / after */}
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{l.quantite_lot_avant}</td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-foreground">
                    {l.quantite_lot_apres}
                    {l.quantite_lot_apres === 0 && (
                      <span className="ml-1 text-[9px] font-bold text-gray-400 uppercase">épuisé</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Total row */}
            <tfoot>
              <tr className="bg-indigo-100/40 dark:bg-indigo-900/20 border-t border-indigo-200 dark:border-indigo-800/60">
                <td colSpan={4} className="px-3 py-2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Total</td>
                <td className="px-3 py-2 font-black text-red-600 dark:text-red-400">−{totalConsumed}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Loading / empty states ───────────────────────────────────────────────────

const LoadingState: React.FC = () => (
  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1.5 pl-1">
    <RefreshCw className="w-3 h-3 animate-spin" />
    Chargement des lots…
  </div>
);

const EmptyState: React.FC<{ compact?: boolean }> = ({ compact }) =>
  compact ? null : (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1.5 px-3 py-2 rounded-lg bg-muted/40">
      <Layers className="w-3 h-3" />
      Aucun lot consommé enregistré.
    </div>
  );

const ErrorState: React.FC = () => (
  <div className="flex items-center gap-1.5 text-[11px] text-red-500 mt-1.5 pl-1">
    <AlertTriangle className="w-3 h-3" />
    Impossible de charger les lots.
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const LotConsumptionDetails: React.FC<Props> = ({
  mouvementId,
  detailDemandeId,
  demandeId,
  lots: prefetchedLots,
  endpointPrefix = '/admin',
  compact = true,
  defaultOpen = false,
  className,
}) => {
  const [lots, setLots]       = useState<LotDetail[]>(prefetchedLots ?? []);
  const [loading, setLoading] = useState(!prefetchedLots);
  const [error, setError]     = useState(false);
  const [open, setOpen]       = useState(defaultOpen);

  const fetchLots = useCallback(async () => {
    // If lots pre-provided, skip fetch
    if (prefetchedLots) { setLots(prefetchedLots); setLoading(false); return; }

    let url: string | null = null;
    if (mouvementId)     url = `${endpointPrefix}/mouvements/${mouvementId}/lots`;
    else if (detailDemandeId) url = `${endpointPrefix}/details/${detailDemandeId}/lots`;
    else if (demandeId)  url = `${endpointPrefix}/demandes/${demandeId}/lots`;

    if (!url) { setLoading(false); return; }

    setLoading(true);
    setError(false);
    try {
      const r = await api.get(url);
      setLots(r.data?.data ?? r.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [mouvementId, detailDemandeId, demandeId, prefetchedLots, endpointPrefix]);

  useEffect(() => { fetchLots(); }, [fetchLots]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState />;
  if (lots.length === 0) return <EmptyState compact={compact} />;

  return (
    <div className={className}>
      {compact
        ? <CompactView lots={lots} open={open} onToggle={() => setOpen(v => !v)} />
        : <FullView    lots={lots} open={open} onToggle={() => setOpen(v => !v)} />
      }
    </div>
  );
};

export default LotConsumptionDetails;