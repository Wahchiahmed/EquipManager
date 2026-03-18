// src/pages/dashboards/AdminDashboard.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Building2, Package, Shield, BarChart3, FileText,
  Plus, Search, Trash2, ArrowUp, ArrowDown, Tag,
  UserCheck, UserX, X, Loader2, AlertTriangle, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight, Layers, UserPlus,
  Check, Clock, Mail, BadgeCheck, ShieldX, RefreshCw,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import ProductLotsModal from '../Admin/ProductLotsModal';
import LotConsumptionDetails from '../Admin/LotConsumptionDetails';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApiUser {
  id_utilisateur: number; nom: string; prenom: string; email: string;
  telephone: string | null; is_active: boolean; role_id: number;
  role_nom: 'ADMIN' | 'EMPLOYEE' | 'RESPONSABLE_DEPARTEMENT' | 'RESPONSABLE_STOCK';
  departement_id: number | null; departement_nom: string; created_at: string;
}
interface ApiDepartement { id: number; nom: string; users_count: number; created_at: string; }
interface ApiCategorie   { id_categorie: number; nom_categorie: string; description: string | null; produits_count: number; created_at: string; }
interface ApiProduit {
  id_produit: number; nom_produit: string; description: string | null;
  reference: string | null; code_barre: string | null;
  quantite: number; seuil_alerte: number; is_active: boolean; en_alerte: boolean;
  id_categorie: number; categorie_nom: string; created_at: string;
}
interface ApiDemandeDetail {
  id_detail: number; id_produit: number; produit_nom?: string; nom?: string;
  reference: string | null; quantite: number; statut?: string; commentaire_stock?: string | null;
}
interface ApiDemande {
  id_demande: number; date_demande: string; statut: string; commentaire: string | null;
  id_demandeur: number; demandeur_nom?: string; demandeur_prenom?: string; departement_nom?: string;
  demandeur?: { id: number; nom: string; prenom: string; departement?: { nom: string } | null } | null;
  responsable_dept: string | null; responsable_stock: string | null;
  date_validation_dept: string | null; date_validation_stock: string | null;
  details: ApiDemandeDetail[];
}
interface ApiMouvement {
  id_mouvement: number; type_mouvement: 'IN' | 'OUT';
  quantite_mouvement: number; quantite_avant: number; quantite_apres: number;
  date_mouvement: string; note?: string | null;
  produit?: { id_produit: number; nom_produit: string; reference?: string | null } | null;
  user?: { id: number; nom: string; prenom: string } | null;
  demande?: { id_demande: number } | null;
}
interface ApiAuditUser { id: number; nom: string; prenom: string; email?: string; }
interface ApiDetailHistorique {
  id_details?: number; champs_modifie: string; ancien_valeur: string | null;
  nouveau_valeur: string | null; info_detail: string | null; commentaire: string | null; created_at?: string;
}
interface ApiHistorique {
  id_historique: number; date_action: string; table_modifiee: string;
  type_action: 'INSERT' | 'UPDATE' | 'DELETE' | 'ACTION'; description: string;
  reference_objet: string | null; user?: ApiAuditUser | null; details?: ApiDetailHistorique[];
}
interface Role        { id: number; nom: string; }
interface Departement { id: number; nom: string; }
interface CategorieOption { id_categorie: number; nom_categorie: string; }
interface CreateUserForm {
  nom: string; prenom: string; email: string; password: string;
  telephone: string; role_id: string; departement_id: string;
}
interface ProduitForm {
  nom_produit: string; description: string; reference: string;
  code_barre: string; quantite: string; seuil_alerte: string;
  id_categorie: string; is_active: boolean;
}

// ── Inscription types ──────────────────────────────────────────────────────────

interface ApiInscription {
  id: number;
  nom: string; prenom: string; email: string; cin: string | null;
  telephone: string | null; role_id: number; role_nom: string;
  statut: 'en_attente' | 'accepte' | 'refuse';
  commentaire_admin: string | null;
  traite_par_nom: string | null; traite_le: string | null;
  created_at: string;
}
interface InscriptionStats {
  en_attente: number; acceptes: number; refuses: number; total: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;
const STATUTS_AVEC_LOTS = ['VALIDEE', 'PARTIELLEMENT_VALIDEE', 'LIVREE', 'REFUSEE_STOCK'];

const roleColors: Record<string, string> = {
  EMPLOYEE: 'bg-blue-100 text-blue-700', RESPONSABLE_DEPARTEMENT: 'bg-amber-100 text-amber-700',
  RESPONSABLE_STOCK: 'bg-purple-100 text-purple-700', ADMIN: 'bg-red-100 text-red-700',
};
const roleLabels: Record<string, string> = {
  EMPLOYEE: 'Employé', RESPONSABLE_DEPARTEMENT: 'Resp. Département',
  RESPONSABLE_STOCK: 'Resp. Stock', ADMIN: 'Admin',
};
const EMPTY_USER_FORM: CreateUserForm = { nom: '', prenom: '', email: '', password: '', telephone: '', role_id: '', departement_id: '' };
const EMPTY_PRODUIT_FORM: ProduitForm = { nom_produit: '', description: '', reference: '', code_barre: '', quantite: '0', seuil_alerte: '5', id_categorie: '', is_active: true };
const inputCls = "w-full px-3 py-2 text-sm bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const inscriptionRoleLabel = (nom: string) => {
  const m: Record<string, string> = {
    'employe': 'Employé', 'responsable departement': 'Resp. Département',
    'responsable stock': 'Resp. Stock', 'admin': 'Admin',
  };
  return m[nom.toLowerCase()] ?? nom;
};

