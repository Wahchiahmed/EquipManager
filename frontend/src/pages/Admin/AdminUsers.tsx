// src/pages/admin/AdminUsers.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Trash2, UserCheck, UserX, Loader2, X } from 'lucide-react';
import api from '@/lib/api';
import {
  ApiUser, Role, Departement, CreateUserForm,
  roleColors, roleLabels, EMPTY_USER_FORM, inputCls,
} from './AdminTypes';
import { ConfirmDialog, Field, PageHeader, LoadingSpinner } from './AdminShared';

// ── Create User Modal ─────────────────────────────────────────────────────────

const CreateUserModal: React.FC<{
  roles: Role[]; departements: Departement[];
  onClose: () => void; onCreated: (u: ApiUser) => void;
}> = ({ roles, departements, onClose, onCreated }) => {
  const [form, setForm] = useState<CreateUserForm>(EMPTY_USER_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (f: keyof CreateUserForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api.post('/users', {
        ...form,
        role_id: Number(form.role_id),
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
            <input type="password" required minLength={6} value={form.password} onChange={set('password')}
              placeholder="Minimum 6 caractères" className={inputCls} />
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

// ── Main Page ─────────────────────────────────────────────────────────────────

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departements, setDepts] = useState<Departement[]>([]);
  const [confirm, setConfirm] = useState<{ type: 'delete' | 'toggle'; user: ApiUser } | null>(null);
  const [actLoad, setActLoad] = useState<number | null>(null);

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
      await api.delete(`/users/${u.id_utilisateur}`);
      setUsers(p => p.filter(x => x.id_utilisateur !== u.id_utilisateur));
    } finally { setActLoad(null); setConfirm(null); }
  };

  const handleToggle = async (u: ApiUser) => {
    setActLoad(u.id_utilisateur);
    try {
      const r = await api.patch(`/users/${u.id_utilisateur}/toggle-active`);
      setUsers(p => p.map(x => x.id_utilisateur === u.id_utilisateur ? r.data.user : x));
    } finally { setActLoad(null); setConfirm(null); }
  };

  const filtered = users.filter(u =>
    `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" subtitle="Gérez les comptes et les accès de la plateforme" />

      {showCreate && (
        <CreateUserModal
          roles={roles} departements={departements}
          onClose={() => setShowCreate(false)}
          onCreated={u => setUsers(p => [u, ...p])}
        />
      )}

      {confirm && (
        <ConfirmDialog
          danger={confirm.type === 'delete'}
          message={
            confirm.type === 'delete'
              ? `Supprimer ${confirm.user.prenom} ${confirm.user.nom} ? Cette action est irréversible.`
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">
              Tous les utilisateurs{' '}
              <span className="ml-1 text-xs font-normal text-muted-foreground">({users.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text" placeholder="Rechercher..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-48"
              />
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Ajouter
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-left">
                  {['Utilisateur', 'Email', 'Rôle', 'Département', 'Statut', 'Créé le', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
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
                  <tr key={u.id_utilisateur}
                    className={`hover:bg-muted/30 transition-colors ${!u.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                          {u.prenom[0]}{u.nom[0]}
                        </div>
                        <p className="text-sm font-medium text-foreground">{u.prenom} {u.nom}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColors[u.role_nom]}`}>
                        {roleLabels[u.role_nom]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">{u.departement_nom}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold flex items-center gap-1 w-fit ${u.is_active ? 'text-status-approved' : 'text-muted-foreground'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-status-approved' : 'bg-muted-foreground'}`} />
                        {u.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.created_at}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          disabled={actLoad === u.id_utilisateur}
                          onClick={() => setConfirm({ type: 'toggle', user: u })}
                          className={`transition-colors ${u.is_active ? 'text-status-approved hover:text-amber-600' : 'text-muted-foreground hover:text-status-approved'}`}
                        >
                          {actLoad === u.id_utilisateur
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : u.is_active
                              ? <UserX className="w-3.5 h-3.5" />
                              : <UserCheck className="w-3.5 h-3.5" />
                          }
                        </button>
                        <button
                          disabled={actLoad === u.id_utilisateur}
                          onClick={() => setConfirm({ type: 'delete', user: u })}
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
  );
};

export default AdminUsers;