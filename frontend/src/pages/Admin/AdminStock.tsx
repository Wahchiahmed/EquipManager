import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Package, Plus, Search, Trash2, Loader2, X, Tag, AlertTriangle,
  ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Layers,
  UserPlus, UserMinus, Users, ChevronDown, ChevronUp,
} from "lucide-react";
import api from "@/lib/api";
import ProductLotsModal from "./ProductLotsModal";
import { ApiProduit, ApiCategorie, CategorieOption, ProduitForm, EMPTY_PRODUIT_FORM, inputCls } from "./adminTypes";
import { ConfirmDialog, Field, PageHeader, LoadingSpinner, ErrorBanner } from "./AdminShared";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Gestionnaire {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  nb_produits: number;
}

interface AssignationDetail {
  stock_id: number;
  gestionnaire_id: number;
  nom: string;
  prenom: string;
  email: string;
}

// ── Assign Modal ──────────────────────────────────────────────────────────────

const AssignModal: React.FC<{
  produit: ApiProduit;
  gestionnaires: Gestionnaire[];
  assignes: AssignationDetail[];
  onClose: () => void;
  onAssigned: (gestionnaireId: number) => void;
  onUnassigned: (gestionnaireId: number) => void;
}> = ({ produit, gestionnaires, assignes, onClose, onAssigned, onUnassigned }) => {
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError]     = useState("");

  const assignesIds = assignes.map(a => a.gestionnaire_id);
  const disponibles = gestionnaires.filter(g => !assignesIds.includes(g.id));

  const handleAssign = async (gestionnaireId: number) => {
    setLoading(gestionnaireId);
    setError("");
    try {
      await api.post("/admin/stocks/assigner", {
        id_produit: produit.id_produit,
        id_gestionnaire_stock: gestionnaireId,
      });
      onAssigned(gestionnaireId);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Erreur lors de l'assignation");
    } finally {
      setLoading(null);
    }
  };

  const handleUnassign = async (gestionnaireId: number) => {
    setLoading(gestionnaireId);
    setError("");
    try {
      await api.delete("/admin/stocks/desassigner", {
        data: { id_produit: produit.id_produit, id_gestionnaire_stock: gestionnaireId },
      });
      onUnassigned(gestionnaireId);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Erreur lors de la désassignation");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Gestionnaires assignés
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{produit.nom_produit}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Actuellement assignés */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Assignés ({assignes.length})
            </p>
            {assignes.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">Aucun gestionnaire assigné à ce produit.</p>
            ) : (
              <div className="space-y-2">
                {assignes.map(a => (
                  <div key={a.gestionnaire_id} className="flex items-center justify-between p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.prenom} {a.nom}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                    <button
                      onClick={() => handleUnassign(a.gestionnaire_id)}
                      disabled={loading === a.gestionnaire_id}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {loading === a.gestionnaire_id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <UserMinus className="w-3.5 h-3.5" />}
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Disponibles à assigner */}
          {disponibles.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Disponibles ({disponibles.length})
              </p>
              <div className="space-y-2">
                {disponibles.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-2.5 bg-muted border border-border rounded-lg hover:bg-muted/70 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">{g.prenom} {g.nom}</p>
                      <p className="text-xs text-muted-foreground">{g.email} · {g.nb_produits} produit{g.nb_produits > 1 ? 's' : ''} géré{g.nb_produits > 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => handleAssign(g.id)}
                      disabled={loading === g.id}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                      {loading === g.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <UserPlus className="w-3.5 h-3.5" />}
                      Assigner
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gestionnaires.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun responsable stock actif dans le système.
            </p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0">
          <button onClick={onClose} className="w-full py-2 text-sm font-semibold rounded-lg border border-border hover:bg-muted transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Create Product Modal ──────────────────────────────────────────────────────

const CreateProduitModal: React.FC<{
  categories: CategorieOption[];
  onClose: () => void;
  onCreated: (p: ApiProduit) => void;
}> = ({ categories, onClose, onCreated }) => {
  const [form, setForm] = useState<ProduitForm>(EMPTY_PRODUIT_FORM);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const set = (f: keyof ProduitForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/produits", {
        nom_produit:  form.nom_produit,
        description:  form.description || null,
        reference:    form.reference   || null,
        code_barre:   form.code_barre  || null,
        quantite:     Number(form.quantite),
        seuil_alerte: Number(form.seuil_alerte),
        id_categorie: Number(form.id_categorie),
        is_active:    form.is_active,
      });
      onCreated(res.data);
      onClose();
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors;
      setError(typeof m === "string" ? m : JSON.stringify(m ?? "Une erreur est survenue."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold text-foreground">Ajouter un produit</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <Field label="Nom du produit" required>
            <input type="text" required value={form.nom_produit} onChange={set("nom_produit")} className={inputCls} />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Référence"><input type="text" value={form.reference} onChange={set("reference")} className={inputCls} /></Field>
            <Field label="Code barre"><input type="text" value={form.code_barre} onChange={set("code_barre")} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantité initiale" required>
              <input type="number" required min={0} value={form.quantite} onChange={set("quantite")} className={inputCls} />
            </Field>
            <Field label="Seuil d'alerte" required>
              <input type="number" required min={0} value={form.seuil_alerte} onChange={set("seuil_alerte")} className={inputCls} />
            </Field>
          </div>
          <Field label="Catégorie" required>
            <select required value={form.id_categorie} onChange={set("id_categorie")} className={inputCls}>
              <option value="">Choisir une catégorie...</option>
              {categories.map(c => <option key={c.id_categorie} value={c.id_categorie}>{c.nom_categorie}</option>)}
            </select>
          </Field>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
              className={form.is_active ? "text-status-approved" : "text-muted-foreground"}>
              {form.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
            <span className="text-xs font-medium text-foreground">{form.is_active ? "Produit actif" : "Produit inactif"}</span>
          </div>
          {error && <p className="text-xs text-status-rejected bg-status-rejected-bg border border-status-rejected/30 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? "Création..." : "Ajouter le produit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const AdminProduitsStock: React.FC = () => {
  const [produits, setProduits]         = useState<ApiProduit[]>([]);
  const [categories, setCategories]     = useState<CategorieOption[]>([]);
  const [allCategories, setAllCats]     = useState<ApiCategorie[]>([]);
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([]);
  // Map: id_produit → AssignationDetail[]
  const [assignations, setAssignations] = useState<Record<number, AssignationDetail[]>>({});

  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterCat, setFilterCat]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatNom, setNewCatNom]   = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [catError, setCatError]     = useState("");
  const [confirmDel, setConfirmDel] = useState<ApiProduit | null>(null);
  const [toggling, setToggling]     = useState<number | null>(null);
  const [deleting, setDeleting]     = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [lotsModal, setLotsModal]     = useState<{ id: number; nom: string } | null>(null);
  const [assignModal, setAssignModal] = useState<ApiProduit | null>(null);

  // Gestionnaires panel toggle
  const [showGestPanel, setShowGestPanel] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, fd, cats, gest, assigns] = await Promise.all([
        api.get("/produits"),
        api.get("/produits/form-data"),
        api.get("/categories"),
        api.get("/admin/gestionnaires"),
        api.get("/admin/stocks"),
      ]);

      setProduits(p.data);
      setCategories(fd.data.categories);
      setAllCats(cats.data);
      setGestionnaires(gest.data);

      // Construire la map id_produit → assignations[]
      const map: Record<number, AssignationDetail[]> = {};
      for (const a of assigns.data) {
        if (!map[a.produit_id]) map[a.produit_id] = [];
        map[a.produit_id].push({
          stock_id:        a.id,
          gestionnaire_id: a.gestionnaire_id,
          nom:             a.gestionnaire?.nom    ?? '',
          prenom:          a.gestionnaire?.prenom ?? '',
          email:           a.gestionnaire?.email  ?? '',
        });
      }
      setAssignations(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { setCurrentPage(1); }, [search, filterCat, filterStatus]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleToggle = async (p: ApiProduit) => {
    setToggling(p.id_produit);
    try {
      const r = await api.patch(`/produits/${p.id_produit}/toggle-active`);
      setProduits(prev => prev.map(x => x.id_produit === p.id_produit ? r.data.produit : x));
    } catch {
      setActionError("Erreur lors du changement de statut.");
    } finally { setToggling(null); }
  };

  const handleDelete = async (p: ApiProduit) => {
    setDeleting(p.id_produit);
    try {
      await api.delete(`/produits/${p.id_produit}`);
      setProduits(prev => prev.filter(x => x.id_produit !== p.id_produit));
      setAssignations(prev => { const n = { ...prev }; delete n[p.id_produit]; return n; });
      setConfirmDel(null);
    } catch {
      setActionError("Erreur lors de la suppression.");
      setConfirmDel(null);
    } finally { setDeleting(null); }
  };

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError("");
    setCreatingCat(true);
    try {
      const res = await api.post("/categories", { nom_categorie: newCatNom, description: newCatDesc || null });
      setAllCats(p => [...p, res.data]);
      setCategories(p => [...p, { id_categorie: res.data.id_categorie, nom_categorie: res.data.nom_categorie }]);
      setNewCatNom(""); setNewCatDesc(""); setShowCatForm(false);
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors?.nom_categorie?.[0];
      setCatError(typeof m === "string" ? m : "Erreur.");
    } finally { setCreatingCat(false); }
  };

  // Mise à jour locale des assignations sans re-fetch
  const handleAssigned = (produitId: number, gestionnaireId: number) => {
    const g = gestionnaires.find(x => x.id === gestionnaireId);
    if (!g) return;
    setAssignations(prev => ({
      ...prev,
      [produitId]: [
        ...(prev[produitId] ?? []),
        { stock_id: 0, gestionnaire_id: g.id, nom: g.nom, prenom: g.prenom, email: g.email },
      ],
    }));
    setGestionnaires(prev => prev.map(x => x.id === gestionnaireId ? { ...x, nb_produits: x.nb_produits + 1 } : x));
  };

  const handleUnassigned = (produitId: number, gestionnaireId: number) => {
    setAssignations(prev => ({
      ...prev,
      [produitId]: (prev[produitId] ?? []).filter(a => a.gestionnaire_id !== gestionnaireId),
    }));
    setGestionnaires(prev => prev.map(x => x.id === gestionnaireId ? { ...x, nb_produits: Math.max(0, x.nb_produits - 1) } : x));
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const filtered = produits.filter(p => {
    const matchSearch  = p.nom_produit.toLowerCase().includes(search.toLowerCase()) || (p.reference ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat     = filterCat     ? String(p.id_categorie) === filterCat : true;
    const matchStatus  = filterStatus === "actif" ? p.is_active : filterStatus === "inactif" ? !p.is_active : filterStatus === "alerte" ? p.en_alerte : true;
    return matchSearch && matchCat && matchStatus;
  });

  const totalPages   = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const alertCount = produits.filter(p => p.en_alerte && p.is_active).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader title="Produits & Stock" subtitle="Inventaire, catégories et assignation des gestionnaires" />

      {showCreate && (
        <CreateProduitModal categories={categories} onClose={() => setShowCreate(false)} onCreated={p => setProduits(prev => [p, ...prev])} />
      )}

      {confirmDel && (
        <ConfirmDialog danger message={`Supprimer "${confirmDel.nom_produit}" ? Cette action est irréversible.`} onCancel={() => setConfirmDel(null)} onConfirm={() => handleDelete(confirmDel)} />
      )}

      {lotsModal && (
        <ProductLotsModal produitId={lotsModal.id} produitNom={lotsModal.nom} endpointPrefix="/admin" onClose={() => setLotsModal(null)} />
      )}

      {assignModal && (
        <AssignModal
          produit={assignModal}
          gestionnaires={gestionnaires}
          assignes={assignations[assignModal.id_produit] ?? []}
          onClose={() => setAssignModal(null)}
          onAssigned={gId => handleAssigned(assignModal.id_produit, gId)}
          onUnassigned={gId => handleUnassigned(assignModal.id_produit, gId)}
        />
      )}

      <div className="space-y-4">
        {alertCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span><strong>{alertCount}</strong> produit{alertCount > 1 ? "s" : ""} en dessous du seuil d'alerte.</span>
            <button onClick={() => setFilterStatus("alerte")} className="ml-auto text-xs font-semibold underline underline-offset-2">Voir</button>
          </div>
        )}

        {actionError && <ErrorBanner message={actionError} onClose={() => setActionError("")} />}

        {/* ── Gestionnaires panel ────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setShowGestPanel(v => !v)}
            className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">
                Responsables stock <span className="text-xs font-normal text-muted-foreground">({gestionnaires.length})</span>
              </h3>
            </div>
            {showGestPanel ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showGestPanel && (
            <div className="border-t border-border px-5 py-4">
              {gestionnaires.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun responsable stock actif.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {gestionnaires.map(g => (
                    <div key={g.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                        {g.prenom[0]}{g.nom[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{g.prenom} {g.nom}</p>
                        <p className="text-xs text-muted-foreground">{g.nb_produits} produit{g.nb_produits > 1 ? 's' : ''} assigné{g.nb_produits > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Categories panel ──────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">Catégories <span className="text-xs font-normal text-muted-foreground">({allCategories.length})</span></h3>
            </div>
            <button onClick={() => { setShowCatForm(v => !v); setCatError(""); }}
              className="text-xs font-semibold px-3 py-1.5 bg-muted border border-border text-foreground rounded-lg hover:bg-border flex items-center gap-1">
              <Plus className="w-3 h-3" /> Catégorie
            </button>
          </div>

          {showCatForm && (
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <form onSubmit={handleCreateCat} className="space-y-3">
                <div className="flex gap-3">
                  <input type="text" required autoFocus placeholder="Nom de la catégorie..." value={newCatNom} onChange={e => setNewCatNom(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-card border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  <button type="submit" disabled={creatingCat} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-60">
                    {creatingCat && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {creatingCat ? "Création..." : "Créer"}
                  </button>
                  <button type="button" onClick={() => setShowCatForm(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input type="text" placeholder="Description (optionnel)" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                {catError && <p className="text-xs text-status-rejected">{catError}</p>}
              </form>
            </div>
          )}

          <div className="flex flex-wrap gap-2 px-5 py-3">
            {allCategories.map(c => (
              <button key={c.id_categorie}
                onClick={() => setFilterCat(String(c.id_categorie) === filterCat ? "" : String(c.id_categorie))}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${String(c.id_categorie) === filterCat ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:border-primary/40"}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                {c.nom_categorie}
                <span className="opacity-60">({c.produits_count})</span>
              </button>
            ))}
            {allCategories.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground py-1">Aucune catégorie. Commencez par en créer une.</p>
            )}
          </div>
        </div>

        {/* ── Products table ────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">
                Produits <span className="text-xs font-normal text-muted-foreground">({filtered.length}/{produits.length})</span>
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input type="text" placeholder="Nom, référence..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none w-40" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="py-1.5 px-3 text-xs bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none">
                <option value="">Tous statuts</option>
                <option value="actif">Actifs</option>
                <option value="inactif">Inactifs</option>
                <option value="alerte">En alerte</option>
              </select>
              <button onClick={() => setShowCreate(true)}
                className="text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover flex items-center gap-1">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
          </div>

          {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucun produit trouvé.</p>
          ) : (
            <div className="flex flex-col flex-1">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      {["Produit", "Référence", "Catégorie", "Quantité", "Seuil", "Gestionnaires", "Statut", "Ajouté le", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedData.map(p => {
                      const assignes = assignations[p.id_produit] ?? [];
                      return (
                        <tr key={p.id_produit} className={`hover:bg-muted/30 transition-colors ${!p.is_active ? "opacity-50" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{p.nom_produit}</p>
                                {p.description && <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{p.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.reference ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded-full">{p.categorie_nom}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${p.en_alerte && p.is_active ? "text-amber-600" : "text-foreground"}`}>
                              {p.quantite}
                            </span>
                            {p.en_alerte && p.is_active && <span className="ml-1 text-[10px] text-amber-600 font-semibold">⚠</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{p.seuil_alerte}</td>

                          {/* ── Colonne gestionnaires ── */}
                          <td className="px-4 py-3">
                            {assignes.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">Non assigné</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {assignes.slice(0, 2).map(a => (
                                  <span key={a.gestionnaire_id} className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 px-1.5 py-0.5 rounded-full">
                                    {a.prenom[0]}.{a.nom}
                                  </span>
                                ))}
                                {assignes.length > 2 && (
                                  <span className="text-[10px] font-semibold bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-full">
                                    +{assignes.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.is_active ? "bg-status-approved-bg text-status-approved" : "bg-muted text-muted-foreground"}`}>
                              {p.is_active ? "Actif" : "Inactif"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{p.created_at}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {/* Assigner gestionnaire */}
                              <button onClick={() => setAssignModal(p)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 transition-colors"
                                title="Gérer les gestionnaires">
                                <Users className="w-3.5 h-3.5" />
                                {assignes.length > 0 ? `${assignes.length}` : '+'}
                              </button>
                              {/* Lots FIFO */}
                              <button onClick={() => setLotsModal({ id: p.id_produit, nom: p.nom_produit })}
                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-border border border-border transition-colors"
                                title="Voir les lots FIFO">
                                <Layers className="w-3.5 h-3.5" /> Lots
                              </button>
                              {/* Toggle active */}
                              <button disabled={toggling === p.id_produit} onClick={() => handleToggle(p)}
                                className={`transition-colors ${p.is_active ? "text-status-approved hover:text-amber-600" : "text-muted-foreground hover:text-status-approved"}`}
                                title={p.is_active ? "Désactiver" : "Activer"}>
                                {toggling === p.id_produit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : p.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                              </button>
                              {/* Delete */}
                              <button disabled={deleting === p.id_produit} onClick={() => setConfirmDel(p)}
                                className="text-muted-foreground hover:text-status-rejected transition-colors" title="Supprimer">
                                {deleting === p.id_produit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20 mt-auto">
                  <span className="text-xs text-muted-foreground">
                    Affichage de <span className="font-semibold text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> à <span className="font-semibold text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> sur <span className="font-semibold text-foreground">{filtered.length}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="p-1.5 rounded-md bg-card border border-border text-foreground disabled:opacity-50 hover:bg-muted transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold px-2 text-muted-foreground">Page {currentPage} sur {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="p-1.5 rounded-md bg-card border border-border text-foreground disabled:opacity-50 hover:bg-muted transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProduitsStock;