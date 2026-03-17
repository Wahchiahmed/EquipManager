// src/pages/admin/AdminUsers.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, Trash2, UserCheck, UserX,
  Loader2, X, Pencil, KeyRound, ShieldCheck,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import api from '@/lib/api';
import {
  ApiUser, Role, Departement, CreateUserForm,
  roleColors, roleLabels, EMPTY_USER_FORM, inputCls,
} from './adminTypes';
import { ConfirmDialog, Field, PageHeader, LoadingSpinner } from './AdminShared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditUserForm {
  nom:            string;
  prenom:         string;
  email:          string;
  telephone:      string;
  role_id:        string;
  departement_id: string;
  password:       string; // optional — only sent if filled
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Map the formatted role_nom string back to the role id
const roleNomToId = (roleNom: string, roles: Role[]): string => {
  const nomMap: Record<string, string> = {
    ADMIN:                    'admin',
    EMPLOYEE:                 'employe',
    RESPONSABLE_DEPARTEMENT:  'responsable departement',
    RESPONSABLE_STOCK:        'responsable stock',
  };
  const rawNom = nomMap[roleNom] ?? roleNom.toLowerCase();
  const match  = roles.find(r => r.nom.toLowerCase() === rawNom);
  return match ? String(match.id) : '';
};

// ─── Create User Modal ────────────────────────────────────────────────────────

