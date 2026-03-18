import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Eye, EyeOff, LogIn, UserPlus, ArrowLeft, CheckCircle2,
  Boxes, ChevronRight, Shield, BarChart3, Package,
} from 'lucide-react';
import api from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Role { id: number; nom: string; }

// ── Role label helper ──────────────────────────────────────────────────────────

const roleLabel = (nom: string) => {
  const m: Record<string, string> = {
    'employe': 'Employé', 'responsable departement': 'Responsable de département',
    'responsable stock': 'Responsable stock', 'admin': 'Administrateur',
  };
  return m[nom.toLowerCase()] ?? nom;
};

// ── Animated background blobs ──────────────────────────────────────────────────

const BackgroundBlobs: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[100px] animate-pulse" style={{ animationDuration: '4s' }} />
    <div className="absolute -bottom-40 -right-20 w-[600px] h-[600px] rounded-full bg-indigo-500/15 blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-sky-400/10 blur-[80px] animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
    {/* Grid lines */}
    <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  </div>
);

// ── Feature card ───────────────────────────────────────────────────────────────

const Feature: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 group">
    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors">
      {icon}
    </div>
    <div>
      <p className="text-white/50 text-[11px] uppercase tracking-widest font-medium">{label}</p>
      <p className="text-white font-semibold text-sm">{value}</p>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

