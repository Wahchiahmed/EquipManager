// src/pages/admin/AdminDepartements.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Plus, Trash2, Loader2, X, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { ApiDepartement } from './AdminTypes';
import { ConfirmDialog, PageHeader, LoadingSpinner } from './AdminShared';

const ITEMS_PER_PAGE = 10;

const AdminDepartements: React.FC = () => {
  const [departements, setDepts] = useState<ApiDepartement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState<ApiDepartement | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // État de pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    api.get('/departements').then(r => setDepts(r.data)).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(''); setCreating(true);
    try {
      const r = await api.post('/departements', { nom: newNom });
      setDepts(p => [...p, r.data]);
      setNewNom(''); setShowForm(false);
      // Optionnel : on peut ramener l'utilisateur à la dernière page s'il y a un ajout, 
      // ou le laisser sur la page courante.
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors?.nom?.[0];
      setFormError(typeof m === 'string' ? m : 'Erreur.');
    } finally { setCreating(false); }
  };

  const handleDelete = async (d: ApiDepartement) => {
    setDeleting(d.id); setDeleteError('');
    try {
      await api.delete(`/departements/${d.id}`);
      setDepts(p => {
        const newData = p.filter(x => x.id !== d.id);
        // Si la page courante devient vide après suppression, on recule d'une page
        if (currentPage > Math.ceil(newData.length / ITEMS_PER_PAGE) && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
        }
        return newData;
      });
      setConfirm(null);
    } catch (err: any) {
      setDeleteError(err.response?.data?.message ?? 'Impossible de supprimer.');
      setConfirm(null);
    } finally { setDeleting(null); }
  };

  // Logique de pagination
  const totalPages = Math.ceil(departements.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return departements.slice(start, start + ITEMS_PER_PAGE);
  }, [departements, currentPage]);

  return (
    <div className="space-y-6">
      <PageHeader title="Départements" subtitle="Gérez la structure organisationnelle de votre entreprise" />

      {confirm && (
        <ConfirmDialog
          danger
          message={`Supprimer le département "${confirm.nom}" ? Cette action est irréversible.`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => handleDelete(confirm)}
        />
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">
              Tous les départements{' '}
              <span className="ml-1 text-xs font-normal text-muted-foreground">({departements.length})</span>
            </h2>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setFormError(''); setNewNom(''); }}
            className="text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Ajouter
          </button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <form onSubmit={handleCreate} className="flex items-start gap-3">
              <div className="flex-1">
                <input
                  type="text" required autoFocus placeholder="Nom du département..."
                  value={newNom} onChange={e => setNewNom(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {formError && <p className="text-xs text-status-rejected mt-1.5">{formError}</p>}
              </div>
              <button
                type="submit" disabled={creating}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-60"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {creating ? 'Création...' : 'Créer'}
              </button>
              <button
                type="button" onClick={() => setShowForm(false)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {deleteError && (
          <div className="mx-5 mt-4 flex items-start gap-2 text-xs text-status-rejected bg-status-rejected-bg border border-status-rejected/30 px-3 py-2.5 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {deleteError}
            <button onClick={() => setDeleteError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : departements.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">Aucun département trouvé.</p>
        ) : (
          <div className="flex flex-col flex-1">
            <div className="divide-y divide-border">
              {paginatedData.map(d => (
                <div key={d.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{d.nom}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.users_count} utilisateur{d.users_count !== 1 ? 's' : ''} · Créé le {d.created_at}
                    </p>
                  </div>
                  <button
                    disabled={deleting === d.id} onClick={() => setConfirm(d)}
                    className="text-muted-foreground hover:text-status-rejected transition-colors disabled:opacity-40"
                  >
                    {deleting === d.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              ))}
            </div>

            {/* Contrôles de pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  Affichage de <span className="font-semibold text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> à <span className="font-semibold text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, departements.length)}</span> sur <span className="font-semibold text-foreground">{departements.length}</span>
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

export default AdminDepartements;