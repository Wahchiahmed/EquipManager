import React, { useState, useEffect, useCallback } from 'react';
import {
  User, Mail, Phone, Building2, Shield, Calendar, CheckCircle2,
  XCircle, Edit3, Lock, Eye, EyeOff, LogOut, Bell, Globe,
  Sun, Moon, Monitor, Clock, ChevronRight, AlertTriangle,
  RefreshCw, Check, X, Package, FileText, TrendingUp,
  ArrowUp, ArrowDown, Activity, Layers, Save,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme, ThemeMode } from '@/context/ThemeContext';   // ← WIRED
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Preferences {
  theme: 'light' | 'dark' | 'system';
  langue: 'fr' | 'en';
  notif_email: boolean;
  notif_inapp: boolean;
  date_format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
}
interface ProfileData {
  id: number;
  nom: string; prenom: string; email: string; telephone: string | null;
  is_active: boolean; role_id: number; role_nom: string;
  departement_id: number | null; departement_nom: string; created_at: string;
  preferences: Preferences;
  role_data: any;
  recent_activity: ActivityEntry[];
}
interface ActivityEntry {
  id: number; date_action: string; table_modifiee: string;
  type_action: 'INSERT' | 'UPDATE' | 'DELETE' | 'ACTION';
  description: string; reference_objet: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN:                   { label: 'Admin',       color: 'text-red-700 dark:text-red-300',       bg: 'bg-red-100 dark:bg-red-900/40' },
  EMPLOYEE:                { label: 'Employé',     color: 'text-blue-700 dark:text-blue-300',     bg: 'bg-blue-100 dark:bg-blue-900/40' },
  RESPONSABLE_DEPARTEMENT: { label: 'Chef Dept',   color: 'text-amber-700 dark:text-amber-300',   bg: 'bg-amber-100 dark:bg-amber-900/40' },
  RESPONSABLE_STOCK:       { label: 'Resp. Stock', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
};

const ACTION_CFG: Record<string, { color: string; bg: string }> = {
  INSERT: { color: 'text-emerald-700', bg: 'bg-emerald-100' },
  UPDATE: { color: 'text-blue-700',    bg: 'bg-blue-100' },
  DELETE: { color: 'text-red-700',     bg: 'bg-red-100' },
  ACTION: { color: 'text-purple-700',  bg: 'bg-purple-100' },
};

const mapRoleKey = (roleName: string) => {
  const n = (roleName ?? '').toLowerCase();
  if (n.includes('admin'))       return 'ADMIN';
  if (n.includes('stock'))       return 'RESPONSABLE_STOCK';
  if (n.includes('departement')) return 'RESPONSABLE_DEPARTEMENT';
  return 'EMPLOYEE';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Toast: React.FC<{ msg: string; type: 'success' | 'error'; onClose: () => void }> = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-semibold ${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
    {type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
  </div>
);

const SectionCard: React.FC<{
  title: string; icon: React.FC<any>; iconColor?: string;
  children: React.ReactNode; action?: React.ReactNode;
}> = ({ title, icon: Icon, iconColor = 'text-indigo-500', children, action }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h2 className="font-bold text-gray-900 dark:text-white text-sm tracking-wide">{title}</h2>
      </div>
      {action}
    </div>
    <div className="px-6 py-5">{children}</div>
  </div>
);

const FieldRow: React.FC<{ label: string; value: React.ReactNode; icon?: React.FC<any> }> = ({ label, value, icon: Icon }) => (
  <div className="flex items-start justify-between py-3 border-b border-gray-50 dark:border-gray-700/60 last:border-0">
    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-36 shrink-0">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </div>
    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 text-right">{value}</div>
  </div>
);

const passwordChecks = (pwd: string) => ({
  length:    pwd.length >= 8,
  uppercase: /[A-Z]/.test(pwd),
  number:    /[0-9]/.test(pwd),
  symbol:    /[^A-Za-z0-9]/.test(pwd),
});

const StrengthDot: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${ok ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
    {label}
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    className={`relative w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none
      ${checked ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-600'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

// Edit info modal
const EditInfoModal: React.FC<{
  profile: ProfileData;
  onClose: () => void;
  onSaved: (updated: ProfileData) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ profile, onClose, onSaved, showToast }) => {
  const [form, setForm]     = useState({ nom: profile.nom, prenom: profile.prenom, telephone: profile.telephone ?? '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nom.trim())    e.nom    = 'Nom requis';
    if (!form.prenom.trim()) e.prenom = 'Prénom requis';
    if (form.telephone && !/^[\d\s\+\-\(\)]{6,20}$/.test(form.telephone)) e.telephone = 'Format invalide';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const r = await api.patch('/profile', form);
      onSaved(r.data.user);
      showToast('Profil mis à jour ✓', 'success');
      onClose();
    } catch (err: any) {
      const apiErrors = err.response?.data?.errors ?? {};
      if (Object.keys(apiErrors).length) {
        setErrors(Object.fromEntries(Object.entries(apiErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v as string])));
      } else {
        showToast(err.response?.data?.message ?? 'Erreur lors de la mise à jour', 'error');
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">Modifier les infos personnelles</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {([
            { key: 'prenom',    label: 'Prénom',    placeholder: 'Votre prénom' },
            { key: 'nom',       label: 'Nom',       placeholder: 'Votre nom' },
            { key: 'telephone', label: 'Téléphone', placeholder: '+216 xx xxx xxx' },
          ] as const).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={e => { setForm(p => ({ ...p, [key]: e.target.value })); setErrors(p => ({ ...p, [key]: '' })); }}
                placeholder={placeholder}
                className={`w-full text-sm px-3.5 py-2.5 border rounded-xl bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 transition
                  ${errors[key] ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 dark:border-gray-600 focus:ring-indigo-500/30 focus:border-indigo-400'}`}
              />
              {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              Email <span className="font-normal">(lecture seule)</span>
            </label>
            <input type="email" value={profile.email} disabled
              className="w-full text-sm px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PROFILE PAGE
// ─────────────────────────────────────────────────────────────────────────────

const ProfilePage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate                = useNavigate();

  // ── THEME hook — this is what actually drives the DOM ─────────────────────
  const { theme: currentTheme, setTheme: applyTheme } = useTheme();

  const [profile, setProfile]         = useState<ProfileData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [showEditModal, setEditModal] = useState(false);
  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [pwdForm, setPwdForm]       = useState({ current_password: '', password: '', password_confirmation: '' });
  const [pwdErrors, setPwdErrors]   = useState<Record<string, string>>({});
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwd, setShowPwd]       = useState({ current: false, new: false, confirm: false });

  const [prefs, setPrefs]             = useState<Preferences | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/profile');
      setProfile(r.data);
      // Override prefs.theme with what ThemeContext says (localStorage wins over server)
      setPrefs({ ...r.data.preferences, theme: currentTheme });
    } catch { showToast('Erreur de chargement', 'error'); }
    finally { setLoading(false); }
  }, [currentTheme]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ── Password change ───────────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    const checks = passwordChecks(pwdForm.password);
    const e: Record<string, string> = {};
    if (!pwdForm.current_password)                               e.current_password        = 'Requis';
    if (!checks.length)                                           e.password                = 'Min 8 caractères';
    else if (!checks.uppercase)                                   e.password                = '1 majuscule requise';
    else if (!checks.number)                                      e.password                = '1 chiffre requis';
    else if (!checks.symbol)                                      e.password                = '1 symbole requis';
    if (pwdForm.password !== pwdForm.password_confirmation)       e.password_confirmation   = 'Les mots de passe ne correspondent pas';
    if (Object.keys(e).length) { setPwdErrors(e); return; }

    setPwdLoading(true);
    try {
      await api.post('/profile/change-password', pwdForm);
      showToast('Mot de passe modifié ✓', 'success');
      setPwdForm({ current_password: '', password: '', password_confirmation: '' });
      setPwdErrors({});
    } catch (err: any) {
      const apiErr = err.response?.data?.errors ?? {};
      if (Object.keys(apiErr).length) {
        setPwdErrors(Object.fromEntries(Object.entries(apiErr).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v as string])));
      } else {
        showToast(err.response?.data?.message ?? 'Erreur', 'error');
      }
    } finally { setPwdLoading(false); }
  };

