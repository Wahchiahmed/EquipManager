import React, { useState, useEffect } from 'react';
import {
  ClipboardList, Package, CheckCircle, Clock, Plus, AlertCircle,
  Trash2, Loader2, X, Pencil, Info,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiProduit {
  id_produit: number; nom_produit: string; description: string | null;
  reference: string | null; quantite: number; seuil_alerte: number;
  is_active: boolean; en_alerte: boolean; categorie_nom: string;
}

interface ApiDetail {
  id_detail: number; id_produit: number;
  produit_nom: string; nom: string;
  reference: string | null; quantite: number;
}

interface ApiDemande {
  id_demande: number; date_demande: string; statut: string;
  commentaire: string | null; id_demandeur: number;
  demandeur_nom: string; demandeur_prenom: string; departement_nom: string;
  responsable_dept: string | null; responsable_stock: string | null;
  date_validation_dept: string | null; date_validation_stock: string | null;
  details: ApiDetail[];
}

interface Stats { total: number; pending: number; approved: number; rejected: number; }

interface CartLine { produit: ApiProduit; quantite: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 text-sm bg-muted border border-transparent rounded-lg ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

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

          {error && (
            <p className="text-xs text-status-rejected">{error}</p>
          )}

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

// ─── Cart Panel ───────────────────────────────────────────────────────────────

interface CartPanelProps {
  produits: ApiProduit[]; cart: CartLine[]; search: string;
  commentaire: string; loading: boolean; error: string;
  onSearchChange: (v: string) => void; onCommentChange: (v: string) => void;
  onAddToCart: (p: ApiProduit) => void; onUpdateQty: (id: number, qty: number) => void;
  onRemoveFromCart: (id: number) => void; onSubmit: () => void; submitLabel: string;
}

const CartPanel: React.FC<CartPanelProps> = ({
  produits, cart, search, commentaire, loading, error,
  onSearchChange, onCommentChange,
  onAddToCart, onUpdateQty, onRemoveFromCart,
  onSubmit, submitLabel,
}) => {
  const filtered = produits.filter(p => p.is_active).filter(p =>
    p.nom_produit.toLowerCase().includes(search.toLowerCase()) ||
    (p.reference ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <input type="text" placeholder="Rechercher un produit…" value={search}
            onChange={e => onSearchChange(e.target.value)} className={inputCls} />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-8">Aucun produit trouvé.</p>
            : filtered.map(p => {
              const inCart = cart.find(l => l.produit.id_produit === p.id_produit);
              return (
                <div key={p.id_produit}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors ${inCart ? 'bg-primary/5' : ''}`}>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.nom_produit}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{p.categorie_nom}</span>
                      {p.reference && <span className="text-[11px] font-mono text-muted-foreground">· {p.reference}</span>}
                      <span className={`text-[11px] font-semibold ${p.en_alerte ? 'text-amber-600' : 'text-status-approved'}`}>
                        {p.en_alerte ? '⚠ ' : ''}{p.quantite} u. dispo.
                      </span>
                    </div>
                  </div>
                  <button onClick={() => onAddToCart(p)}
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-sm font-bold
                      ${inCart ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-primary/20 text-foreground'}`}>
                    +
                  </button>
                </div>
              );
            })}
        </div>
      </div>

      <div className="w-64 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Sélection <span className="text-muted-foreground font-normal">({cart.length})</span>
          </p>
        </div>
        {cart.length === 0
          ? <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground text-center px-4">Cliquez sur + pour ajouter des produits</p>
            </div>
          : <div className="flex-1 overflow-y-auto divide-y divide-border">
              {cart.map(line => (
                <div key={line.produit.id_produit} className="px-4 py-3">
                  <p className="text-xs font-medium text-foreground truncate mb-2">{line.produit.nom_produit}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onUpdateQty(line.produit.id_produit, line.quantite - 1)}
                      className="w-6 h-6 rounded bg-muted hover:bg-border text-sm font-bold flex items-center justify-center">−</button>
                    <input type="number" min={1} value={line.quantite}
                      onChange={e => onUpdateQty(line.produit.id_produit, Number(e.target.value))}
                      className="w-12 text-center text-sm font-semibold bg-muted rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-primary" />
                    <button onClick={() => onUpdateQty(line.produit.id_produit, line.quantite + 1)}
                      className="w-6 h-6 rounded bg-muted hover:bg-border text-sm font-bold flex items-center justify-center">+</button>
                    <button onClick={() => onRemoveFromCart(line.produit.id_produit)}
                      className="ml-auto text-muted-foreground hover:text-status-rejected transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>}
        <div className="px-4 py-4 border-t border-border space-y-3 shrink-0">
          <textarea placeholder="Commentaire (optionnel)…" value={commentaire}
            onChange={e => onCommentChange(e.target.value)} rows={2}
            className="w-full px-3 py-2 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none resize-none" />
          {error && <p className="text-xs text-status-rejected">{error}</p>}
          <button onClick={onSubmit} disabled={loading || cart.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60 transition-colors">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? 'Envoi…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── New Request Modal ────────────────────────────────────────────────────────

const NewRequestModal: React.FC<{
  produits: ApiProduit[]; onClose: () => void; onCreated: (d: ApiDemande) => void;
}> = ({ produits, onClose, onCreated }) => {
  const [cart, setCart]           = useState<CartLine[]>([]);
  const [search, setSearch]       = useState('');
  const [commentaire, setComment] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const addToCart = (p: ApiProduit) =>
    setCart(prev => {
      const exists = prev.find(l => l.produit.id_produit === p.id_produit);
      return exists
        ? prev.map(l => l.produit.id_produit === p.id_produit ? { ...l, quantite: l.quantite + 1 } : l)
        : [...prev, { produit: p, quantite: 1 }];
    });

  const updateQty = (id: number, qty: number) => {
    if (qty < 1) { removeFromCart(id); return; }
    setCart(prev => prev.map(l => l.produit.id_produit === id ? { ...l, quantite: qty } : l));
  };

  const removeFromCart = (id: number) =>
    setCart(prev => prev.filter(l => l.produit.id_produit !== id));

  const handleSubmit = async () => {
    if (cart.length === 0) { setError('Ajoutez au moins un produit.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await api.post('/demandes', {
        commentaire: commentaire || null,
        details: cart.map(l => ({ id_produit: l.produit.id_produit, quantite: l.quantite })),
      });
      onCreated(res.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Une erreur est survenue.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">Nouvelle demande</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Sélectionnez les produits dont vous avez besoin</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <CartPanel
          produits={produits} cart={cart} search={search} commentaire={commentaire}
          loading={loading} error={error}
          onSearchChange={setSearch} onCommentChange={setComment}
          onAddToCart={addToCart} onUpdateQty={updateQty} onRemoveFromCart={removeFromCart}
          onSubmit={handleSubmit}
          submitLabel={`Envoyer la demande (${cart.length} produit${cart.length > 1 ? 's' : ''})`}
        />
      </div>
    </div>
  );
};

// ─── Edit Demande Modal ───────────────────────────────────────────────────────

const EditDemandeModal: React.FC<{
  demande: ApiDemande; produits: ApiProduit[];
  onClose: () => void; onUpdated: (d: ApiDemande) => void;
}> = ({ demande, produits, onClose, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const buildInitialCart = (): CartLine[] =>
    demande.details.map(det => {
      const produit = produits.find(p => p.id_produit === det.id_produit);
      const fallback: ApiProduit = {
        id_produit: det.id_produit, nom_produit: det.nom ?? det.produit_nom,
        description: null, reference: det.reference, quantite: 0,
        seuil_alerte: 0, is_active: false, en_alerte: false, categorie_nom: '—',
      };
      return { produit: produit ?? fallback, quantite: det.quantite };
    });

  const [cart, setCart]           = useState<CartLine[]>(buildInitialCart);
  const [commentaire, setComment] = useState(demande.commentaire ?? '');

  const hasChanges = (() => {
    if (commentaire !== (demande.commentaire ?? '')) return true;
    if (cart.length !== demande.details.length) return true;
    return cart.some(line => {
      const orig = demande.details.find(d => d.id_produit === line.produit.id_produit);
      return !orig || orig.quantite !== line.quantite;
    });
  })();

  const addToCart = (p: ApiProduit) =>
    setCart(prev => {
      const exists = prev.find(l => l.produit.id_produit === p.id_produit);
      return exists
        ? prev.map(l => l.produit.id_produit === p.id_produit ? { ...l, quantite: l.quantite + 1 } : l)
        : [...prev, { produit: p, quantite: 1 }];
    });

  const updateQty = (id: number, qty: number) => {
    if (qty < 1) { removeFromCart(id); return; }
    setCart(prev => prev.map(l => l.produit.id_produit === id ? { ...l, quantite: qty } : l));
  };

  const removeFromCart = (id: number) =>
    setCart(prev => prev.filter(l => l.produit.id_produit !== id));

  const handleSubmit = async () => {
    if (cart.length === 0) { setError('La demande doit contenir au moins un produit.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await api.put(`/demandes/${demande.id_demande}/modifier`, {
        commentaire: commentaire || null,
        details: cart.map(l => ({ id_produit: l.produit.id_produit, quantite: l.quantite })),
      });
      onUpdated(res.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Une erreur est survenue.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Modifier la demande #{demande.id_demande}</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Modifiez les produits ou les quantités — la demande reste en attente
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        {hasChanges && (
          <div className="mx-6 mt-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 shrink-0">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 font-medium">
              Modifications non sauvegardées — cliquez sur "Enregistrer" pour confirmer.
            </p>
          </div>
        )}
        <CartPanel
          produits={produits} cart={cart} search={search} commentaire={commentaire}
          loading={loading} error={error}
          onSearchChange={setSearch} onCommentChange={setComment}
          onAddToCart={addToCart} onUpdateQty={updateQty} onRemoveFromCart={removeFromCart}
          onSubmit={handleSubmit}
          submitLabel={!hasChanges ? 'Aucune modification' : `Enregistrer (${cart.length} produit${cart.length > 1 ? 's' : ''})`}
        />
      </div>
    </div>
  );
};

// ─── Employee Dashboard ───────────────────────────────────────────────────────

const EmployeeDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  const [stats, setStats]       = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [demandes, setDemandes] = useState<ApiDemande[]>([]);
  const [produits, setProduits] = useState<ApiProduit[]>([]);

  const [statsLoading,    setStatsLoading]    = useState(true);
  const [demandesLoading, setDemandesLoading] = useState(true);
  const [produitsLoading, setProduitsLoading] = useState(true);

  const [showNewRequest, setShowNewRequest]     = useState(false);
  const [editDemande,    setEditDemande]         = useState<ApiDemande | null>(null);
  const [deleteDemande,  setDeleteDemande]       = useState<ApiDemande | null>(null);

  useEffect(() => {
    api.get('/demandes/stats').then(r => setStats(r.data)).finally(() => setStatsLoading(false));
    api.get('/demandes').then(r => setDemandes(r.data)).finally(() => setDemandesLoading(false));
    api.get('/produits').then(r => setProduits(r.data)).finally(() => setProduitsLoading(false));
  }, []);

  const alertProducts = produits.filter(p => p.en_alerte && p.is_active);

  const handleCreated = (demande: ApiDemande) => {
    setDemandes(prev => [demande, ...prev]);
    setStats(prev => ({ ...prev, total: prev.total + 1, pending: prev.pending + 1 }));
  };

  const handleUpdated = (updated: ApiDemande) =>
    setDemandes(prev => prev.map(d => d.id_demande === updated.id_demande ? updated : d));

  const handleDeleted = (id: number) => {
    setDemandes(prev => prev.filter(d => d.id_demande !== id));
    setStats(prev => ({ ...prev, total: prev.total - 1, pending: prev.pending - 1 }));
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bonjour, {currentUser?.prenom} 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Département {currentUser?.departement ?? '—'}</p>
        </div>
        <button
          onClick={() => setShowNewRequest(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors shadow-brand"
        >
          <Plus className="w-4 h-4" /> Nouvelle demande
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Mes demandes" value={stats.total}    icon={ClipboardList} color="bg-primary"   sub="Total"     loading={statsLoading} />
        <StatCard title="En attente"   value={stats.pending}  icon={Clock}         color="bg-amber-500" sub="À traiter" loading={statsLoading} />
        <StatCard title="Approuvées"   value={stats.approved} icon={CheckCircle}   color="bg-green-500" sub="Validées"  loading={statsLoading} />
        <StatCard title="Refusées"     value={stats.rejected} icon={AlertCircle}   color="bg-red-500"   sub="Rejetées"  loading={statsLoading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── Recent requests ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Mes dernières demandes</h2>
            <span className="text-xs text-muted-foreground">{stats.total} demandes</span>
          </div>

          {demandesLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : demandes.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune demande pour l'instant</p>
              <button onClick={() => setShowNewRequest(true)} className="mt-3 text-xs text-primary hover:underline">
                Créer votre première demande
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {demandes.slice(0, 5).map(demande => {
                const isEditable = demande.statut === 'EN_ATTENTE_DEPT';
                return (
                  <div
                    key={demande.id_demande}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Demande #{demande.id_demande}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {demande.details.map(d => d.nom ?? d.produit_nom ?? `Produit #${d.id_produit}`).join(', ')}
                      </p>
                    </div>

                    {/* Status + date */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={demande.statut} />
                      <span className="text-[11px] text-muted-foreground">{demande.date_demande}</span>
                    </div>

                    {/* Actions — only visible on hover, only for EN_ATTENTE_DEPT */}
                    {isEditable ? (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                        {/* Edit */}
                        <button
                          onClick={() => setEditDemande(demande)}
                          title="Modifier"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setDeleteDemande(demande)}
                          title="Supprimer"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-status-rejected hover:bg-status-rejected/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 shrink-0 ml-1" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Product catalogue ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Catalogue produits</h2>
            <span className="text-xs text-muted-foreground">{produits.length} articles</span>
          </div>
          {produitsLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Chargement…</span>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {produits.filter(p => p.is_active).slice(0, 6).map(produit => (
                <div key={produit.id_produit} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
                    <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{produit.nom_produit}</p>
                    <p className="text-xs text-muted-foreground">{produit.categorie_nom}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${produit.en_alerte ? 'bg-status-rejected-bg text-status-rejected' : 'bg-status-approved-bg text-status-approved'}`}>
                    {produit.quantite} u.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock alert */}
      {!produitsLoading && alertProducts.length > 0 && (
        <div className="bg-status-pending-bg border border-status-pending/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-status-pending" />
            <h3 className="font-semibold text-sm text-status-pending">Produits en stock limité</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {alertProducts.map(p => (
              <div key={p.id_produit} className="bg-card rounded-lg px-3 py-2.5 border border-status-pending/20">
                <p className="text-xs font-medium text-foreground truncate">{p.nom_produit}</p>
                <p className="text-xs text-status-rejected mt-0.5 font-semibold">{p.quantite} / {p.seuil_alerte} min.</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewRequest && (
        <NewRequestModal produits={produits} onClose={() => setShowNewRequest(false)} onCreated={handleCreated} />
      )}
      {editDemande && (
        <EditDemandeModal
          demande={editDemande} produits={produits}
          onClose={() => setEditDemande(null)}
          onUpdated={updated => { handleUpdated(updated); setEditDemande(null); }}
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

export default EmployeeDashboard;