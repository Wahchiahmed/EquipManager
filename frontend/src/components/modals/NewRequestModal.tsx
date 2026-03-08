import React, { useState } from 'react';
import { X, Package, Plus, Trash2, Search } from 'lucide-react';
import { mockProduits } from '@/data/mockData';
import { Produit } from '@/types';

interface NewRequestModalProps {
  onClose: () => void;
}

const NewRequestModal: React.FC<NewRequestModalProps> = ({ onClose }) => {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<{ produit: Produit; quantite: number }[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const filteredProducts = mockProduits.filter(p =>
    p.nom_produit.toLowerCase().includes(search.toLowerCase()) ||
    p.categorie_nom?.toLowerCase().includes(search.toLowerCase())
  );

  const addItem = (produit: Produit) => {
    const existing = items.find(i => i.produit.id_produit === produit.id_produit);
    if (existing) {
      setItems(prev => prev.map(i => i.produit.id_produit === produit.id_produit ? { ...i, quantite: i.quantite + 1 } : i));
    } else {
      setItems(prev => [...prev, { produit, quantite: 1 }]);
    }
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(i => i.produit.id_produit !== id));
  };

  const updateQty = (id: number, qty: number) => {
    if (qty < 1) return;
    setItems(prev => prev.map(i => i.produit.id_produit === id ? { ...i, quantite: qty } : i));
  };

  const handleSubmit = () => {
    if (items.length === 0) return;
    setSubmitted(true);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-2xl animate-bounce-in max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-foreground text-lg">Nouvelle demande d'équipement</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-status-approved-bg flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-status-approved" />
            </div>
            <h4 className="font-semibold text-foreground text-lg">Demande soumise !</h4>
            <p className="text-muted-foreground text-sm mt-1">En attente de validation par votre responsable</p>
          </div>
        ) : (
          <>
            <div className="flex flex-1 overflow-hidden">
              {/* Product list */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 border-r border-border">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm bg-muted border border-transparent rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  {filteredProducts.map(p => (
                    <div key={p.id_produit} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer" onClick={() => addItem(p)}>
                      <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.nom_produit}</p>
                        <p className="text-xs text-muted-foreground">{p.categorie_nom}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.quantite <= p.seuil_alerte ? 'bg-status-rejected-bg text-status-rejected' : 'bg-status-approved-bg text-status-approved'}`}>
                          {p.quantite} u.
                        </span>
                        <button className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary-hover transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected items */}
              <div className="w-64 p-4 flex flex-col">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sélection ({items.length})</p>
                {items.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Cliquez sur un produit pour l'ajouter</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin">
                    {items.map(item => (
                      <div key={item.produit.id_produit} className="p-3 bg-muted rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-foreground leading-snug">{item.produit.nom_produit}</p>
                          <button onClick={() => removeItem(item.produit.id_produit)} className="text-muted-foreground hover:text-status-rejected shrink-0">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateQty(item.produit.id_produit, item.quantite - 1)} className="w-5 h-5 rounded bg-border text-foreground text-xs flex items-center justify-center hover:bg-border/80">-</button>
                          <span className="text-xs font-semibold text-foreground w-6 text-center">{item.quantite}</span>
                          <button onClick={() => updateQty(item.produit.id_produit, item.quantite + 1)} className="w-5 h-5 rounded bg-primary text-primary-foreground text-xs flex items-center justify-center hover:bg-primary-hover">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-3 shrink-0">
              <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted transition-colors">Annuler</button>
              <button
                onClick={handleSubmit}
                disabled={items.length === 0}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors shadow-brand disabled:opacity-50"
              >
                Soumettre la demande
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewRequestModal;