  // ── Preferences save ──────────────────────────────────────────────────────
  // KEY CHANGE: when saving prefs we also call applyTheme() so the DOM updates
  const handleSavePrefs = async () => {
    if (!prefs) return;
    setPrefsSaving(true);
    try {
      await api.patch('/profile/preferences', prefs);
      // Apply the selected theme to the DOM immediately
      applyTheme(prefs.theme as ThemeMode);
      showToast('Préférences enregistrées ✓', 'success');
    } catch { showToast('Erreur lors de la sauvegarde', 'error'); }
    finally { setPrefsSaving(false); }
  };

  // ── Instant theme preview: update DOM as soon as user clicks a button ─────
  // This gives instant feedback without having to hit "Sauvegarder" first
  const handleThemeChange = (key: 'light' | 'dark' | 'system') => {
    setPrefs(p => p ? ({ ...p, theme: key }) : p);
    applyTheme(key);   // ← immediate DOM update
  };

  // ── Logout all devices ────────────────────────────────────────────────────
  const handleLogoutAll = async () => {
    setLogoutAllLoading(true);
    try {
      await api.post('/profile/logout-all');
      showToast('Toutes les autres sessions fermées ✓', 'success');
    } catch { showToast('Erreur', 'error'); }
    finally { setLogoutAllLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!profile) return null;

  const roleKey = mapRoleKey(profile.role_nom);
  const roleCfg = ROLE_CFG[roleKey] ?? { label: profile.role_nom, color: 'text-gray-700', bg: 'bg-gray-100' };
  const checks  = passwordChecks(pwdForm.password);
  const rdType  = profile.role_data?.type ?? 'EMPLOYEE';

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-8xl mx-auto space-y-6">

        {/* ── Hero header ───────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-3xl overflow-hidden shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-white/5 rounded-full" />
          <div className="relative px-6 py-8 flex items-center gap-6">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shadow-lg">
                <span className="text-2xl font-black text-white">{profile.prenom?.[0] ?? "?"}{profile.nom?.[0] ?? "?"}</span>
              </div>
              <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow ${profile.is_active ? 'bg-emerald-400' : 'bg-gray-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-white tracking-tight">{profile.prenom} {profile.nom}</h1>
              <p className="text-indigo-200 text-sm mt-0.5">{profile.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/20 text-white">
                  <Shield className="w-3 h-3" /> {roleCfg.label}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/15 text-indigo-100">
                  <Building2 className="w-3 h-3" /> {profile.departement_nom}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${profile.is_active ? 'bg-emerald-500/30 text-emerald-100' : 'bg-gray-500/30 text-gray-200'}`}>
                  {profile.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {profile.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setEditModal(true)}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white rounded-xl text-sm font-semibold transition-all backdrop-blur-sm"
            >
              <Edit3 className="w-4 h-4" /> Modifier
            </button>
          </div>
        </div>

        {/* ── Main grid ─────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* A) Identité & Compte */}
          <SectionCard title="Identité & Compte" icon={User} iconColor="text-indigo-500">
            <FieldRow label="Prénom"    icon={User}      value={profile.prenom} />
            <FieldRow label="Nom"       icon={User}      value={profile.nom} />
            <FieldRow label="Email"     icon={Mail}      value={
              <span className="flex items-center gap-1.5">
                {profile.email}
                <span className="text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">lecture seule</span>
              </span>
            } />
            <FieldRow label="Téléphone" icon={Phone}     value={profile.telephone ?? <span className="text-gray-400 font-normal text-xs italic">Non renseigné</span>} />
            <FieldRow label="Rôle"      icon={Shield}    value={
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${roleCfg.bg} ${roleCfg.color}`}>
                {roleCfg.label}
              </span>
            } />
            <FieldRow label="Département" icon={Building2} value={profile.departement_nom} />
            <FieldRow label="Statut"    icon={profile.is_active ? CheckCircle2 : XCircle} value={
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold
                ${profile.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-gray-100 text-gray-500'}`}>
                {profile.is_active ? 'Actif' : 'Inactif'}
              </span>
            } />
            <FieldRow label="Membre depuis" icon={Calendar} value={fmt(profile.created_at)} />
          </SectionCard>