const CreateUserModal: React.FC<{
  roles: Role[]; departements: Departement[];
  onClose: () => void; onCreated: (u: ApiUser) => void;
}> = ({ roles, departements, onClose, onCreated }) => {
  const [form, setForm]     = useState<CreateUserForm>(EMPTY_USER_FORM);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (f: keyof CreateUserForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api.post('/users', {
        ...form,
        role_id:        Number(form.role_id),
        departement_id: form.departement_id ? Number(form.departement_id) : null,
      });
      onCreated(res.data); onClose();
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors;
      setError(typeof m === 'string' ? m : 'Une erreur est survenue.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Créer un utilisateur</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {([['prenom', 'Prénom'], ['nom', 'Nom']] as [keyof CreateUserForm, string][]).map(([f, l]) => (
              <Field key={f} label={l} required>
                <input type="text" required value={form[f]} onChange={set(f)} className={inputCls} />
              </Field>
            ))}
          </div>
          <Field label="Email" required>
            <input type="email" required value={form.email} onChange={set('email')} className={inputCls} />
          </Field>
          <Field label="Mot de passe" required>
            <input type="password" required minLength={6} value={form.password}
              onChange={set('password')} placeholder="Minimum 6 caractères" className={inputCls} />
          </Field>
          <Field label="Téléphone">
            <input type="text" value={form.telephone} onChange={set('telephone')} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Rôle" required>
              <select required value={form.role_id} onChange={set('role_id')} className={inputCls}>
                <option value="">Choisir...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
              </select>
            </Field>
            <Field label="Département">
              <select value={form.departement_id} onChange={set('departement_id')} className={inputCls}>
                <option value="">Aucun</option>
                {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
            </Field>
          </div>
          {error && (
            <p className="text-xs text-status-rejected bg-status-rejected-bg border border-status-rejected/30 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Création...' : "Créer l'utilisateur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Edit User Modal ──────────────────────────────────────────────────────────

const EditUserModal: React.FC<{
  user:         ApiUser;
  roles:        Role[];
  departements: Departement[];
  onClose:      () => void;
  onUpdated:    (u: ApiUser) => void;
}> = ({ user, roles, departements, onClose, onUpdated }) => {

  const [form, setForm]       = useState<EditUserForm>({
    nom:            user.nom,
    prenom:         user.prenom,
    email:          user.email,
    telephone:      user.telephone ?? '',
    role_id:        roleNomToId(user.role_nom, roles),
    departement_id: user.departement_id ? String(user.departement_id) : '',
    password:       '',
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const set = (f: keyof EditUserForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [f]: e.target.value }));

  // Detect what actually changed to show a summary
  const changes = {
    nom:            form.nom            !== user.nom,
    prenom:         form.prenom         !== user.prenom,
    email:          form.email          !== user.email,
    telephone:      form.telephone      !== (user.telephone ?? ''),
    role_id:        form.role_id        !== roleNomToId(user.role_nom, roles),
    departement_id: form.departement_id !== (user.departement_id ? String(user.departement_id) : ''),
    password:       form.password.length > 0,
  };
  const hasChanges = Object.values(changes).some(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) { onClose(); return; }
    setError(''); setLoading(true);

    const payload: Record<string, unknown> = {};
    if (changes.nom)            payload.nom            = form.nom;
    if (changes.prenom)         payload.prenom         = form.prenom;
    if (changes.email)          payload.email          = form.email;
    if (changes.telephone)      payload.telephone      = form.telephone || null;
    if (changes.role_id)        payload.role_id        = Number(form.role_id);
    if (changes.departement_id) payload.departement_id = form.departement_id ? Number(form.departement_id) : null;
    if (changes.password)       payload.password       = form.password;

    try {
      const res = await api.put(`/users/${user.id_utilisateur}`, payload);
      onUpdated(res.data); onClose();
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors;
      setError(typeof m === 'string' ? m : 'Une erreur est survenue.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
              {user.prenom[0]}{user.nom[0]}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Modifier l'utilisateur</h3>
              <p className="text-xs text-muted-foreground">{user.prenom} {user.nom}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">

            {/* ── Identity ── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Identité
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Prénom" required>
                  <input
                    type="text" required value={form.prenom} onChange={set('prenom')}
                    className={`${inputCls} ${changes.prenom ? 'border-primary/50 bg-primary/5' : ''}`}
                  />
                </Field>
                <Field label="Nom" required>
                  <input
                    type="text" required value={form.nom} onChange={set('nom')}
                    className={`${inputCls} ${changes.nom ? 'border-primary/50 bg-primary/5' : ''}`}
                  />
                </Field>
              </div>
            </div>

            {/* ── Contact ── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Contact
              </p>
              <div className="space-y-3">
                <Field label="Adresse email" required>
                  <input
                    type="email" required value={form.email} onChange={set('email')}
                    className={`${inputCls} ${changes.email ? 'border-primary/50 bg-primary/5' : ''}`}
                  />
                </Field>
                <Field label="Téléphone">
                  <input
                    type="text" value={form.telephone} onChange={set('telephone')}
                    className={`${inputCls} ${changes.telephone ? 'border-primary/50 bg-primary/5' : ''}`}
                  />
                </Field>
              </div>
            </div>

            {/* ── Role & Department ── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Accès & Organisation
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Rôle" required>
                  <select
                    required value={form.role_id} onChange={set('role_id')}
                    className={`${inputCls} ${changes.role_id ? 'border-amber-400/70 bg-amber-50 dark:bg-amber-900/10' : ''}`}
                  >
                    <option value="">Choisir...</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                  </select>
                  {changes.role_id && (
                    <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                      ⚠ Changement de rôle — l'utilisateur sera déconnecté
                    </p>
                  )}
                </Field>
                <Field label="Département">
                  <select
                    value={form.departement_id} onChange={set('departement_id')}
                    className={`${inputCls} ${changes.departement_id ? 'border-primary/50 bg-primary/5' : ''}`}
                  >
                    <option value="">Aucun</option>
                    {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            {/* ── Password ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Mot de passe
                </p>
                <button
                  type="button"
                  onClick={() => { setShowPwd(v => !v); setForm(p => ({ ...p, password: '' })); }}
                  className="text-xs text-primary hover:underline"
                >
                  {showPwd ? 'Annuler le changement' : 'Changer le mot de passe'}
                </button>
              </div>
              {showPwd ? (
                <Field label="Nouveau mot de passe">
                  <input
                    type="password" minLength={6} value={form.password} onChange={set('password')}
                    placeholder="Minimum 6 caractères"
                    className={`${inputCls} ${changes.password ? 'border-primary/50 bg-primary/5' : ''}`}
                    autoFocus
                  />
                </Field>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2.5">
                  Laissez vide pour conserver le mot de passe actuel.
                </p>
              )}
            </div>

            {/* Changes summary */}
            {hasChanges && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
                <p className="text-xs font-medium text-primary mb-1">Modifications en cours :</p>
                <ul className="space-y-0.5">
                  {changes.prenom         && <li className="text-xs text-muted-foreground">· Prénom → <strong>{form.prenom}</strong></li>}
                  {changes.nom            && <li className="text-xs text-muted-foreground">· Nom → <strong>{form.nom}</strong></li>}
                  {changes.email          && <li className="text-xs text-muted-foreground">· Email → <strong>{form.email}</strong></li>}
                  {changes.telephone      && <li className="text-xs text-muted-foreground">· Téléphone → <strong>{form.telephone || '—'}</strong></li>}
                  {changes.role_id        && <li className="text-xs text-muted-foreground">· Rôle → <strong>{roles.find(r => String(r.id) === form.role_id)?.nom ?? '?'}</strong></li>}
                  {changes.departement_id && <li className="text-xs text-muted-foreground">· Département → <strong>{departements.find(d => String(d.id) === form.departement_id)?.nom ?? 'Aucun'}</strong></li>}
                  {changes.password       && <li className="text-xs text-muted-foreground">· Mot de passe modifié</li>}
                </ul>
              </div>
            )}

            {error && (
              <p className="text-xs text-status-rejected bg-status-rejected-bg border border-status-rejected/30 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit" disabled={loading || !hasChanges}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60 transition-colors"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Enregistrement...' : hasChanges ? 'Enregistrer les modifications' : 'Aucune modification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Toast ───────────────────────────────────────────────────────────────────

const Toast: React.FC<{
  msg: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
}> = ({ msg, type, onClose }) => {
  const styles = {
    success: 'bg-green-600',
    error:   'bg-red-600',
    warning: 'bg-amber-500',
  };
  const Icon = type === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium ${styles[type]}`}>
      <Icon className="w-5 h-5 shrink-0" />
      <span className="max-w-xs">{msg}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AdminUsers: React.FC = () => {
  const [users, setUsers]           = useState<ApiUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser]     = useState<ApiUser | null>(null);
  const [roles, setRoles]           = useState<Role[]>([]);
  const [departements, setDepts]    = useState<Departement[]>([]);
  const [confirm, setConfirm]       = useState<{ type: 'delete' | 'toggle'; user: ApiUser } | null>(null);
  const [actLoad, setActLoad]       = useState<number | null>(null);
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/users'); setUsers(r.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchUsers();
    api.get('/users/form-data').then(r => {
      setRoles(r.data.roles);
      setDepts(r.data.departements);
    });
  }, [fetchUsers]);

  const handleDelete = async (u: ApiUser) => {
    setActLoad(u.id_utilisateur);
    try {
      const res = await api.delete(`/users/${u.id_utilisateur}`);
      setUsers(p => p.filter(x => x.id_utilisateur !== u.id_utilisateur));
      const nb = res.data?.demandes_annulees ?? 0;
      if (nb > 0) {
        setToast({
          msg: `Utilisateur supprimé. ${nb} demande${nb > 1 ? 's' : ''} annulée${nb > 1 ? 's' : ''} automatiquement.`,
          type: 'warning',
        });
      } else {
        setToast({ msg: `Utilisateur supprimé avec succès.`, type: 'success' });
      }
    } catch (err: any) {
      setToast({ msg: err.response?.data?.message ?? 'Erreur lors de la suppression.', type: 'error' });
    } finally { setActLoad(null); setConfirm(null); }
  };

  const handleToggle = async (u: ApiUser) => {
    setActLoad(u.id_utilisateur);
    try {
      const r = await api.patch(`/users/${u.id_utilisateur}/toggle-active`);
      setUsers(p => p.map(x => x.id_utilisateur === u.id_utilisateur ? r.data.user : x));
    } finally { setActLoad(null); setConfirm(null); }
  };

  const handleUpdated = (updated: ApiUser) => {
    setUsers(p => p.map(u => u.id_utilisateur === updated.id_utilisateur ? updated : u));
  };

  const filtered = users.filter(u => {
    const matchSearch = `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole   = filterRole ? u.role_nom === filterRole : true;
    return matchSearch && matchRole;
  });

  const roleOptions = [...new Set(users.map(u => u.role_nom))];

  return (
    <>
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" subtitle="Gérez les comptes et les accès de la plateforme" />

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          roles={roles} departements={departements}
          onClose={() => setShowCreate(false)}
          onCreated={u => setUsers(p => [u, ...p])}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          roles={roles}
          departements={departements}
          onClose={() => setEditUser(null)}
          onUpdated={u => { handleUpdated(u); setEditUser(null); }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          danger={confirm.type === 'delete'}
          message={
            confirm.type === 'delete'
              ? `Supprimer définitivement ${confirm.user.prenom} ${confirm.user.nom} ? \u26a0 Ses demandes EN_ATTENTE seront annulées. Son historique sera conservé (affiché comme Utilisateur supprimé).`
              : confirm.user.is_active
                ? `Désactiver ${confirm.user.prenom} ${confirm.user.nom} ? Il sera déconnecté immédiatement.`
                : `Réactiver ${confirm.user.prenom} ${confirm.user.nom} ?`
          }
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            confirm.type === 'delete' ? handleDelete(confirm.user) : handleToggle(confirm.user)
          }
        />
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">
              Tous les utilisateurs
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({filtered.length}/{users.length})
              </span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text" placeholder="Nom, email..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-44"
              />
            </div>
            {/* Role filter */}
            <select
              value={filterRole} onChange={e => setFilterRole(e.target.value)}
              className="py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none"
            >
              <option value="">Tous les rôles</option>
              {roleOptions.map(r => (
                <option key={r} value={r}>{roleLabels[r] ?? r}</option>
              ))}
            </select>
            {/* Add button */}
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Ajouter
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 px-5 py-2.5 border-b border-border bg-muted/20">
          {Object.entries(roleLabels).map(([key, label]) => {
            const count = users.filter(u => u.role_nom === key).length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setFilterRole(filterRole === key ? '' : key)}
                className={`flex items-center gap-1.5 text-xs transition-colors ${filterRole === key ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  key === 'ADMIN' ? 'bg-red-500'
                  : key === 'EMPLOYEE' ? 'bg-blue-500'
                  : key === 'RESPONSABLE_DEPARTEMENT' ? 'bg-amber-500'
                  : 'bg-purple-500'
                }`} />
                {label} ({count})
              </button>
            );
          })}
          <span className="ml-auto text-xs text-muted-foreground">
            {users.filter(u => u.is_active).length} actifs · {users.filter(u => !u.is_active).length} inactifs
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-left">
                  {['Utilisateur', 'Email', 'Téléphone', 'Rôle', 'Département', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : filtered.map(u => (
                  <tr
                    key={u.id_utilisateur}
                    className={`hover:bg-muted/30 transition-colors group ${!u.is_active ? 'opacity-60' : ''}`}
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {u.prenom[0]}{u.nom[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{u.prenom} {u.nom}</p>
                          <p className="text-[11px] text-muted-foreground">#{u.id_utilisateur}</p>
                        </div>
                      </div>
                    </td>
                    {/* Email */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                    {/* Phone */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.telephone ?? '—'}</td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColors[u.role_nom]}`}>
                        {roleLabels[u.role_nom]}
                      </span>
                    </td>
                    {/* Department */}
                    <td className="px-4 py-3 text-xs text-foreground">{u.departement_nom}</td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold flex items-center gap-1 w-fit ${u.is_active ? 'text-status-approved' : 'text-muted-foreground'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-status-approved' : 'bg-muted-foreground'}`} />
                        {u.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Edit — always visible */}
                        <button
                          onClick={() => setEditUser(u)}
                          title="Modifier"
                          className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-muted hover:bg-border border border-border transition-colors text-foreground opacity-0 group-hover:opacity-100"
                        >
                          <Pencil className="w-3 h-3" /> Modifier
                        </button>
                        {/* Toggle active */}
                        <button
                          disabled={actLoad === u.id_utilisateur}
                          onClick={() => setConfirm({ type: 'toggle', user: u })}
                          title={u.is_active ? 'Désactiver' : 'Activer'}
                          className={`transition-colors ${u.is_active ? 'text-status-approved hover:text-amber-600' : 'text-muted-foreground hover:text-status-approved'}`}
                        >
                          {actLoad === u.id_utilisateur
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : u.is_active
                              ? <UserX className="w-3.5 h-3.5" />
                              : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        {/* Delete */}
                        <button
                          disabled={actLoad === u.id_utilisateur}
                          onClick={() => setConfirm({ type: 'delete', user: u })}
                          title="Supprimer"
                          className="text-muted-foreground hover:text-status-rejected transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

      {/* Toast */}
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
};

export default AdminUsers;