const inscriptionStatutCfg = {
  en_attente: { label: 'En attente', cls: 'bg-amber-100 text-amber-800', icon: Clock     },
  accepte:    { label: 'Accepté',   cls: 'bg-green-100 text-green-800',  icon: UserCheck },
  refuse:     { label: 'Refusé',    cls: 'bg-red-100 text-red-800',      icon: UserX     },
};

// ── Shared components ──────────────────────────────────────────────────────────

const ConfirmDialog: React.FC<{ message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }> = ({ message, onConfirm, onCancel, danger }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${danger ? 'text-status-rejected' : 'text-amber-500'}`} />
        <p className="text-sm text-foreground">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted">Annuler</button>
        <button onClick={onConfirm} className={`px-4 py-2 text-xs font-semibold rounded-lg text-white ${danger ? 'bg-status-rejected hover:bg-red-700' : 'bg-primary hover:bg-primary-hover'}`}>Confirmer</button>
      </div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div><label className="block text-xs font-medium text-foreground mb-1.5">{label}{required && ' *'}</label>{children}</div>
);

const ErrorBanner: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="flex items-start gap-2 text-xs text-status-rejected bg-status-rejected-bg border border-status-rejected/30 px-3 py-2.5 rounded-lg">
    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{message}
    <button onClick={onClose} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
  </div>
);

// ── Audit Details Modal ────────────────────────────────────────────────────────

const AuditDetailsModal: React.FC<{ item: ApiHistorique; onClose: () => void }> = ({ item, onClose }) => {
  const userNom = item.user ? `${item.user.prenom} ${item.user.nom}` : '—';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Audit #{item.id_historique}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{item.date_action} · {userNom} · <span className="font-mono">{item.table_modifiee}</span></p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold bg-muted px-2 py-1 rounded">{item.type_action}</span>
            {item.reference_objet && <span className="text-xs font-semibold bg-muted px-2 py-1 rounded font-mono">{item.reference_objet}</span>}
          </div>
          <p className="text-sm text-foreground">{item.description}</p>
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">Détails</div>
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
                        <td className="px-4 py-3 text-xs font-mono text-foreground">{d.champs_modifie}</td>
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
              <div className="px-4 py-6 text-sm text-muted-foreground">Aucun détail.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Users Tab ──────────────────────────────────────────────────────────────────

const CreateUserModal: React.FC<{ roles: Role[]; departements: Departement[]; onClose: () => void; onCreated: (u: ApiUser) => void }> = ({ roles, departements, onClose, onCreated }) => {
  const [form, setForm] = useState<CreateUserForm>(EMPTY_USER_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (f: keyof CreateUserForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api.post('/users', { ...form, role_id: Number(form.role_id), departement_id: form.departement_id ? Number(form.departement_id) : null });
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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {([['prenom', 'Prénom'], ['nom', 'Nom']] as [keyof CreateUserForm, string][]).map(([f, l]) => (
              <Field key={f} label={l} required><input type="text" required value={form[f]} onChange={set(f)} className={inputCls} /></Field>
            ))}
          </div>
          <Field label="Email" required><input type="email" required value={form.email} onChange={set('email')} className={inputCls} /></Field>
          <Field label="Mot de passe" required><input type="password" required minLength={6} value={form.password} onChange={set('password')} placeholder="Minimum 6 caractères" className={inputCls} /></Field>
          <Field label="Téléphone"><input type="text" value={form.telephone} onChange={set('telephone')} className={inputCls} /></Field>
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
          {error && <p className="text-xs text-status-rejected bg-status-rejected-bg border border-status-rejected/30 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{loading ? 'Création...' : "Créer l'utilisateur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UsersTab: React.FC = () => {
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
    api.get('/users/form-data').then(r => { setRoles(r.data.roles); setDepts(r.data.departements); });
  }, [fetchUsers]);

  const handleDelete = async (u: ApiUser) => {
    setActLoad(u.id_utilisateur);
    try { await api.delete(`/users/${u.id_utilisateur}`); setUsers(p => p.filter(x => x.id_utilisateur !== u.id_utilisateur)); }
    finally { setActLoad(null); setConfirm(null); }
  };

  const handleToggle = async (u: ApiUser) => {
    setActLoad(u.id_utilisateur);
    try {
      const r = await api.patch(`/users/${u.id_utilisateur}/toggle-active`);
      setUsers(p => p.map(x => x.id_utilisateur === u.id_utilisateur ? r.data.user : x));
    } finally { setActLoad(null); setConfirm(null); }
  };

  const filtered = users.filter(u => `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      {showCreate && <CreateUserModal roles={roles} departements={departements} onClose={() => setShowCreate(false)} onCreated={u => setUsers(p => [u, ...p])} />}
      {confirm && (
        <ConfirmDialog
          danger={confirm.type === 'delete'}
          message={confirm.type === 'delete' ? `Supprimer ${confirm.user.prenom} ${confirm.user.nom} ?` : confirm.user.is_active ? `Désactiver ${confirm.user.prenom} ${confirm.user.nom} ?` : `Réactiver ${confirm.user.prenom} ${confirm.user.nom} ?`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => confirm.type === 'delete' ? handleDelete(confirm.user) : handleToggle(confirm.user)}
        />
      )}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Gestion des utilisateurs <span className="ml-1 text-xs font-normal text-muted-foreground">({users.length})</span></h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-48" />
            </div>
            <button onClick={() => setShowCreate(true)} className="text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover flex items-center gap-1">
              <Plus className="w-3 h-3" /> Ajouter
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
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
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id_utilisateur} className={`hover:bg-muted/30 transition-colors ${!u.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">{u.prenom[0]}{u.nom[0]}</div>
                        <p className="text-sm font-medium text-foreground">{u.prenom} {u.nom}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColors[u.role_nom]}`}>{roleLabels[u.role_nom]}</span></td>
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
                        <button disabled={actLoad === u.id_utilisateur} onClick={() => setConfirm({ type: 'toggle', user: u })} className={`transition-colors ${u.is_active ? 'text-status-approved hover:text-amber-600' : 'text-muted-foreground hover:text-status-approved'}`}>
                          {actLoad === u.id_utilisateur ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button disabled={actLoad === u.id_utilisateur} onClick={() => setConfirm({ type: 'delete', user: u })} className="text-muted-foreground hover:text-status-rejected transition-colors">
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
    </>
  );
};