          {/* B) Sécurité */}
          <SectionCard title="Sécurité" icon={Lock} iconColor="text-rose-500">
            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Changer le mot de passe</p>
              {([
                { key: 'current_password', label: 'Mot de passe actuel', field: 'current' },
                { key: 'password',         label: 'Nouveau mot de passe', field: 'new' },
                { key: 'password_confirmation', label: 'Confirmer', field: 'confirm' },
              ] as const).map(({ key, label, field }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">{label}</label>
                  <div className="relative">
                    <input
                      type={showPwd[field] ? 'text' : 'password'}
                      value={pwdForm[key]}
                      onChange={e => { setPwdForm(p => ({ ...p, [key]: e.target.value })); setPwdErrors(p => ({ ...p, [key]: '' })); }}
                      className={`w-full text-sm px-3.5 py-2.5 pr-10 border rounded-xl bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 transition
                        ${pwdErrors[key] ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 dark:border-gray-600 focus:ring-rose-500/30 focus:border-rose-400'}`}
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPwd(p => ({ ...p, [field]: !p[field] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwd[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {pwdErrors[key] && <p className="text-xs text-red-500 mt-1">{pwdErrors[key]}</p>}
                </div>
              ))}
              {pwdForm.password.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                  <StrengthDot ok={checks.length}    label="Min. 8 caractères" />
                  <StrengthDot ok={checks.uppercase} label="1 majuscule" />
                  <StrengthDot ok={checks.number}    label="1 chiffre" />
                  <StrengthDot ok={checks.symbol}    label="1 symbole (@#$...)" />
                </div>
              )}
              <button onClick={handlePasswordChange} disabled={pwdLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                {pwdLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Changer le mot de passe
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Sessions actives</p>
                <button onClick={handleLogoutAll} disabled={logoutAllLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 text-gray-700 dark:text-gray-300 hover:text-red-700 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                  {logoutAllLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Se déconnecter de tous les appareils
                </button>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── C) Préférences ────────────────────────────────────────────── */}
        {prefs && (
          <SectionCard
            title="Préférences"
            icon={Monitor}
            iconColor="text-violet-500"
            action={
              <button onClick={handleSavePrefs} disabled={prefsSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50">
                {prefsSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Sauvegarder
              </button>
            }
          >
            <div className="grid sm:grid-cols-2 gap-6">

              {/* ── Thème — uses currentTheme from ThemeContext as source of truth ── */}
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Thème d'affichage
                </p>
                <div className="flex gap-2">
                  {([
                    { key: 'light',  label: 'Clair',   icon: Sun },
                    { key: 'dark',   label: 'Sombre',  icon: Moon },
                    { key: 'system', label: 'Système', icon: Monitor },
                  ] as const).map(({ key, label, icon: Icon }) => {
                    // Active = what ThemeContext says (reflects immediately)
                    const isActive = prefs.theme === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleThemeChange(key)}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all
                          ${isActive
                            ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-400 text-violet-700 dark:text-violet-300 shadow-sm'
                            : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-900/10'
                          }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
                {/* Shows the resolved theme so system mode is clear */}
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                  Actif : <span className="font-semibold">{currentTheme === 'dark' ? 'Sombre' : currentTheme === 'light' ? 'Clair' : 'Système'}</span>
                </p>
              </div>

              {/* Langue */}
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Langue</p>
                <div className="flex gap-2">
                  {([
                    { key: 'fr', label: '🇫🇷 Français' },
                    { key: 'en', label: '🇬🇧 English' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setPrefs(p => p ? ({ ...p, langue: key }) : p)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all
                        ${prefs.langue === key
                          ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-400 text-violet-700 dark:text-violet-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Notifications</p>
                <div className="space-y-3">
                  {([
                    { key: 'notif_email', label: 'Notifications par email',   icon: Mail },
                    { key: 'notif_inapp', label: "Notifications dans l'app",  icon: Bell },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Icon className="w-3.5 h-3.5 text-gray-400" /> {label}
                      </div>
                      <Toggle
                        checked={prefs[key] as boolean}
                        onChange={v => setPrefs(p => p ? ({ ...p, [key]: v }) : p)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Format date */}
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Format de date</p>
                <div className="space-y-2">
                  {(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setPrefs(p => p ? ({ ...p, date_format: f }) : p)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all flex items-center justify-between
                        ${prefs.date_format === f
                          ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-400 text-violet-700 dark:text-violet-300 font-semibold'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                      {f}
                      {prefs.date_format === f && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── D) Activité contextuelle selon rôle ───────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6">

          <SectionCard
            title={
              rdType === 'EMPLOYEE'                  ? 'Mes demandes récentes'
              : rdType === 'RESPONSABLE_DEPARTEMENT' ? 'Mon département'
              : rdType === 'RESPONSABLE_STOCK'       ? 'Activité stock'
              : "Vue d'ensemble admin"
            }
            icon={
              rdType === 'EMPLOYEE'                  ? FileText
              : rdType === 'RESPONSABLE_DEPARTEMENT' ? Building2
              : rdType === 'RESPONSABLE_STOCK'       ? Package
              : Layers
            }
            iconColor={
              rdType === 'EMPLOYEE'                  ? 'text-blue-500'
              : rdType === 'RESPONSABLE_DEPARTEMENT' ? 'text-amber-500'
              : rdType === 'RESPONSABLE_STOCK'       ? 'text-emerald-500'
              : 'text-red-500'
            }
          >
            {rdType === 'EMPLOYEE' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { label: 'Total',    value: profile.role_data.stats?.total    ?? 0, color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
                    { label: 'En cours', value: profile.role_data.stats?.en_cours ?? 0, color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/30' },
                    { label: 'Livrées',  value: profile.role_data.stats?.livrees  ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
                    { label: 'Refusées', value: profile.role_data.stats?.refusees ?? 0, color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/30' },
                  ]).map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl px-3 py-3 text-center`}>
                      <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {(profile.role_data.demandes_recent ?? []).map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between text-xs py-2 px-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Demande #{d.id}</span>
                      <span className="text-gray-400">{fmt(d.date)}</span>
                      <span className={`px-1.5 py-0.5 rounded font-semibold text-[10px]
                        ${d.statut === 'LIVREE' ? 'bg-emerald-100 text-emerald-700' : d.statut.includes('REFUSEE') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {d.statut.replace(/_/g,' ')}
                      </span>
                    </div>
                  ))}
                  {!(profile.role_data.demandes_recent ?? []).length && (
                    <p className="text-xs text-gray-400 text-center py-4">Aucune demande pour le moment</p>
                  )}
                </div>
                <button onClick={() => navigate('/my-requests')} className="w-full text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 pt-1">
                  Voir toutes mes demandes <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {rdType === 'RESPONSABLE_DEPARTEMENT' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { label: 'Total',      value: profile.role_data.stats?.total      ?? 0, color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
                    { label: 'En attente', value: profile.role_data.stats?.en_attente ?? 0, color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/30' },
                    { label: 'Validées',   value: profile.role_data.stats?.validees   ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
                    { label: 'Refusées',   value: profile.role_data.stats?.refusees   ?? 0, color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/30' },
                  ]).map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl px-3 py-3 text-center`}>
                      <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
                {(profile.role_data.pending_count ?? 0) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="font-semibold text-amber-800 dark:text-amber-300">
                      {profile.role_data.pending_count} demande{profile.role_data.pending_count > 1 ? 's' : ''} à traiter
                    </span>
                  </div>
                )}
                <button onClick={() => navigate('/pending-requests')} className="w-full text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center justify-center gap-1 pt-1">
                  Traiter les demandes <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {rdType === 'RESPONSABLE_STOCK' && (
              <div className="space-y-3">
                {(profile.role_data.alertes_count ?? 0) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      {profile.role_data.alertes_count} produit{profile.role_data.alertes_count > 1 ? 's' : ''} en alerte
                    </span>
                  </div>
                )}
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Derniers mouvements</p>
                <div className="space-y-1.5">
                  {(profile.role_data.mouvements_recent ?? []).map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2.5 text-xs py-2 px-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.type === 'IN' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {m.type === 'IN' ? <ArrowUp className="w-3 h-3 text-green-600" /> : <ArrowDown className="w-3 h-3 text-red-500" />}
                      </div>
                      <span className="flex-1 font-medium text-gray-700 dark:text-gray-300 truncate">{m.produit}</span>
                      <span className={`font-bold ${m.type === 'IN' ? 'text-green-600' : 'text-red-500'}`}>{m.type === 'IN' ? '+' : '−'}{m.quantite}</span>
                      <span className="text-gray-400">{fmt(m.date_mouvement)}</span>
                    </div>
                  ))}
                  {!(profile.role_data.mouvements_recent ?? []).length && (
                    <p className="text-xs text-gray-400 text-center py-4">Aucun mouvement récent</p>
                  )}
                </div>
                <button onClick={() => navigate('/movements')} className="w-full text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center justify-center gap-1 pt-1">
                  Voir tous les mouvements <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {rdType === 'ADMIN' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { label: 'Utilisateurs',   value: profile.role_data.total_users    ?? 0, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30', link: '/users' },
                    { label: 'Demandes total', value: profile.role_data.total_demandes ?? 0, color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/30',  link: '/toutes-demandes' },
                  ]).map(s => (
                    <button key={s.label} onClick={() => navigate(s.link)} className={`${s.bg} rounded-xl px-3 py-4 text-center hover:opacity-80 transition-opacity`}>
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">{s.label}</p>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { label: 'Audit global', link: '/audit',            color: 'text-indigo-600 hover:bg-indigo-50' },
                    { label: 'Mouvements',   link: '/mouvements-stock', color: 'text-emerald-600 hover:bg-emerald-50' },
                    { label: 'Utilisateurs', link: '/users',            color: 'text-blue-600 hover:bg-blue-50' },
                    { label: 'Départements', link: '/departments',      color: 'text-amber-600 hover:bg-amber-50' },
                  ]).map(l => (
                    <button key={l.label} onClick={() => navigate(l.link)}
                      className={`py-2 text-xs font-semibold ${l.color} border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-center gap-1 transition-colors dark:hover:bg-gray-700`}>
                      {l.label} <ChevronRight className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Mes dernières actions */}
          <SectionCard
            title="Mes dernières actions"
            icon={Activity}
            iconColor="text-slate-500"
            action={
              <button onClick={() => navigate(roleKey === 'ADMIN' ? '/audit' : '/profile/activity')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                Voir tout <ChevronRight className="w-3 h-3" />
              </button>
            }
          >
            <div className="space-y-1.5">
              {profile.recent_activity.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">Aucune activité enregistrée</p>
              ) : profile.recent_activity.map(a => {
                const cfg = ACTION_CFG[a.type_action] ?? { color: 'text-gray-700', bg: 'bg-gray-100' };
                return (
                  <div key={a.id} className="flex items-start gap-2.5 py-2 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {a.type_action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{a.description}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        {fmtTime(a.date_action)}
                        {a.reference_objet && <span className="ml-1 font-mono">{a.reference_objet}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

      </div>

      {showEditModal && (
        <EditInfoModal
          profile={profile}
          onClose={() => setEditModal(false)}
          onSaved={(updated) => setProfile(p => p ? ({ ...p, ...updated }) : p)}
          showToast={showToast}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ProfilePage;