const Login: React.FC = () => {
  const [mode, setMode]                     = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword]     = useState(false);
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [signupSuccess, setSignupSuccess]   = useState(false);
  const [roles, setRoles]                   = useState<Role[]>([]);

  // Login fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Signup fields
  const [sNom, setSNom]           = useState('');
  const [sPrenom, setSPrenom]     = useState('');
  const [sEmail, setSEmail]       = useState('');
  const [sPassword, setSPassword] = useState('');
  const [sCin, setSCin]           = useState('');
  const [sTel, setSTel]           = useState('');
  const [sRoleId, setSRoleId]     = useState('');

  const { login } = useAuth();
  const navigate  = useNavigate();

  useEffect(() => {
    if (mode === 'signup' && roles.length === 0) {
      api.get('/inscription/roles')
        .then(r => setRoles(r.data))
        .catch(() => {});
    }
  }, [mode]);

  const resetForm = () => {
    setError(''); setShowPassword(false);
  };

  const switchMode = (m: 'login' | 'signup') => {
    setMode(m); resetForm(); setSignupSuccess(false);
  };

  // ── Login ────────────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) navigate('/dashboard');
    else setError('Email ou mot de passe incorrect.');
  };

  // ── Signup ───────────────────────────────────────────────────────────────────

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/inscription', {
        nom: sNom, prenom: sPrenom, email: sEmail,
        password: sPassword, cin: sCin || undefined,
        telephone: sTel || undefined, role_id: Number(sRoleId),
      });
      setSignupSuccess(true);
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors;
      if (typeof m === 'object' && m !== null) {
        const first = Object.values(m)[0];
        setError(Array.isArray(first) ? first[0] : String(first));
      } else {
        setError(typeof m === 'string' ? m : 'Une erreur est survenue.');
      }
    } finally { setLoading(false); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex bg-[#080c14] overflow-hidden">

      {/* ── Left Panel ──────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 relative p-12 overflow-hidden">
        <BackgroundBlobs />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Boxes className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">EquipManager</p>
            <p className="text-white/40 text-xs">Gestion d'équipements</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 mt-auto mb-auto pt-20">
          <div className="inline-flex items-center gap-2 bg-white/8 border border-white/12 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/70 text-xs font-medium tracking-wide">Plateforme sécurisée</span>
          </div>

          <h1 className="text-5xl font-bold text-white leading-[1.1] tracking-tight mb-6">
            Gérez vos<br />
            <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">
              équipements
            </span><br />
            sans effort.
          </h1>

          <p className="text-white/50 text-base leading-relaxed max-w-sm mb-12">
            Suivi des stocks, validation des demandes et gestion des utilisateurs — tout en un.
          </p>

          <div className="space-y-4">
            <Feature icon={<Package className="w-4 h-4 text-blue-300" />} label="Produits gérés" value="Catalogue complet" />
            <Feature icon={<BarChart3 className="w-4 h-4 text-sky-300" />} label="Mouvements FIFO" value="Traçabilité totale" />
            <Feature icon={<Shield className="w-4 h-4 text-indigo-300" />} label="Accès sécurisé" value="Rôles & permissions" />
          </div>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 grid grid-cols-3 gap-4 mt-12">
          {[
            { v: '94%', l: 'Taux validation' },
            { v: '1k+', l: 'Demandes traitées' },
            { v: '48',  l: 'Utilisateurs actifs' },
          ].map(s => (
            <div key={s.l} className="bg-white/6 border border-white/10 rounded-2xl p-4 text-center backdrop-blur-sm">
              <p className="text-2xl font-bold text-white">{s.v}</p>
              <p className="text-white/40 text-[11px] mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 lg:max-w-[480px] flex flex-col bg-[#0d1117] lg:border-l lg:border-white/8">

        {/* Mobile logo */}
        <div className="flex items-center gap-2 p-6 lg:hidden">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
            <Boxes className="w-4 h-4 text-white" />
          </div>
          <p className="font-bold text-white">EquipManager</p>
        </div>

        {/* Toggle tabs */}
        <div className="px-8 pt-8 pb-0 lg:pt-12">
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            {[
              { key: 'login'  as const, label: 'Connexion',    icon: LogIn   },
              { key: 'signup' as const, label: 'Inscription',   icon: UserPlus },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => switchMode(t.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === t.key
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 overflow-y-auto px-8 py-8">

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Bon retour 👋</h2>
                <p className="text-white/40 text-sm mt-1">Connectez-vous à votre espace</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">Email</label>
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-3 text-sm bg-white/6 border border-white/12 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-11 text-sm bg-white/6 border border-white/12 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 disabled:opacity-60 disabled:cursor-not-allowed group">
                  {loading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <LogIn className="w-4 h-4" />}
                  {loading ? 'Connexion en cours…' : 'Se connecter'}
                  {!loading && <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-0.5 transition-transform" />}
                </button>
              </form>

              <div className="mt-8 pt-8 border-t border-white/8 text-center">
                <p className="text-white/30 text-sm">Pas encore de compte ?</p>
                <button onClick={() => switchMode('signup')} className="mt-2 text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors flex items-center gap-1 mx-auto">
                  <UserPlus className="w-4 h-4" /> Demander l'accès
                </button>
              </div>
            </div>
          )}

          {/* ── SIGNUP ── */}
          {mode === 'signup' && !signupSuccess && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">Demande d'accès</h2>
                <p className="text-white/40 text-sm mt-1">Un administrateur validera votre demande</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">Prénom *</label>
                    <input
                      type="text" required value={sPrenom} onChange={e => setSPrenom(e.target.value)}
                      className="w-full px-4 py-3 text-sm bg-white/6 border border-white/12 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">Nom *</label>
                    <input
                      type="text" required value={sNom} onChange={e => setSNom(e.target.value)}
                      className="w-full px-4 py-3 text-sm bg-white/6 border border-white/12 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">Email *</label>
                  <input
                    type="email" required value={sEmail} onChange={e => setSEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-3 text-sm bg-white/6 border border-white/12 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">Mot de passe *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'} required minLength={6} value={sPassword} onChange={e => setSPassword(e.target.value)}
                      placeholder="Minimum 6 caractères"
                      className="w-full px-4 py-3 pr-11 text-sm bg-white/6 border border-white/12 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">CIN</label>
                    <input
                      type="text" value={sCin} onChange={e => setSCin(e.target.value)}
                      placeholder="Optionnel"
                      className="w-full px-4 py-3 text-sm bg-white/6 border border-white/12 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">Téléphone</label>
                    <input
                      type="text" value={sTel} onChange={e => setSTel(e.target.value)}
                      placeholder="Optionnel"
                      className="w-full px-4 py-3 text-sm bg-white/6 border border-white/12 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">Rôle demandé *</label>
                  <select required value={sRoleId} onChange={e => setSRoleId(e.target.value)}
                    className="w-full px-4 py-3 text-sm bg-white/6 border border-white/12 rounded-xl text-white focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none">
                    <option value="" className="bg-[#0d1117]">Choisir un rôle…</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id} className="bg-[#0d1117]">{roleLabel(r.nom)}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-3 text-xs text-blue-300/70 leading-relaxed">
                  Votre demande sera examinée par un administrateur. Vous recevrez un email de confirmation à l'adresse indiquée.
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 disabled:opacity-60 group">
                  {loading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <UserPlus className="w-4 h-4" />}
                  {loading ? 'Envoi en cours…' : 'Soumettre la demande'}
                  {!loading && <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-0.5 transition-transform" />}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button onClick={() => switchMode('login')} className="text-white/30 hover:text-white/60 text-sm transition-colors flex items-center gap-1 mx-auto">
                  <ArrowLeft className="w-3.5 h-3.5" /> Retour à la connexion
                </button>
              </div>
            </div>
          )}

          {/* ── SIGNUP SUCCESS ── */}
          {mode === 'signup' && signupSuccess && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Demande envoyée !</h3>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-8">
                Votre demande a été transmise aux administrateurs. Vous recevrez un email dès qu'elle sera traitée.
              </p>
              <div className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-left mb-8">
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-2">Ce qui va se passer</p>
                {[
                  'Un admin examine votre demande',
                  'Vous recevez un email de décision',
                  'Si accepté, vous pouvez vous connecter',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-xs text-blue-300 font-bold shrink-0">{i + 1}</span>
                    <span className="text-white/60 text-sm">{step}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => switchMode('login')}
                className="flex items-center gap-2 px-6 py-2.5 bg-white/8 border border-white/15 rounded-xl text-white/70 hover:text-white text-sm font-semibold transition-all">
                <ArrowLeft className="w-4 h-4" /> Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;