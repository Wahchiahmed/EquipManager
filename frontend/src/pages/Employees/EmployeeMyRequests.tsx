// src/pages/employee/EmployeeMyRequests.tsx
import React, { useState, useEffect } from 'react';
import {
  ClipboardList, Package, CheckCircle, Clock, AlertCircle,
  Plus, Pencil, Trash2, Loader2, X,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { ApiDemande, ApiProduit, Stats } from './EmployeeTypes';
import { NewRequestModal, EditDemandeModal } from './Employeeshared';

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  title: string; value: number; icon: React.ElementType;
  color: string; sub: string; loading?: boolean;
}> = ({ title, value, icon: Icon, color, sub, loading }) => (
  <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        {loading
          ? <div className="h-8 w-12 bg-muted animate-pulse rounded mt-1" />
          : <p className="text-2xl font-bold text-foreground mt-1">{value}</p>}
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

const DeleteConfirmModal: React.FC<{
  demande: ApiDemande;
  onClose: () => void;
  onDeleted: (id: number) => void;
}> = ({ demande, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await api.delete(`/demandes/${demande.id_demande}`);
      onDeleted(demande.id_demande);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-status-rejected/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-status-rejected" />
            </div>
            <h3 className="font-semibold text-foreground">Supprimer la demande</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Êtes-vous sûr de vouloir supprimer la{' '}
            <span className="font-semibold text-foreground">Demande #{demande.id_demande}</span> ?
            Cette action est <span className="font-semibold text-status-rejected">irréversible</span>.
          </p>

          {/* Articles résumé */}
          <div className="bg-muted rounded-lg px-3 py-2.5 space-y-1">
            {demande.details.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Package className="w-3 h-3" />
                  {d.nom ?? d.produit_nom ?? `Produit #${d.id_produit}`}
                </span>
                <span className="font-semibold text-foreground">×{d.quantite}</span>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-status-rejected">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium bg-muted hover:bg-border rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-status-rejected text-white hover:opacity-90 disabled:opacity-60 rounded-lg transition-opacity"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Trash2 className="w-4 h-4" />}
              {loading ? 'Suppression…' : 'Supprimer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const EmployeeMyRequests: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats]       = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [demandes, setDemandes] = useState<ApiDemande[]>([]);
  const [produits, setProduits] = useState<ApiProduit[]>([]);

  const [statsLoading,    setStatsLoading]    = useState(true);
  const [demandesLoading, setDemandesLoading] = useState(true);
  const [produitsLoading, setProduitsLoading] = useState(true);

  const [showNew,       setShowNew]       = useState(false);
  const [editDemande,   setEditDemande]   = useState<ApiDemande | null>(null);
  const [deleteDemande, setDeleteDemande] = useState<ApiDemande | null>(null);
  const [filterStatut,  setFilterStatut]  = useState('');

  useEffect(() => {
    api.get('/demandes/stats').then(r => setStats(r.data)).finally(() => setStatsLoading(false));
    api.get('/demandes').then(r => setDemandes(r.data)).finally(() => setDemandesLoading(false));
    api.get('/produits').then(r => setProduits(r.data)).finally(() => setProduitsLoading(false));
  }, []);

  const handleCreated = (d: ApiDemande) => {
    setDemandes(prev => [d, ...prev]);
    setStats(prev => ({ ...prev, total: prev.total + 1, pending: prev.pending + 1 }));
  };

  const handleUpdated = (d: ApiDemande) =>
    setDemandes(prev => prev.map(x => x.id_demande === d.id_demande ? d : x));

  const handleDeleted = (id: number) => {
    setDemandes(prev => prev.filter(d => d.id_demande !== id));
    setStats(prev => ({ ...prev, total: prev.total - 1, pending: prev.pending - 1 }));
  };

  const filtered = filterStatut
    ? demandes.filter(d => d.statut === filterStatut)
    : demandes;

  const allStatuts = [...new Set(demandes.map(d => d.statut))].sort();

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes demandes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Bonjour {currentUser?.prenom} — suivi de toutes vos demandes
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors shadow-brand"
        >
          <Plus className="w-4 h-4" /> Nouvelle demande
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total"      value={stats.total}    icon={ClipboardList} color="bg-primary"   sub="Toutes mes demandes"    loading={statsLoading} />
        <StatCard title="En attente" value={stats.pending}  icon={Clock}         color="bg-amber-500" sub="En cours de traitement" loading={statsLoading} />
        <StatCard title="Approuvées" value={stats.approved} icon={CheckCircle}   color="bg-green-500" sub="Validées"               loading={statsLoading} />
        <StatCard title="Refusées"   value={stats.rejected} icon={AlertCircle}   color="bg-red-500"   sub="Rejetées"               loading={statsLoading} />
      </div>

      {/* Request list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">
              Historique <span className="text-xs font-normal text-muted-foreground">({filtered.length})</span>
            </h2>
          </div>
          <select
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
            className="ml-auto py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none"
          >
            <option value="">Tous les statuts</option>
            {allStatuts.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover"
          >
            <Plus className="w-3 h-3" /> Nouvelle
          </button>
        </div>

        {demandesLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucune demande trouvée.</p>
            <button onClick={() => setShowNew(true)} className="mt-3 text-xs text-primary hover:underline">
              Créer une demande
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-left">
                  {['#', 'Produits', 'Date', 'Statut', 'Resp. Dept', 'Resp. Stock', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((d, idx) => {
                  const isEditable = d.statut === 'EN_ATTENTE_DEPT';
                  return (
                    <tr key={d.id_demande ?? idx} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold text-foreground">#{d.id_demande}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-sm text-foreground truncate">
                          {d.details.map(x => x.nom ?? x.produit_nom ?? '—').join(', ')}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {d.details.length} article{d.details.length > 1 ? 's' : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{d.date_demande}</td>
                      <td className="px-4 py-3"><StatusBadge status={d.statut as any} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{d.responsable_dept ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{d.responsable_stock ?? '—'}</td>
                      <td className="px-4 py-3">
                        {isEditable ? (
                          <div className="flex items-center gap-1">
                            {/* Edit */}
                            <button
                              onClick={() => setEditDemande(d)}
                              title="Modifier"
                              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Pencil className="w-3 h-3" /> Modifier
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => setDeleteDemande(d)}
                              title="Supprimer"
                              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-status-rejected hover:bg-status-rejected/10 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" /> Supprimer
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNew && (
        <NewRequestModal
          produits={produits}
          onClose={() => setShowNew(false)}
          onCreated={d => { handleCreated(d); setShowNew(false); }}
        />
      )}
      {editDemande && (
        <EditDemandeModal
          demande={editDemande} produits={produits}
          onClose={() => setEditDemande(null)}
          onUpdated={d => { handleUpdated(d); setEditDemande(null); }}
        />
      )}
      {deleteDemande && (
        <DeleteConfirmModal
          demande={deleteDemande}
          onClose={() => setDeleteDemande(null)}
          onDeleted={id => { handleDeleted(id); setDeleteDemande(null); }}
        />
      )}
    </div>
  );
};

export default EmployeeMyRequests;