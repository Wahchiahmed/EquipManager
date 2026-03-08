// src/pages/employee/EmployeeCatalog.tsx
import React, { useState, useEffect } from 'react';
import { Package, Search, AlertCircle, Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { ApiProduit } from './EmployeeTypes';

const EmployeeCatalog: React.FC = () => {
  const navigate = useNavigate();

  const [produits, setProduits] = useState<ApiProduit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [filterDispo, setFilterDispo] = useState('');

  useEffect(() => {
    api.get('/produits').then(r => setProduits(r.data)).finally(() => setLoading(false));
  }, []);

  const activeProduits = produits.filter(p => p.is_active);
  const categories = [...new Set(activeProduits.map(p => p.categorie_nom))].sort();
  const alertCount = activeProduits.filter(p => p.en_alerte).length;

  const filtered = activeProduits.filter(p => {
    const matchSearch = p.nom_produit.toLowerCase().includes(search.toLowerCase())
      || (p.reference ?? '').toLowerCase().includes(search.toLowerCase())
      || p.categorie_nom.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat ? p.categorie_nom === filterCat : true;
    const matchDispo =
      filterDispo === 'dispo' ? !p.en_alerte :
        filterDispo === 'alerte' ? p.en_alerte : true;
    return matchSearch && matchCat && matchDispo;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catalogue produits</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {activeProduits.length} produits disponibles · {alertCount > 0 ? `${alertCount} en stock limité` : 'Tous bien approvisionnés'}
          </p>
        </div>
        <button
          onClick={() => navigate('/new-request')}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors shadow-brand"
        >
          <Plus className="w-4 h-4" /> Faire une demande
        </button>
      </div>

      {/* Low stock alert banner */}
      {!loading && alertCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{alertCount}</strong> produit{alertCount > 1 ? 's' : ''} en stock limité — les quantités disponibles sont réduites.
          </span>
          <button onClick={() => setFilterDispo('alerte')} className="ml-auto text-xs font-semibold underline underline-offset-2">
            Voir
          </button>
        </div>
      )}

      {/* Category chips */}
      {!loading && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCat('')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${!filterCat ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border hover:border-primary/40'}`}
          >
            Tous ({activeProduits.length})
          </button>
          {categories.map(cat => {
            const count = activeProduits.filter(p => p.categorie_nom === cat).length;
            return (
              <button key={cat}
                onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${filterCat === cat ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border hover:border-primary/40'}`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">
              Produits <span className="text-xs font-normal text-muted-foreground">({filtered.length}/{activeProduits.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" placeholder="Nom, référence, catégorie…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-52"
              />
            </div>
            <select value={filterDispo} onChange={e => setFilterDispo(e.target.value)}
              className="py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none">
              <option value="">Toutes disponibilités</option>
              <option value="dispo">Bien approvisionnés</option>
              <option value="alerte">Stock limité</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun produit trouvé.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {filtered.map(p => (
              <div key={p.id_produit}
                className="bg-card p-4 hover:bg-muted/30 transition-colors flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{p.nom_produit}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.categorie_nom}</p>
                    {p.reference && (
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{p.reference}</p>
                    )}
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Stock disponible</p>
                    <p className={`text-lg font-bold ${p.en_alerte ? 'text-amber-600' : 'text-status-approved'}`}>
                      {p.quantite}
                      <span className="text-xs font-normal ml-1">unités</span>
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.en_alerte ? 'bg-amber-100 text-amber-700' : 'bg-status-approved-bg text-status-approved'}`}>
                    {p.en_alerte ? '⚠ Stock limité' : 'Disponible'}
                  </span>
                </div>

                <button
                  onClick={() => navigate('/new-request')}
                  className="w-full py-1.5 text-xs font-semibold rounded-lg border border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  Demander ce produit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeCatalog;