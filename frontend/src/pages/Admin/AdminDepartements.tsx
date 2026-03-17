// src/pages/admin/AdminDepartements.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2, Plus, Trash2, Loader2, X, AlertTriangle,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Pencil, Check, UserPlus, UserMinus, Users, Search,
} from 'lucide-react';
import api from '@/lib/api';
import { ApiDepartement } from './adminTypes';
import { ConfirmDialog, PageHeader, LoadingSpinner } from './AdminShared';

const ITEMS_PER_PAGE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeptMember {
  id:        number;
  nom:       string;
  prenom:    string;
  email:     string;
  role_nom:  string;
  is_active: boolean;
}

interface AvailableUser {
  id:       number;
  nom:      string;
  prenom:   string;
  email:    string;
  role_nom: string;
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const roleColor: Record<string, string> = {
  'admin':                    'bg-red-100 text-red-700',
  'employe':                  'bg-blue-100 text-blue-700',
  'responsable departement':  'bg-amber-100 text-amber-700',
  'responsable stock':        'bg-purple-100 text-purple-700',
};

const RoleBadge: React.FC<{ nom: string }> = ({ nom }) => (
  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${roleColor[nom.toLowerCase()] ?? 'bg-muted text-muted-foreground'}`}>
    {nom}
  </span>
);

// ─── Assign User Modal ────────────────────────────────────────────────────────

const AssignUserModal: React.FC<{
  departement: ApiDepartement;
  onClose:     () => void;
  onAssigned:  (member: DeptMember, updatedDept: ApiDepartement) => void;
}> = ({ departement, onClose, onAssigned }) => {
  const [users, setUsers]       = useState<AvailableUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    api.get('/departements/available-users')
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u =>
    `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async () => {
    if (!selected) return;
    setSaving(true); setError('');
    try {
      const res = await api.post(`/departements/${departement.id}/assign`, { user_id: selected });
      onAssigned(res.data.user, res.data.departement);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erreur.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">Affecter un utilisateur</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Département : <span className="font-medium text-foreground">{departement.nom}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text" placeholder="Rechercher un utilisateur..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* User list */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {users.length === 0
                  ? 'Tous les utilisateurs ont déjà un département.'
                  : 'Aucun utilisateur trouvé.'}
              </p>
            </div>
          ) : filtered.map(u => (
            <button
              key={u.id}
              onClick={() => setSelected(u.id === selected ? null : u.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 transition-colors text-left
                ${selected === u.id ? 'bg-primary/10 border-primary/20' : 'hover:bg-muted/40'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${selected === u.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {u.prenom[0]}{u.nom[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{u.prenom} {u.nom}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <RoleBadge nom={u.role_nom} />
              {selected === u.id && (
                <Check className="w-4 h-4 text-primary shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border shrink-0 space-y-3">
          {error && <p className="text-xs text-status-rejected">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted transition-colors">
              Annuler
            </button>
            <button
              onClick={handleAssign}
              disabled={!selected || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Affectation...' : 'Affecter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Department Row (expandable) ─────────────────────────────────────────────

const DeptRow: React.FC<{
  dept:       ApiDepartement;
  onRenamed:  (updated: ApiDepartement) => void;
  onDeleted:  (id: number) => void;
  onUpdated:  (updated: ApiDepartement) => void;
}> = ({ dept, onRenamed, onDeleted, onUpdated }) => {

  const [expanded, setExpanded]     = useState(false);
  const [members, setMembers]       = useState<DeptMember[]>([]);
  const [membersLoading, setMLoad]  = useState(false);
  const [membersFetched, setFetched]= useState(false);

  // Rename state
  const [renaming, setRenaming]     = useState(false);
  const [newNom, setNewNom]         = useState(dept.nom);
  const [renameLoading, setRLoading]= useState(false);
  const [renameError, setRError]    = useState('');

  // Assign modal
  const [showAssign, setShowAssign] = useState(false);

  // Unassign state
  const [unassigning, setUnassigning] = useState<number | null>(null);
  const [confirmUnassign, setConfirmUnassign] = useState<DeptMember | null>(null);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Fetch members when expanding
  const fetchMembers = useCallback(async () => {
    setMLoad(true);
    try {
      const r = await api.get(`/departements/${dept.id}/users`);
      setMembers(r.data);
      setFetched(true);
    } finally { setMLoad(false); }
  }, [dept.id]);

  const handleExpand = () => {
    setExpanded(v => !v);
    if (!membersFetched) fetchMembers();
  };

  // Rename
  const handleRename = async () => {
    if (newNom.trim() === dept.nom) { setRenaming(false); return; }
    setRLoading(true); setRError('');
    try {
      const r = await api.patch(`/departements/${dept.id}`, { nom: newNom.trim() });
      onRenamed(r.data);
      setRenaming(false);
    } catch (err: any) {
      setRError(err.response?.data?.message ?? 'Erreur lors du renommage.');
    } finally { setRLoading(false); }
  };

  const cancelRename = () => {
    setNewNom(dept.nom);
    setRenaming(false);
    setRError('');
  };

  // Unassign
  const handleUnassign = async (member: DeptMember) => {
    setUnassigning(member.id);
    try {
      const r = await api.delete(`/departements/${dept.id}/users/${member.id}`);
      setMembers(prev => prev.filter(m => m.id !== member.id));
      onUpdated(r.data.departement);
      setConfirmUnassign(null);
    } catch (err: any) {
      console.error(err);
    } finally { setUnassigning(null); }
  };

  // Delete dept
  const handleDelete = async () => {
    setDeleting(true); setDeleteError('');
    try {
      await api.delete(`/departements/${dept.id}`);
      onDeleted(dept.id);
    } catch (err: any) {
      setDeleteError(err.response?.data?.message ?? 'Impossible de supprimer.');
      setConfirmDelete(false);
    } finally { setDeleting(false); }
  };

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          danger
          message={`Supprimer le département "${dept.nom}" ? Cette action est irréversible.`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
      {confirmUnassign && (
        <ConfirmDialog
          message={`Retirer ${confirmUnassign.prenom} ${confirmUnassign.nom} du département "${dept.nom}" ?`}
          onCancel={() => setConfirmUnassign(null)}
          onConfirm={() => handleUnassign(confirmUnassign)}
        />
      )}
      {showAssign && (
        <AssignUserModal
          departement={dept}
          onClose={() => setShowAssign(false)}
          onAssigned={(member, updatedDept) => {
            setMembers(prev => [...prev, member]);
            onUpdated(updatedDept);
          }}
        />
      )}

      {/* Main row */}
      <div className={`border-b border-border ${expanded ? 'bg-primary/3' : ''}`}>
        <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group">

          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>

          {/* Name — inline edit */}
          <div className="flex-1 min-w-0">
            {renaming ? (
              <div className="flex items-center gap-2">
                <input
                  type="text" autoFocus value={newNom}
                  onChange={e => setNewNom(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') cancelRename(); }}
                  className="flex-1 px-2.5 py-1.5 text-sm font-semibold bg-card border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={handleRename} disabled={renameLoading || !newNom.trim()}
                  className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
                >
                  {renameLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={cancelRename} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{dept.nom}</p>
                <button
                  onClick={() => { setRenaming(true); setNewNom(dept.nom); }}
                  title="Renommer"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-primary transition-all"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            {renameError && <p className="text-xs text-status-rejected mt-1">{renameError}</p>}
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className={`font-medium ${dept.users_count > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {dept.users_count}
              </span>{' '}
              utilisateur{dept.users_count !== 1 ? 's' : ''} · Créé le {dept.created_at}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Assign user */}
            <button
              onClick={() => { setShowAssign(true); if (!membersFetched) fetchMembers(); }}
              title="Affecter un utilisateur"
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" /> Affecter
            </button>
            {/* Expand members */}
            <button
              onClick={handleExpand}
              title={expanded ? 'Masquer les membres' : 'Voir les membres'}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-border border border-border transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {/* Delete */}
            <button
              disabled={deleting}
              onClick={() => setConfirmDelete(true)}
              title="Supprimer le département"
              className="text-muted-foreground hover:text-status-rejected transition-colors disabled:opacity-40"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {deleteError && (
          <div className="mx-5 mb-3 flex items-center gap-2 text-xs text-status-rejected bg-status-rejected-bg border border-status-rejected/30 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {deleteError}
            <button onClick={() => setDeleteError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* ── Expanded members panel ── */}
        {expanded && (
          <div className="mx-5 mb-4 border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Membres ({members.length})
              </p>
              <button
                onClick={() => setShowAssign(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <UserPlus className="w-3 h-3" /> Affecter un utilisateur
              </button>
            </div>

            {membersLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Chargement...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="py-6 text-center">
                <Users className="w-6 h-6 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">Aucun membre dans ce département.</p>
                <button
                  onClick={() => setShowAssign(true)}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Affecter le premier membre
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group/member">
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                      ${m.is_active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {m.prenom[0]}{m.nom[0]}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{m.prenom} {m.nom}</p>
                        {!m.is_active && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactif</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    {/* Role */}
                    <RoleBadge nom={m.role_nom} />
                    {/* Unassign */}
                    <button
                      disabled={unassigning === m.id}
                      onClick={() => setConfirmUnassign(m)}
                      title="Retirer du département"
                      className="opacity-0 group-hover/member:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-status-rejected hover:bg-status-rejected/10 transition-all disabled:opacity-40"
                    >
                      {unassigning === m.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <UserMinus className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AdminDepartements: React.FC = () => {
  const [departements, setDepts] = useState<ApiDepartement[]>([]);
  const [loading, setLoading]    = useState(true);
  const [showForm, setShowForm]  = useState(false);
  const [newNom, setNewNom]      = useState('');
  const [creating, setCreating]  = useState(false);
  const [formError, setFormError]= useState('');
  const [search, setSearch]      = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    api.get('/departements')
      .then(r => setDepts(r.data))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(''); setCreating(true);
    try {
      const r = await api.post('/departements', { nom: newNom });
      setDepts(p => [...p, r.data]);
      setNewNom(''); setShowForm(false);
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors?.nom?.[0];
      setFormError(typeof m === 'string' ? m : 'Erreur.');
    } finally { setCreating(false); }
  };

  const handleRenamed = (updated: ApiDepartement) => {
    setDepts(p => p.map(d => d.id === updated.id ? updated : d));
  };

  const handleDeleted = (id: number) => {
    setDepts(p => {
      const newData = p.filter(d => d.id !== id);
      const maxPage = Math.max(1, Math.ceil(newData.length / ITEMS_PER_PAGE));
      if (currentPage > maxPage) setCurrentPage(maxPage);
      return newData;
    });
  };

  const handleUpdated = (updated: ApiDepartement) => {
    setDepts(p => p.map(d => d.id === updated.id ? updated : d));
  };

  const filtered = departements.filter(d =>
    d.nom.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages    = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  // Reset page on search change
  useEffect(() => { setCurrentPage(1); }, [search]);

  return (
    <div className="space-y-6">
      <PageHeader title="Départements" subtitle="Gérez la structure organisationnelle et les affectations" />

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">
              Tous les départements{' '}
              <span className="ml-1 text-xs font-normal text-muted-foreground">({departements.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text" placeholder="Rechercher..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-40"
              />
            </div>
            {/* Add */}
            <button
              onClick={() => { setShowForm(v => !v); setFormError(''); setNewNom(''); }}
              className="text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Ajouter
            </button>
          </div>
        </div>

        {/* Create form */}
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

        {/* Stats bar */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border bg-muted/20 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{departements.reduce((s, d) => s + d.users_count, 0)}</strong>{' '}
            utilisateurs affectés au total
          </span>
          <span>·</span>
          <span>
            <strong className="text-foreground">{departements.filter(d => d.users_count === 0).length}</strong>{' '}
            département{departements.filter(d => d.users_count === 0).length !== 1 ? 's' : ''} vide{departements.filter(d => d.users_count === 0).length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            {departements.length === 0 ? 'Aucun département créé.' : 'Aucun résultat pour cette recherche.'}
          </p>
        ) : (
          <div className="flex flex-col flex-1">
            {paginatedData.map(d => (
              <DeptRow
                key={d.id}
                dept={d}
                onRenamed={handleRenamed}
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
              />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md bg-card border border-border disabled:opacity-50 hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold px-2 text-muted-foreground">
                    Page {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md bg-card border border-border disabled:opacity-50 hover:bg-muted transition-colors"
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