// ── Departments Tab ────────────────────────────────────────────────────────────

const DepartementsTab: React.FC = () => {
  const [departements, setDepts] = useState<ApiDepartement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState<ApiDepartement | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => { api.get('/departements').then(r => setDepts(r.data)).finally(() => setLoading(false)); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setCreating(true);
    try {
      const r = await api.post('/departements', { nom: newNom });
      setDepts(p => [...p, r.data]); setNewNom(''); setShowForm(false);
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors?.nom?.[0];
      setFormError(typeof m === 'string' ? m : 'Erreur.');
    } finally { setCreating(false); }
  };

  const handleDelete = async (d: ApiDepartement) => {
    setDeleting(d.id); setDeleteError('');
    try { await api.delete(`/departements/${d.id}`); setDepts(p => p.filter(x => x.id !== d.id)); setConfirm(null); }
    catch (err: any) { setDeleteError(err.response?.data?.message ?? 'Impossible de supprimer.'); setConfirm(null); }
    finally { setDeleting(null); }
  };

  return (
    <>
      {confirm && <ConfirmDialog danger message={`Supprimer le département "${confirm.nom}" ?`} onCancel={() => setConfirm(null)} onConfirm={() => handleDelete(confirm)} />}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Gestion des départements <span className="ml-1 text-xs font-normal text-muted-foreground">({departements.length})</span></h2>
          <button onClick={() => { setShowForm(v => !v); setFormError(''); setNewNom(''); }} className="text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover flex items-center gap-1">
            <Plus className="w-3 h-3" /> Ajouter
          </button>
        </div>
        {showForm && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <form onSubmit={handleCreate} className="flex items-start gap-3">
              <div className="flex-1">
                <input type="text" required autoFocus placeholder="Nom du département..." value={newNom} onChange={e => setNewNom(e.target.value)} className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                {formError && <p className="text-xs text-status-rejected mt-1.5">{formError}</p>}
              </div>
              <button type="submit" disabled={creating} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-60">
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{creating ? 'Création...' : 'Créer'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-muted"><X className="w-4 h-4" /></button>
            </form>
          </div>
        )}
        {deleteError && <div className="mx-5 mt-4"><ErrorBanner message={deleteError} onClose={() => setDeleteError('')} /></div>}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
        ) : departements.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">Aucun département trouvé.</p>
        ) : (
          <div className="divide-y divide-border">
            {departements.map(d => (
              <div key={d.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="w-5 h-5 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{d.nom}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.users_count} utilisateur{d.users_count !== 1 ? 's' : ''} · Créé le {d.created_at}</p>
                </div>
                <button disabled={deleting === d.id} onClick={() => setConfirm(d)} className="text-muted-foreground hover:text-status-rejected transition-colors disabled:opacity-40">
                  {deleting === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// ── Products Tab ───────────────────────────────────────────────────────────────

const CreateProduitModal: React.FC<{ categories: CategorieOption[]; onClose: () => void; onCreated: (p: ApiProduit) => void }> = ({ categories, onClose, onCreated }) => {
  const [form, setForm] = useState<ProduitForm>(EMPTY_PRODUIT_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (f: keyof ProduitForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api.post('/produits', {
        nom_produit: form.nom_produit, description: form.description || null,
        reference: form.reference || null, code_barre: form.code_barre || null,
        quantite: Number(form.quantite), seuil_alerte: Number(form.seuil_alerte),
        id_categorie: Number(form.id_categorie), is_active: form.is_active,
      });
      onCreated(res.data); onClose();
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors;
      setError(typeof m === 'string' ? m : JSON.stringify(m ?? 'Une erreur est survenue.'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold text-foreground">Ajouter un produit</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <Field label="Nom du produit" required><input type="text" required value={form.nom_produit} onChange={set('nom_produit')} className={inputCls} /></Field>
          <Field label="Description"><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Référence"><input type="text" value={form.reference} onChange={set('reference')} className={inputCls} /></Field>
            <Field label="Code barre"><input type="text" value={form.code_barre} onChange={set('code_barre')} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantité initiale" required><input type="number" required min={0} value={form.quantite} onChange={set('quantite')} className={inputCls} /></Field>
            <Field label="Seuil d'alerte" required><input type="number" required min={0} value={form.seuil_alerte} onChange={set('seuil_alerte')} className={inputCls} /></Field>
          </div>
          <Field label="Catégorie" required>
            <select required value={form.id_categorie} onChange={set('id_categorie')} className={inputCls}>
              <option value="">Choisir une catégorie...</option>
              {categories.map(c => <option key={c.id_categorie} value={c.id_categorie}>{c.nom_categorie}</option>)}
            </select>
          </Field>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))} className={form.is_active ? 'text-status-approved' : 'text-muted-foreground'}>
              {form.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
            <span className="text-xs font-medium text-foreground">{form.is_active ? 'Produit actif' : 'Produit inactif'}</span>
          </div>
          {error && <p className="text-xs text-status-rejected bg-status-rejected-bg border border-status-rejected/30 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{loading ? 'Création...' : 'Ajouter le produit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProduitsTab: React.FC = () => {
  const [produits, setProduits]         = useState<ApiProduit[]>([]);
  const [categories, setCategories]     = useState<CategorieOption[]>([]);
  const [allCategories, setAllCats]     = useState<ApiCategorie[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterCat, setFilterCat]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [showCatForm, setShowCatForm]   = useState(false);
  const [newCatNom, setNewCatNom]       = useState('');
  const [newCatDesc, setNewCatDesc]     = useState('');
  const [creatingCat, setCreatingCat]   = useState(false);
  const [catError, setCatError]         = useState('');
  const [confirmDel, setConfirmDel]     = useState<ApiProduit | null>(null);
  const [toggling, setToggling]         = useState<number | null>(null);
  const [deleting, setDeleting]         = useState<number | null>(null);
  const [actionError, setActionError]   = useState('');
  const [lotsModal, setLotsModal]       = useState<{ id: number; nom: string } | null>(null);
  const [currentPage, setCurrentPage]   = useState(1);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, fd, cats] = await Promise.all([api.get('/produits'), api.get('/produits/form-data'), api.get('/categories')]);
      setProduits(p.data); setCategories(fd.data.categories); setAllCats(cats.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { setCurrentPage(1); }, [search, filterCat, filterStatus]);

  const handleToggle = async (p: ApiProduit) => {
    setToggling(p.id_produit);
    try {
      const r = await api.patch(`/produits/${p.id_produit}/toggle-active`);
      setProduits(prev => prev.map(x => x.id_produit === p.id_produit ? r.data.produit : x));
    } catch { setActionError('Erreur lors du changement de statut.'); }
    finally { setToggling(null); }
  };

  const handleDelete = async (p: ApiProduit) => {
    setDeleting(p.id_produit);
    try {
      await api.delete(`/produits/${p.id_produit}`);
      setProduits(prev => prev.filter(x => x.id_produit !== p.id_produit));
      setConfirmDel(null);
    } catch { setActionError('Erreur lors de la suppression.'); setConfirmDel(null); }
    finally { setDeleting(null); }
  };

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault(); setCatError(''); setCreatingCat(true);
    try {
      const res = await api.post('/categories', { nom_categorie: newCatNom, description: newCatDesc || null });
      setAllCats(p => [...p, res.data]);
      setCategories(p => [...p, { id_categorie: res.data.id_categorie, nom_categorie: res.data.nom_categorie }]);
      setNewCatNom(''); setNewCatDesc(''); setShowCatForm(false);
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors?.nom_categorie?.[0];
      setCatError(typeof m === 'string' ? m : 'Erreur.');
    } finally { setCreatingCat(false); }
  };

  const filtered = produits.filter(p => {
    const matchSearch = p.nom_produit.toLowerCase().includes(search.toLowerCase()) || (p.reference ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat    = filterCat ? String(p.id_categorie) === filterCat : true;
    const matchStatus = filterStatus === 'actif' ? p.is_active : filterStatus === 'inactif' ? !p.is_active : filterStatus === 'alerte' ? p.en_alerte : true;
    return matchSearch && matchCat && matchStatus;
  });

  const totalPages    = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filtered, currentPage]);
  const alertCount    = produits.filter(p => p.en_alerte && p.is_active).length;

  return (
    <>
      {showCreate && <CreateProduitModal categories={categories} onClose={() => setShowCreate(false)} onCreated={p => setProduits(prev => [p, ...prev])} />}
      {confirmDel && <ConfirmDialog danger message={`Supprimer "${confirmDel.nom_produit}" ?`} onCancel={() => setConfirmDel(null)} onConfirm={() => handleDelete(confirmDel)} />}
      {lotsModal && <ProductLotsModal produitId={lotsModal.id} produitNom={lotsModal.nom} onClose={() => setLotsModal(null)} />}

      <div className="space-y-4">
        {alertCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span><strong>{alertCount}</strong> produit{alertCount > 1 ? 's' : ''} en dessous du seuil d'alerte.</span>
            <button onClick={() => setFilterStatus('alerte')} className="ml-auto text-xs font-semibold underline underline-offset-2">Voir</button>
          </div>
        )}
        {actionError && <ErrorBanner message={actionError} onClose={() => setActionError('')} />}

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2"><Tag className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm text-foreground">Catégories <span className="text-xs font-normal text-muted-foreground">({allCategories.length})</span></h3></div>
            <button onClick={() => { setShowCatForm(v => !v); setCatError(''); }} className="text-xs font-semibold px-3 py-1.5 bg-muted border border-border text-foreground rounded-lg hover:bg-border flex items-center gap-1"><Plus className="w-3 h-3" /> Catégorie</button>
          </div>
          {showCatForm && (
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <form onSubmit={handleCreateCat} className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1"><input type="text" required autoFocus placeholder="Nom de la catégorie..." value={newCatNom} onChange={e => setNewCatNom(e.target.value)} className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" /></div>
                  <button type="submit" disabled={creatingCat} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-60">{creatingCat && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{creatingCat ? 'Création...' : 'Créer'}</button>
                  <button type="button" onClick={() => setShowCatForm(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <input type="text" placeholder="Description (optionnel)" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                {catError && <p className="text-xs text-status-rejected">{catError}</p>}
              </form>
            </div>
          )}
          <div className="flex flex-wrap gap-2 px-5 py-3">
            {allCategories.map(c => (
              <button key={c.id_categorie} onClick={() => setFilterCat(String(c.id_categorie) === filterCat ? '' : String(c.id_categorie))}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${String(c.id_categorie) === filterCat ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border hover:border-primary/40'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />{c.nom_categorie}<span className="opacity-60">({c.produits_count})</span>
              </button>
            ))}
            {allCategories.length === 0 && !loading && <p className="text-xs text-muted-foreground py-1">Aucune catégorie.</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" /><h2 className="font-semibold text-foreground">Produits <span className="text-xs font-normal text-muted-foreground">({filtered.length}/{produits.length})</span></h2></div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input type="text" placeholder="Nom, référence..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-40" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none">
                <option value="">Tous statuts</option>
                <option value="actif">Actifs</option>
                <option value="inactif">Inactifs</option>
                <option value="alerte">En alerte</option>
              </select>
              <button onClick={() => setShowCreate(true)} className="text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter</button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucun produit trouvé.</p>
          ) : (
            <div className="flex flex-col flex-1">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      {['Produit', 'Référence', 'Catégorie', 'Quantité', 'Seuil', 'Statut', 'Ajouté le', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedData.map(p => (
                      <tr key={p.id_produit} className={`hover:bg-muted/30 transition-colors ${!p.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Package className="w-4 h-4 text-primary" /></div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{p.nom_produit}</p>
                              {p.description && <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{p.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.reference ?? '—'}</td>
                        <td className="px-4 py-3"><span className="text-xs font-medium bg-muted px-2 py-0.5 rounded-full">{p.categorie_nom}</span></td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${p.en_alerte && p.is_active ? 'text-amber-600' : 'text-foreground'}`}>{p.quantite}</span>
                          {p.en_alerte && p.is_active && <span className="ml-1 text-[10px] text-amber-600 font-semibold">⚠</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.seuil_alerte}</td>
                        <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.is_active ? 'bg-status-approved-bg text-status-approved' : 'bg-muted text-muted-foreground'}`}>{p.is_active ? 'Actif' : 'Inactif'}</span></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.created_at}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setLotsModal({ id: p.id_produit, nom: p.nom_produit })}
                              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-muted hover:bg-border border border-border transition-colors" title="Voir les lots FIFO">
                              <Layers className="w-3.5 h-3.5" /> Lots
                            </button>
                            <button disabled={toggling === p.id_produit} onClick={() => handleToggle(p)}
                              className={`transition-colors ${p.is_active ? 'text-status-approved hover:text-amber-600' : 'text-muted-foreground hover:text-status-approved'}`}>
                              {toggling === p.id_produit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : p.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <button disabled={deleting === p.id_produit} onClick={() => setConfirmDel(p)} className="text-muted-foreground hover:text-status-rejected transition-colors">
                              {deleting === p.id_produit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20 mt-auto">
                  <span className="text-xs text-muted-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-md bg-card border border-border disabled:opacity-50 hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs font-semibold px-2 text-muted-foreground">Page {currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-md bg-card border border-border disabled:opacity-50 hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ── Inscriptions Decision Modal ────────────────────────────────────────────────

const DecisionModal: React.FC<{
  demande: ApiInscription;
  action: 'accepter' | 'refuser';
  onClose: () => void;
  onDone: (updated: ApiInscription) => void;
}> = ({ demande, action, onClose, onDone }) => {
  const [commentaire, setCommentaire] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const isAccept = action === 'accepter';

  const handleSubmit = async () => {
    if (!isAccept && !commentaire.trim()) { setError('Veuillez fournir un motif de refus.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post(`/admin/inscriptions/${demande.id}/${action}`, { commentaire: commentaire || undefined });
      onDone(res.data.demande);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Une erreur est survenue.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className={`px-6 py-5 rounded-t-2xl ${isAccept ? 'bg-green-50 dark:bg-green-950/30 border-b border-green-200/50' : 'bg-red-50 dark:bg-red-950/30 border-b border-red-200/50'}`}>
          <div className="flex items-center gap-3">
            {isAccept ? <BadgeCheck className="w-6 h-6 text-green-600 shrink-0" /> : <ShieldX className="w-6 h-6 text-red-600 shrink-0" />}
            <div>
              <h3 className="font-bold text-foreground">{isAccept ? 'Accepter la demande' : 'Refuser la demande'}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{demande.prenom} {demande.nom} · {demande.email}</p>
            </div>
            <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {isAccept ? (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200/50 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400">
              Un compte sera créé pour <strong>{demande.prenom} {demande.nom}</strong> avec le rôle <strong>{inscriptionRoleLabel(demande.role_nom)}</strong>. Un email sera envoyé à <strong>{demande.email}</strong>.
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
              La demande sera refusée. Un email de notification sera envoyé à <strong>{demande.email}</strong>.
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">{isAccept ? 'Message (optionnel)' : 'Motif du refus *'}</label>
            <textarea rows={3} value={commentaire} onChange={e => setCommentaire(e.target.value)}
              placeholder={isAccept ? 'Message de bienvenue…' : 'Expliquez la raison du refus…'}
              className="w-full px-3 py-2.5 text-sm bg-muted border border-transparent rounded-xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>
          {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-colors ${isAccept ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isAccept ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {loading ? 'Traitement…' : isAccept ? 'Accepter & créer le compte' : 'Refuser la demande'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Inscriptions Tab ───────────────────────────────────────────────────────────

const InscriptionsTab: React.FC = () => {
  const [demandes, setDemandes]         = useState<ApiInscription[]>([]);
  const [stats, setStats]               = useState<InscriptionStats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatut, setFilterStatut] = useState<'en_attente' | 'accepte' | 'refuse' | 'all'>('en_attente');
  const [modal, setModal]               = useState<{ demande: ApiInscription; action: 'accepter' | 'refuser' } | null>(null);
  const [expanded, setExpanded]         = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        api.get(`/admin/inscriptions?statut=${filterStatut}`),
        api.get('/admin/inscriptions/stats'),
      ]);
      setDemandes(d.data);
      setStats(s.data);
    } finally { setLoading(false); }
  }, [filterStatut]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDone = (updated: ApiInscription) => {
    setDemandes(prev => filterStatut === 'all' ? prev.map(d => d.id === updated.id ? updated : d) : prev.filter(d => d.id !== updated.id));
    api.get('/admin/inscriptions/stats').then(r => setStats(r.data)).catch(() => {});
  };

  const filtered = demandes.filter(d => {
    const q = search.toLowerCase();
    return !q || `${d.prenom} ${d.nom} ${d.email} ${d.cin ?? ''}`.toLowerCase().includes(q);
  });

  return (
    <>
      {modal && <DecisionModal demande={modal.demande} action={modal.action} onClose={() => setModal(null)} onDone={handleDone} />}

      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'En attente', value: stats?.en_attente ?? 0, cls: 'text-amber-600',    bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/50',   pulse: (stats?.en_attente ?? 0) > 0 },
            { label: 'Acceptées',  value: stats?.acceptes   ?? 0, cls: 'text-green-600',    bg: 'bg-green-50 dark:bg-green-950/20 border-green-200/50',    pulse: false },
            { label: 'Refusées',   value: stats?.refuses    ?? 0, cls: 'text-red-600',      bg: 'bg-red-50 dark:bg-red-950/20 border-red-200/50',          pulse: false },
            { label: 'Total',      value: stats?.total      ?? 0, cls: 'text-foreground',   bg: 'bg-card border-border',                                   pulse: false },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-4 ${s.bg}`}>
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                {s.pulse && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" /></span>}
              </div>
              <p className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">
              Demandes d'inscription
              {(stats?.en_attente ?? 0) > 0 && <span className="ml-2 text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">{stats?.en_attente} en attente</span>}
            </h2>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input type="text" placeholder="Nom, email, CIN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-48" />
              </div>
              <div className="flex gap-1 bg-muted p-0.5 rounded-lg">
                {([
                  { key: 'en_attente', label: 'En attente' },
                  { key: 'accepte',    label: 'Acceptées'  },
                  { key: 'refuse',     label: 'Refusées'   },
                  { key: 'all',        label: 'Toutes'     },
                ] as const).map(opt => (
                  <button key={opt.key} onClick={() => setFilterStatut(opt.key)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${filterStatut === opt.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <button onClick={fetchAll} disabled={loading} className="p-1.5 bg-muted rounded-lg border border-transparent hover:border-border transition-colors disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement…</span></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center"><UserPlus className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Aucune demande trouvée</p></div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(d => {
                const cfg = inscriptionStatutCfg[d.statut];
                const Ico = cfg.icon;
                const isExpanded = expanded === d.id;
                return (
                  <div key={d.id} className="hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">{d.prenom[0]}{d.nom[0]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{d.prenom} {d.nom}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                          <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">{inscriptionRoleLabel(d.role_nom)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{d.email}</span>
                          {d.cin && <span className="text-xs text-muted-foreground">CIN : {d.cin}</span>}
                          <span className="text-xs text-muted-foreground">{d.created_at}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {d.statut === 'en_attente' && (
                          <>
                            <button onClick={() => setModal({ demande: d, action: 'accepter' })}
                              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                              <Check className="w-3.5 h-3.5" /> Accepter
                            </button>
                            <button onClick={() => setModal({ demande: d, action: 'refuser' })}
                              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                              <X className="w-3.5 h-3.5" /> Refuser
                            </button>
                          </>
                        )}
                        {d.statut !== 'en_attente' && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Ico className="w-3.5 h-3.5" />
                            {d.traite_par_nom && <span>par {d.traite_par_nom}</span>}
                            {d.traite_le && <span>· {d.traite_le}</span>}
                          </div>
                        )}
                        <button onClick={() => setExpanded(isExpanded ? null : d.id)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-5 pb-4 border-t border-border/50 pt-3 bg-muted/10">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs ml-[52px]">
                          {([
                            ['Téléphone', d.telephone ?? '—'],
                            ['CIN', d.cin ?? '—'],
                            ['Rôle demandé', inscriptionRoleLabel(d.role_nom)],
                            ['Soumis le', d.created_at],
                            d.commentaire_admin ? ['Commentaire admin', d.commentaire_admin] : null,
                            d.traite_par_nom ? ['Traité par', `${d.traite_par_nom}${d.traite_le ? ' · ' + d.traite_le : ''}`] : null,
                          ] as ([string, string] | null)[]).filter(Boolean).map(([label, value]) => (
                            <div key={label}><span className="text-muted-foreground">{label} : </span><span className="text-foreground font-medium">{value}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ── Main Admin Dashboard ───────────────────────────────────────────────────────

const AdminDashboard: React.FC = () => {
  const [tab, setTab] = useState<'overview' | 'users' | 'departments' | 'products' | 'requests' | 'audit' | 'inscriptions'>('overview');
  const [inscriptionPendingCount, setInscriptionPendingCount] = useState(0);

  // Fetch inscription badge count on mount + after tab changes
  useEffect(() => {
    api.get('/admin/inscriptions/stats')
      .then(r => setInscriptionPendingCount(r.data.en_attente ?? 0))
      .catch(() => {});
  }, []);

  const tabs = [
    { key: 'overview',      label: "Vue d'ensemble", icon: BarChart3  },
    { key: 'users',         label: 'Utilisateurs',   icon: Users      },
    { key: 'departments',   label: 'Départements',   icon: Building2  },
    { key: 'products',      label: 'Produits',       icon: Package    },
    { key: 'requests',      label: 'Demandes',       icon: FileText   },
    { key: 'audit',         label: 'Audit',          icon: Shield     },
    {
      key: 'inscriptions',
      label: inscriptionPendingCount > 0 ? `Inscriptions (${inscriptionPendingCount})` : 'Inscriptions',
      icon: UserPlus,
    },
  ];

  const [adminDemandes, setAdminDemandes]     = useState<ApiDemande[]>([]);
  const [demandesLoading, setDemandesLoading] = useState(false);
  const [mouvements, setMouvements]           = useState<ApiMouvement[]>([]);
  const [mouvLoading, setMouvLoading]         = useState(false);
  const [auditLogs, setAuditLogs]             = useState<ApiHistorique[]>([]);
  const [auditLoading, setAuditLoading]       = useState(false);
  const [auditSearch, setAuditSearch]         = useState('');
  const [auditType, setAuditType]             = useState<string>('');
  const [selectedAudit, setSelectedAudit]     = useState<ApiHistorique | null>(null);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter(a => {
      const typeOk   = auditType ? a.type_action === auditType : true;
      const text     = `${a.table_modifiee} ${a.type_action} ${a.description} ${a.reference_objet ?? ''}`.toLowerCase();
      const searchOk = q ? text.includes(q) : true;
      return typeOk && searchOk;
    });
  }, [auditLogs, auditSearch, auditType]);

  const fetchAdminDemandes = useCallback(async () => {
    setDemandesLoading(true);
    try { const r = await api.get('/admin/demandes?per_page=200'); setAdminDemandes(r.data?.data ?? r.data ?? []); }
    finally { setDemandesLoading(false); }
  }, []);

  const fetchAdminMouvements = useCallback(async () => {
    setMouvLoading(true);
    try { const r = await api.get('/admin/mouvements?per_page=50'); setMouvements(r.data?.data ?? r.data ?? []); }
    finally { setMouvLoading(false); }
  }, []);

  const fetchAdminAudit = useCallback(async () => {
    setAuditLoading(true);
    try { const r = await api.get('/admin/historiques?per_page=100'); setAuditLogs(r.data?.data ?? r.data ?? []); }
    finally { setAuditLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'overview' || tab === 'requests') { if (adminDemandes.length === 0) fetchAdminDemandes(); }
    if (tab === 'overview' || tab === 'audit')    { if (mouvements.length === 0) fetchAdminMouvements(); if (auditLogs.length === 0) fetchAdminAudit(); }
    // Refresh badge when leaving inscriptions tab
    if (tab !== 'inscriptions') {
      api.get('/admin/inscriptions/stats').then(r => setInscriptionPendingCount(r.data.en_attente ?? 0)).catch(() => {});
    }
  }, [tab, adminDemandes.length, mouvements.length, auditLogs.length, fetchAdminDemandes, fetchAdminMouvements, fetchAdminAudit]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { key: string; monthLabel: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const ml = d.toLocaleString('fr-FR', { month: 'short' }).replace('.', '');
      months.push({ key, monthLabel: ml.charAt(0).toUpperCase() + ml.slice(1) });
    }
    const bucket = new Map<string, { demandes: number; validees: number }>();
    months.forEach(m => bucket.set(m.key, { demandes: 0, validees: 0 }));
    adminDemandes.forEach(d => {
      const dt = new Date((d.date_demande ?? '').replace(' ', 'T'));
      if (Number.isNaN(dt.getTime())) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const b = bucket.get(key); if (!b) return;
      b.demandes += 1;
      if (['VALIDEE', 'PARTIELLEMENT_VALIDEE', 'LIVREE'].includes(d.statut)) b.validees += 1;
    });
    return months.map(m => { const b = bucket.get(m.key)!; return { month: m.monthLabel, demandes: b.demandes, validees: b.validees }; });
  }, [adminDemandes]);

  const recentActivity = useMemo(() =>
    mouvements.slice().sort((a, b) => (b.date_mouvement ?? '').localeCompare(a.date_mouvement ?? '')).slice(0, 5).map(m => ({
      id: m.id_mouvement, type_action: m.type_mouvement === 'IN' ? 'IN' : 'OUT',
      description: m.type_mouvement === 'IN' ? `Entrée stock: +${m.quantite_mouvement} (${m.produit?.nom_produit ?? '—'})` : `Sortie stock: -${m.quantite_mouvement} (${m.produit?.nom_produit ?? '—'})`,
      user_nom: m.user ? `${m.user.prenom} ${m.user.nom}` : '—',
      date_action: m.date_mouvement, table_modifiee: 'mouvements',
    })),
  [mouvements]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Administration système</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gestion complète de la plateforme</p>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {/* Pulse dot for inscriptions with pending */}
            {t.key === 'inscriptions' && inscriptionPendingCount > 0 && tab !== 'inscriptions' && (
              <span className="relative flex h-1.5 w-1.5 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
              </span>
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-foreground">Activité mensuelle</h3>
              <button onClick={() => { fetchAdminDemandes(); fetchAdminMouvements(); fetchAdminAudit(); }} className="text-xs font-semibold px-3 py-1.5 bg-muted border border-border rounded-lg hover:bg-border">Rafraîchir</button>
            </div>
            {(demandesLoading && adminDemandes.length === 0) ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip />
                  <Bar dataKey="demandes" fill="hsl(var(--primary))" radius={[4,4,0,0]} name="Demandes" />
                  <Bar dataKey="validees" fill="hsl(var(--status-approved))" radius={[4,4,0,0]} name="Validées" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border"><h3 className="font-semibold text-foreground">Activité récente (mouvements)</h3></div>
            {(mouvLoading && mouvements.length === 0) ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
            ) : recentActivity.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Aucune activité.</div>
            ) : (
              <div className="divide-y divide-border">
                {recentActivity.map((h, idx) => (
                  <div key={h.id ?? idx} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${h.type_action === 'IN' ? 'bg-status-approved-bg text-status-approved' : 'bg-status-rejected-bg text-status-rejected'}`}>{h.type_action}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{h.description}</p>
                      <p className="text-[11px] text-muted-foreground">{h.user_nom} · {h.date_action}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">{h.table_modifiee}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'users'       && <UsersTab />}
      {tab === 'departments' && <DepartementsTab />}
      {tab === 'products'    && <ProduitsTab />}
      {tab === 'inscriptions' && <InscriptionsTab />}

      {/* REQUESTS */}
      {tab === 'requests' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Toutes les demandes</h2>
            <button onClick={fetchAdminDemandes} className="text-xs font-semibold px-3 py-1.5 bg-muted border border-border rounded-lg hover:bg-border">Rafraîchir</button>
          </div>
          {demandesLoading && adminDemandes.length === 0 ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
          ) : adminDemandes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Aucune demande.</div>
          ) : (
            <div className="divide-y divide-border">
              {adminDemandes.map((d, idx) => {
                const prenom  = d.demandeur_prenom ?? d.demandeur?.prenom ?? '—';
                const nom     = d.demandeur_nom    ?? d.demandeur?.nom    ?? '—';
                const dept    = d.departement_nom  ?? d.demandeur?.departement?.nom ?? '—';
                const hasLots = STATUTS_AVEC_LOTS.includes(d.statut);
                return (
                  <div key={d.id_demande ?? idx} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">Demande #{d.id_demande}</span>
                          <StatusBadge status={d.statut as any} />
                        </div>
                        <p className="text-xs text-muted-foreground">{prenom} {nom} · {dept} · {d.date_demande}</p>
                        {Array.isArray(d.details) && d.details.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {d.details.map((x, i) => (
                              <div key={i}>
                                <span className={`inline-flex text-xs px-2 py-1 rounded-md font-medium border ${x.statut === 'accepte' ? 'bg-green-50 border-green-200 text-green-700' : x.statut === 'refuse' ? 'bg-red-50 border-red-200 text-red-600 line-through' : 'bg-muted border-border text-muted-foreground'}`}>
                                  {x.produit_nom ?? x.nom ?? `Produit #${x.id_produit}`} ({x.quantite})
                                </span>
                                {x.statut === 'accepte' && hasLots && (
                                  <LotConsumptionDetails detailDemandeId={x.id_detail} endpointPrefix="/admin" compact={true} defaultOpen={false} />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {hasLots && (
                          <div className="mt-3">
                            <LotConsumptionDetails demandeId={d.id_demande} endpointPrefix="/admin" compact={false} defaultOpen={false} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* AUDIT */}
      {selectedAudit && <AuditDetailsModal item={selectedAudit} onClose={() => setSelectedAudit(null)} />}
      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3 justify-between">
              <h2 className="font-semibold text-foreground">Journal d'audit</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input type="text" placeholder="Rechercher..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-56" />
                </div>
                <select value={auditType} onChange={e => setAuditType(e.target.value)} className="py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none">
                  <option value="">Tous</option>
                  {['INSERT','UPDATE','DELETE','ACTION'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={fetchAdminAudit} className="text-xs font-semibold px-3 py-1.5 bg-muted border border-border rounded-lg hover:bg-border">Rafraîchir</button>
              </div>
            </div>
            {auditLoading && auditLogs.length === 0 ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
            ) : filteredAuditLogs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Aucun audit.</div>
            ) : (
              <div className="divide-y divide-border">
                {filteredAuditLogs.map((a, idx) => {
                  const userNom = a.user ? `${a.user.prenom} ${a.user.nom}` : '—';
                  return (
                    <button key={a.id_historique ?? idx} onClick={() => setSelectedAudit(a)} className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                      <div className="w-10 shrink-0"><span className="text-[10px] font-bold bg-muted px-2 py-1 rounded">{a.type_action}</span></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{a.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.date_action} · {userNom} · <span className="font-mono">{a.table_modifiee}</span>{a.reference_objet ? ` · ${a.reference_objet}` : ''}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">#{a.id_historique}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Mouvements de stock</h2>
              <button onClick={fetchAdminMouvements} className="text-xs font-semibold px-3 py-1.5 bg-muted border border-border rounded-lg hover:bg-border">Rafraîchir</button>
            </div>
            {mouvLoading && mouvements.length === 0 ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
            ) : mouvements.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Aucun mouvement.</div>
            ) : (
              <div className="divide-y divide-border">
                {mouvements.map((m, idx) => (
                  <div key={m.id_mouvement ?? idx} className="px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.type_mouvement === 'IN' ? 'bg-status-approved-bg' : 'bg-status-rejected-bg'}`}>
                        {m.type_mouvement === 'IN' ? <ArrowUp className="w-4 h-4 text-status-approved" /> : <ArrowDown className="w-4 h-4 text-status-rejected" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{m.produit?.nom_produit ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{m.date_mouvement} · {m.user ? `${m.user.prenom} ${m.user.nom}` : '—'}{m.demande?.id_demande ? ` · Demande #${m.demande.id_demande}` : ''}</p>
                        {m.type_mouvement === 'OUT' && (
                          <LotConsumptionDetails mouvementId={m.id_mouvement} endpointPrefix="/admin" compact={true} defaultOpen={false} />
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${m.type_mouvement === 'IN' ? 'text-status-approved' : 'text-status-rejected'}`}>{m.type_mouvement === 'IN' ? '+' : '-'}{m.quantite_mouvement}</p>
                        <p className="text-xs text-muted-foreground">{m.quantite_avant} → {m.quantite_apres}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;