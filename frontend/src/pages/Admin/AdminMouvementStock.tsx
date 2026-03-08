// src/pages/admin/AdminMouvementsStock.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowUp, ArrowDown, Search, RefreshCw, TrendingUp,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { ApiMouvement } from './adminTypes';
import { PageHeader, LoadingSpinner } from './AdminShared';

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';

// ─── Pagination component (shared pattern) ───────────────────────────────────

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
        <span className="font-semibold text-foreground">{total}</span> mouvement{total > 1 ? 's' : ''}
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

// ─── Main component ───────────────────────────────────────────────────────────

const AdminMouvementsStock: React.FC = () => {
  const [mouvements, setMouvements] = useState<ApiMouvement[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage]             = useState(1);

  const fetchMouvements = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/mouvements?per_page=500');
      setMouvements(r.data?.data ?? r.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMouvements(); }, [fetchMouvements]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, filterType]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = mouvements.filter(m => {
    const prodNom = m.produit?.nom_produit ?? '';
    const userNom = m.user ? `${m.user.prenom} ${m.user.nom}` : '';
    const matchSearch = !search
      || `${prodNom} ${userNom}`.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || m.type_mouvement === filterType;
    return matchSearch && matchType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const totalIn  = filtered.filter(m => m.type_mouvement === 'IN').reduce((s, m) => s + m.quantite_mouvement, 0);
  const totalOut = filtered.filter(m => m.type_mouvement === 'OUT').reduce((s, m) => s + m.quantite_mouvement, 0);

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mouvements de stock"
        subtitle="Historique complet des entrées et sorties de stock"
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Total mouvements',
            value: filtered.length,
            icon: TrendingUp,
            color: 'text-foreground',
            bg: 'bg-muted',
          },
          {
            label: 'Total entrées',
            value: `+${totalIn}`,
            icon: ArrowUp,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          },
          {
            label: 'Total sorties',
            value: `-${totalOut}`,
            icon: ArrowDown,
            color: 'text-red-600 dark:text-red-400',
            bg: 'bg-red-100 dark:bg-red-900/30',
          },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3 justify-between">
          <h2 className="font-semibold text-foreground text-sm">
            Journal des mouvements{' '}
            <span className="text-xs font-normal text-muted-foreground">
              ({filtered.length}{filtered.length !== mouvements.length ? `/${mouvements.length}` : ''})
            </span>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Produit, utilisateur..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg
                           focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 w-44"
              />
            </div>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none"
            >
              <option value="">Tous</option>
              <option value="IN">Entrées (IN)</option>
              <option value="OUT">Sorties (OUT)</option>
            </select>
            <button
              onClick={fetchMouvements}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-muted border border-border rounded-lg hover:bg-border transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <LoadingSpinner />
        ) : paginated.length === 0 ? (
          <div className="py-12 text-center">
            <TrendingUp className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-30" />
            <p className="text-sm text-muted-foreground">
              {search || filterType ? 'Aucun résultat pour ces filtres.' : 'Aucun mouvement trouvé.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-left">
                  {['Type', 'Produit', 'Quantité', 'Avant → Après', 'Date', 'Utilisateur', 'Demande', 'Note'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((m, idx) => {
                  const isIn = m.type_mouvement === 'IN';
                  const id   = m.id_mouvement ;

                  return (
                    <tr key={id} className="hover:bg-muted/30 transition-colors">

                      {/* Type badge */}
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isIn
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                        }`}>
                          {isIn ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                          {m.type_mouvement}
                        </div>
                      </td>

                      {/* Produit */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">
                          {m.produit?.nom_produit ?? '—'}
                        </p>
                        {m.produit?.reference && (
                          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            {m.produit.reference}
                          </p>
                        )}
                      </td>

                      {/* Quantité */}
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isIn ? '+' : '−'}{m.quantite_mouvement}
                        </span>
                      </td>

                      {/* Avant → Après */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded-md whitespace-nowrap">
                          {m.quantite_avant} → {m.quantite_apres}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(m.date_mouvement)}
                      </td>

                      {/* Utilisateur */}
                      <td className="px-4 py-3 text-xs text-foreground">
                        {m.user ? `${m.user.prenom} ${m.user.nom}` : '—'}
                      </td>

                      {/* Demande */}
                      <td className="px-4 py-3">
                        {m.demande?.id_demande ? (
                          <span className="text-xs font-mono font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                            #{m.demande.id_demande}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Note */}
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate" title={m.note ?? undefined}>
                        {m.note ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
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
  );
};

export default AdminMouvementsStock;