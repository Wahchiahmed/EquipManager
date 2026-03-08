// src/components/admin/ProductLotsModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Package, CheckCircle2, XCircle, AlertTriangle,
  Calendar, RefreshCw, Layers,
} from 'lucide-react';
import api from '@/lib/api';
import { ApiProduitLot, ApiLotsParProduitResponse } from './adminTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const LOT_CFG: Record<string, { label: string; color: string; bg: string; icon: React.FC<any> }> = {
  actif:  { label: 'Actif',  color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-900/40', icon: CheckCircle2 },
  epuise: { label: 'Épuisé', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700/40', icon: XCircle },
  expire: { label: 'Expiré', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40', icon: AlertTriangle },
};

// ─── Progress bar ─────────────────────────────────────────────────────────────

const LotProgressBar: React.FC<{ lot: ApiProduitLot }> = ({ lot }) => {
  const pct = lot.pourcentage_utilise;
  const color = pct >= 100 ? 'bg-gray-400' : pct >= 75 ? 'bg-orange-400' : 'bg-emerald-500';

  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
        <span>{lot.quantite_restante} restant</span>
        <span>{pct}% utilisé</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  produitId: number;
  produitNom: string;
  onClose: () => void;
  endpointPrefix?: '/admin' | '/stock';
}

const ProductLotsModal: React.FC<Props> = ({
  produitId,
  produitNom,
  onClose,
  endpointPrefix = '/admin',
}) => {
  const [data, setData] = useState<ApiLotsParProduitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'actif' | 'epuise' | 'expire'>('all');

  const fetchLots = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`${endpointPrefix}/produits/${produitId}/lots`);
      setData(r.data);
    } catch (error) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [produitId, endpointPrefix]);

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const lots = data?.lots ?? [];
  const filtered = filter === 'all' ? lots : lots.filter(l => l.statut === filter);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl">
        <div className="shrink-0 px-6 py-5 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Gestion des lots FIFO
                </span>
              </div>
              <h2 className="text-base font-black text-foreground">{produitNom}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {data && (
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                { label: 'Stock total', value: data.produit.quantite, color: 'text-foreground', bg: 'bg-muted/60' },
                { label: 'Disponible', value: data.stock_disponible, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                { label: 'Lots actifs', value: data.lots_actifs, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Lots épuisés', value: data.lots_epuises, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700/40' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl px-3 py-2 flex items-center gap-2`}>
                  <p className={`text-lg font-black leading-none ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-3 border-b border-border flex items-center justify-between gap-3">
          <div className="flex gap-1">
            {(['all', 'actif', 'epuise', 'expire'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {f === 'all' ? 'Tous' : LOT_CFG[f].label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchLots}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">Aucun lot trouvé.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((lot, i) => {
                const cfg = LOT_CFG[lot.statut] ?? LOT_CFG.actif;
                const Icon = cfg.icon;
                const expires = lot.date_expiration && new Date(lot.date_expiration) < new Date();

                return (
                  <div
                    key={lot.id_lot}
                    className="p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {lot.statut === 'actif' && (
                          <span className="shrink-0 w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary mt-0.5">
                            {i + 1}
                          </span>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground font-mono">{lot.numero_lot}</span>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} flex items-center gap-1`}>
                              <Icon className="w-2.5 h-2.5" />
                              {cfg.label}
                            </span>

                            {expires && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                Expiré
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Entrée : {fmtDate(lot.date_entree)}
                            </span>

                            {lot.date_expiration && (
                              <span className={`text-[11px] flex items-center gap-1 ${expires ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                                <Calendar className="w-3 h-3" />
                                Exp : {fmtDate(lot.date_expiration)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className={`text-lg font-black ${lot.statut === 'actif' ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {lot.quantite_restante}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          / {lot.quantite_initiale} initial
                        </p>
                      </div>
                    </div>

                    <LotProgressBar lot={lot} />

                    {lot.note && (
                      <p className="text-[11px] text-muted-foreground mt-2 italic">
                        {lot.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length} lot{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ' '}
            {data && '· ordre FIFO par date d’entrée'}
          </p>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-border border border-border text-sm font-semibold text-foreground rounded-xl transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductLotsModal;