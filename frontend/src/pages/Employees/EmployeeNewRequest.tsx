// src/pages/employee/EmployeeNewRequest.tsx
import React, { useState, useEffect } from 'react';
import { Package, Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { ApiProduit, ApiDemande, CartLine, inputCls } from './EmployeeTypes';

const EmployeeNewRequest: React.FC = () => {
  const navigate = useNavigate();

  const [produits, setProduits] = useState<ApiProduit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [cart, setCart]         = useState<CartLine[]>([]);
  const [search, setSearch]     = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [commentaire, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);

  useEffect(() => {
    api.get('/produits').then(r => setProduits(r.data)).finally(() => setLoading(false));
  }, []);

  const activeProduits = produits.filter(p => p.is_active);
  const categories = [...new Set(activeProduits.map(p => p.categorie_nom))].sort();

  const filtered = activeProduits.filter(p => {
    const matchSearch = p.nom_produit.toLowerCase().includes(search.toLowerCase())
      || (p.reference ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat ? p.categorie_nom === filterCat : true;
    return matchSearch && matchCat;
  });

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
    setError(''); setSubmitting(true);
    try {
      await api.post('/demandes', {
        commentaire: commentaire || null,
        details: cart.map(l => ({ id_produit: l.produit.id_produit, quantite: l.quantite })),
      });
      setSuccess(true);
      setTimeout(() => navigate('/my-requests'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Une erreur est survenue.');
    } finally { setSubmitting(false); }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-full bg-status-approved-bg flex items-center justify-center">
          <svg className="w-8 h-8 text-status-approved" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground">Demande envoyée !</h2>
        <p className="text-sm text-muted-foreground">Redirection vers vos demandes…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nouvelle demande</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Sélectionnez les produits dont vous avez besoin
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">

        {/* Left: product catalogue */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">
                Catalogue <span className="text-xs font-normal text-muted-foreground">({filtered.length} produits)</span>
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <input
                type="text" placeholder="Rechercher…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-40"
              />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none">
                <option value="">Toutes catégories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement…</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucun produit trouvé.</p>
          ) : (
            <div className="grid sm:grid-cols-2 divide-border">
              {filtered.map(p => {
                const inCart = cart.find(l => l.produit.id_produit === p.id_produit);
                return (
                  <div key={p.id_produit}
                    className={`flex items-center gap-3 px-4 py-3.5 border-b border-r border-border/50 hover:bg-muted/30 transition-colors ${inCart ? 'bg-primary/5' : ''}`}>
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.nom_produit}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">{p.categorie_nom}</span>
                        <span className={`text-[11px] font-semibold ${p.en_alerte ? 'text-amber-600' : 'text-status-approved'}`}>
                          · {p.en_alerte ? '⚠ ' : ''}{p.quantite} dispo.
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => addToCart(p)}
                      className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                        ${inCart ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-primary/20 text-foreground'}`}
                    >+</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: cart summary */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm sticky top-6">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">
              Ma sélection{' '}
              <span className="text-xs font-normal text-muted-foreground">({cart.length} produit{cart.length > 1 ? 's' : ''})</span>
            </h2>
          </div>

          {cart.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Plus className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Cliquez sur + pour ajouter des produits</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {cart.map(line => (
                <div key={line.produit.id_produit} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-medium text-foreground leading-tight">{line.produit.nom_produit}</p>
                    <button onClick={() => removeFromCart(line.produit.id_produit)}
                      className="text-muted-foreground hover:text-status-rejected transition-colors shrink-0 mt-0.5">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(line.produit.id_produit, line.quantite - 1)}
                      className="w-6 h-6 rounded bg-muted hover:bg-border text-sm font-bold flex items-center justify-center">−
                    </button>
                    <input type="number" min={1} value={line.quantite}
                      onChange={e => updateQty(line.produit.id_produit, Number(e.target.value))}
                      className="w-12 text-center text-sm font-semibold bg-muted rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button onClick={() => updateQty(line.produit.id_produit, line.quantite + 1)}
                      className="w-6 h-6 rounded bg-muted hover:bg-border text-sm font-bold flex items-center justify-center">+
                    </button>
                    <span className="text-[11px] text-muted-foreground ml-1">unité{line.quantite > 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 py-4 border-t border-border space-y-3">
            <textarea placeholder="Commentaire pour le responsable (optionnel)…"
              value={commentaire} onChange={e => setComment(e.target.value)} rows={3}
              className="w-full px-3 py-2 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none resize-none"
            />

            {error && (
              <div className="flex items-center gap-2 text-xs text-status-rejected">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={submitting || cart.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60 transition-colors">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Envoi en cours…' : 'Envoyer la demande'}
            </button>

            <button onClick={() => navigate('/my-requests')}
              className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeNewRequest;