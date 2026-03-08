// src/pages/employee/EmployeeShared.tsx
import React, { useState } from 'react';
import { Package, Trash2, Loader2, X, Pencil, Info } from 'lucide-react';
import api from '@/lib/api';
import { ApiProduit, ApiDemande, CartLine, inputCls } from './EmployeeTypes';

// ── CartPanel ─────────────────────────────────────────────────────────────────

interface CartPanelProps {
  produits:         ApiProduit[];
  cart:             CartLine[];
  search:           string;
  commentaire:      string;
  loading:          boolean;
  error:            string;
  onSearchChange:   (v: string) => void;
  onCommentChange:  (v: string) => void;
  onAddToCart:      (p: ApiProduit) => void;
  onUpdateQty:      (id: number, qty: number) => void;
  onRemoveFromCart: (id: number) => void;
  onSubmit:         () => void;
  submitLabel:      string;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  produits, cart, search, commentaire, loading, error,
  onSearchChange, onCommentChange,
  onAddToCart, onUpdateQty, onRemoveFromCart,
  onSubmit, submitLabel,
}) => {
  const activeProduits = produits.filter(p => p.is_active);
  const filtered = activeProduits.filter(p =>
    p.nom_produit.toLowerCase().includes(search.toLowerCase()) ||
    (p.reference ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: product picker */}
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <input
            type="text" placeholder="Rechercher un produit…"
            value={search} onChange={e => onSearchChange(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun produit trouvé.</p>
          ) : filtered.map(p => {
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
                    {p.reference && (
                      <span className="text-[11px] font-mono text-muted-foreground">· {p.reference}</span>
                    )}
                    <span className={`text-[11px] font-semibold ${p.en_alerte ? 'text-amber-600' : 'text-status-approved'}`}>
                      {p.en_alerte ? '⚠ ' : ''}{p.quantite} u. dispo.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onAddToCart(p)}
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-sm font-bold
                    ${inCart ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-primary/20 text-foreground'}`}
                >+</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: cart + submit */}
      <div className="w-64 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Sélection <span className="text-muted-foreground font-normal">({cart.length})</span>
          </p>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center px-4">
              Cliquez sur + pour ajouter des produits
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {cart.map(line => (
              <div key={line.produit.id_produit} className="px-4 py-3">
                <p className="text-xs font-medium text-foreground truncate mb-2">
                  {line.produit.nom_produit}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => onUpdateQty(line.produit.id_produit, line.quantite - 1)}
                    className="w-6 h-6 rounded bg-muted hover:bg-border text-sm font-bold flex items-center justify-center">−
                  </button>
                  <input type="number" min={1} value={line.quantite}
                    onChange={e => onUpdateQty(line.produit.id_produit, Number(e.target.value))}
                    className="w-12 text-center text-sm font-semibold bg-muted rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button onClick={() => onUpdateQty(line.produit.id_produit, line.quantite + 1)}
                    className="w-6 h-6 rounded bg-muted hover:bg-border text-sm font-bold flex items-center justify-center">+
                  </button>
                  <button onClick={() => onRemoveFromCart(line.produit.id_produit)}
                    className="ml-auto text-muted-foreground hover:text-status-rejected transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-4 border-t border-border space-y-3 shrink-0">
          <textarea placeholder="Commentaire (optionnel)…" value={commentaire}
            onChange={e => onCommentChange(e.target.value)} rows={2}
            className="w-full px-3 py-2 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none resize-none"
          />
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

// ── NewRequestModal ───────────────────────────────────────────────────────────

export const NewRequestModal: React.FC<{
  produits:  ApiProduit[];
  onClose:   () => void;
  onCreated: (d: ApiDemande) => void;
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

// ── EditDemandeModal ──────────────────────────────────────────────────────────

export const EditDemandeModal: React.FC<{
  demande:   ApiDemande;
  produits:  ApiProduit[];
  onClose:   () => void;
  onUpdated: (d: ApiDemande) => void;
}> = ({ demande, produits, onClose, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const buildInitialCart = (): CartLine[] =>
    demande.details.map(det => {
      const produit = produits.find(p => p.id_produit === det.id_produit);
      const fallback: ApiProduit = {
        id_produit: det.id_produit, nom_produit: det.produit_nom,
        description: null, reference: det.reference,
        quantite: 0, seuil_alerte: 0,
        is_active: false, en_alerte: false, categorie_nom: '—',
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
          submitLabel={
            !hasChanges
              ? 'Aucune modification'
              : `Enregistrer (${cart.length} produit${cart.length > 1 ? 's' : ''})`
          }
        />
      </div>
    </div>
  );
};