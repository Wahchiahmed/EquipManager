// src/pages/admin/AdminAuditHistorique.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, Search, RefreshCw, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { ApiHistorique, ApiDetailHistorique } from './AdminTypes';
import { PageHeader, LoadingSpinner } from './AdminShared';

// ── Audit Details Modal ───────────────────────────────────────────────────────

const AuditDetailsModal: React.FC<{ item: ApiHistorique; onClose: () => void }> = ({ item, onClose }) => {
  const userNom = item.user ? `${item.user.prenom} ${item.user.nom}` : '—';

  const typeColor: Record<string, string> = {
    INSERT: 'bg-status-approved-bg text-status-approved',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-status-rejected-bg text-status-rejected',
    ACTION: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">Audit #{item.id_historique}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.date_action} · {userNom} · <span className="font-mono">{item.table_modifiee}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-1 rounded ${typeColor[item.type_action] ?? 'bg-muted text-foreground'}`}>
              {item.type_action}
            </span>
            {item.reference_objet && (
              <span className="text-xs font-semibold bg-muted px-2 py-1 rounded font-mono">{item.reference_objet}</span>
            )}
          </div>

          <p className="text-sm text-foreground">{item.description}</p>

          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Détails des modifications
            </div>
            {Array.isArray(item.details) && item.details.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-card text-left">
                      {['Champ', 'Ancien', 'Nouveau', 'Info', 'Commentaire'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {item.details.map((d, idx) => (
                      <tr key={d.id_details ?? idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono font-semibold text-foreground">{d.champs_modifie}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{d.ancien_valeur ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-foreground">{d.nouveau_valeur ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{d.info_detail ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{d.commentaire ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-6 text-sm text-muted-foreground">Aucun détail disponible.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  INSERT: 'bg-status-approved-bg text-status-approved',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-status-rejected-bg text-status-rejected',
  ACTION: 'bg-amber-100 text-amber-700',
};

const ITEMS_PER_PAGE = 10; // Nombre d'audits par page

const AdminAuditHistorique: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<ApiHistorique[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<ApiHistorique | null>(null);
  
  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/historiques?per_page=200');
      setAuditLogs(r.data?.data ?? r.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter(a => {
      const typeOk = filterType ? a.type_action === filterType : true;
      const text = `${a.table_modifiee} ${a.type_action} ${a.description} ${a.reference_objet ?? ''}`.toLowerCase();
      const searchOk = q ? text.includes(q) : true;
      return typeOk && searchOk;
    });
  }, [auditLogs, search, filterType]);

  // Réinitialiser la page à 1 à chaque fois qu'un filtre change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType]);

  // Données paginées
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = { INSERT: 0, UPDATE: 0, DELETE: 0, ACTION: 0 };
    filtered.forEach(a => { if (counts[a.type_action] !== undefined) counts[a.type_action]++; });
    return counts;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit & Historique" subtitle="Journal complet des actions effectuées sur la plateforme" />

      {selectedAudit && (
        <AuditDetailsModal item={selectedAudit} onClose={() => setSelectedAudit(null)} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(stats).map(([type, count]) => (
          <div key={type} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">{type}</p>
            <p className="text-2xl font-bold text-foreground">{count}</p>
            <div className={`mt-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${TYPE_COLORS[type]}`}>
              {type}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">
              Journal d'audit{' '}
              <span className="text-xs font-normal text-muted-foreground">({filtered.length}/{auditLogs.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" placeholder="Table, description, référence..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-56"
              />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none">
              <option value="">Tous les types</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="ACTION">ACTION</option>
            </select>
            <button onClick={fetchAudit}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-muted border border-border rounded-lg hover:bg-border">
              <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun enregistrement d'audit.</div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    {['#', 'Type', 'Table', 'Description', 'Référence', 'Utilisateur', 'Date', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedData.map((a, idx) => {
                    const userNom = a.user ? `${a.user.prenom} ${a.user.nom}` : '—';
                    return (
                      <tr key={a.id_historique ?? idx}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedAudit(a)}
                      >
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-muted-foreground">#{a.id_historique}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded ${TYPE_COLORS[a.type_action] ?? 'bg-muted text-foreground'}`}>
                            {a.type_action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{a.table_modifiee}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[240px]">
                          <p className="text-sm text-foreground truncate">{a.description}</p>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{a.reference_objet ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-foreground">{userNom}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{a.date_action}</td>
                        <td className="px-4 py-3">
                          {Array.isArray(a.details) && a.details.length > 0 && (
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              {a.details.length} champ{a.details.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Contrôles de pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  Affichage de <span className="font-semibold text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> à <span className="font-semibold text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> sur <span className="font-semibold text-foreground">{filtered.length}</span> résultats
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md bg-card border border-border text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold px-2 text-muted-foreground">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md bg-card border border-border text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditHistorique;