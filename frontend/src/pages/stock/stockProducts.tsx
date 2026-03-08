// src/pages/stock/StockProducts.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Package,
  Plus,
  ArrowUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  MessageSquare,
  Loader2,
  Search,
  Filter,
  BarChart3,
  Layers,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import api from "@/lib/api";
import ProductLotsModal from "./../Admin/ProductLotsModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Produit {
  id: number;
  nom: string;
  description: string | null;
  reference: string | null;
  quantite: number;
  seuil_alerte: number;
  categorie_nom: string | null;
  en_alerte: boolean;
}

interface CategorieOption {
  id_categorie: number;
  nom_categorie: string;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

const Toast: React.FC<{
  msg: string;
  type: "success" | "error";
  onClose: () => void;
}> = ({ msg, type, onClose }) => (
  <div
    className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-semibold ${type === "success" ? "bg-green-600" : "bg-red-600"}`}
  >
    {type === "success" ? (
      <CheckCircle2 className="w-5 h-5 shrink-0" />
    ) : (
      <AlertTriangle className="w-5 h-5 shrink-0" />
    )}
    <span>{msg}</span>
    <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100">
      <X className="w-4 h-4" />
    </button>
  </div>
);

// ─── Add Stock Modal ───────────────────────────────────────────────────────────

const AddStockModal: React.FC<{
  produits: Produit[];
  preselected?: Produit | null;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}> = ({ produits, preselected, onClose, onSuccess, showToast }) => {
  const [selProduct, setSelProduct] = useState(
    preselected ? String(preselected.id) : "",
  );
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selProd = produits.find((p) => p.id === Number(selProduct));

  const handleSubmit = async () => {
    if (!selProduct || !qty) return;
    setSubmitting(true);
    try {
      await api.post("/stock/entree", {
        id_produit: Number(selProduct),
        quantite: Number(qty),
        note: note || undefined,
      });
      showToast("Entrée de stock enregistrée ✓", "success");
      onSuccess();
      onClose();
    } catch (e: any) {
      showToast(
        e.response?.data?.message ?? "Erreur lors de l'entrée",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white">
            Entrée de stock
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Produit
            </label>
            <select
              value={selProduct}
              onChange={(e) => setSelProduct(e.target.value)}
              className="w-full text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white dark:bg-gray-900"
            >
              <option value="">Sélectionner…</option>
              {produits.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                  {p.en_alerte ? " ⚠" : ""} (stock : {p.quantite})
                </option>
              ))}
            </select>
          </div>
          {selProd && (
            <div
              className={`flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl border ${selProd.en_alerte ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              Stock actuel : <strong>{selProd.quantite}</strong> / seuil :{" "}
              <strong>{selProd.seuil_alerte}</strong>
              {selProd.en_alerte && (
                <AlertTriangle className="w-3.5 h-3.5 ml-auto" />
              )}
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Quantité à ajouter
            </label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Ex : 10"
              className="w-full text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white dark:bg-gray-900"
            />
            {selProd && Number(qty) > 0 && (
              <p className="text-xs text-gray-500 mt-1.5">
                Nouveau stock :{" "}
                <strong className="text-green-600">
                  {selProd.quantite + Number(qty)}
                </strong>
                {selProd.en_alerte &&
                  selProd.quantite + Number(qty) >= selProd.seuil_alerte && (
                    <span className="ml-2 text-green-600 font-semibold">
                      ✓ Alerte résolue
                    </span>
                  )}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Note{" "}
              <span className="text-gray-400 ml-1 font-normal">
                (optionnel)
              </span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : Réception commande fournisseur"
              className="w-full text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white dark:bg-gray-900"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selProduct || !qty || submitting}
            className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Create Product Modal (resp stock — sans delete/toggle) ───────────────────

const CreateProduitModal: React.FC<{
  categories: CategorieOption[];
  onClose: () => void;
  onCreated: (p: Produit) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}> = ({ categories, onClose, onCreated, showToast }) => {
  const [form, setForm] = useState({
    nom_produit: "",
    description: "",
    reference: "",
    code_barre: "",
    quantite: "0",
    seuil_alerte: "5",
    id_categorie: "",
  });
  const [loading, setLoading] = useState(false);

  const set =
    (f: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/produits", {
        nom_produit: form.nom_produit,
        description: form.description || null,
        reference: form.reference || null,
        code_barre: form.code_barre || null,
        quantite: Number(form.quantite),
        seuil_alerte: Number(form.seuil_alerte),
        id_categorie: Number(form.id_categorie),
        is_active: true,
      });
      // Normalise API shape → Produit shape
      const p = res.data;
      onCreated({
        id: p.id_produit,
        nom: p.nom_produit,
        description: p.description,
        reference: p.reference,
        quantite: p.quantite,
        seuil_alerte: p.seuil_alerte,
        categorie_nom: p.categorie_nom,
        en_alerte: p.en_alerte,
      });
      showToast("Produit créé avec succès ✓", "success");
      onClose();
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors;
      showToast(
        typeof m === "string"
          ? m
          : JSON.stringify(m ?? "Une erreur est survenue."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              Nouveau produit
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Le produit sera actif et un lot initial sera créé automatiquement
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Nom du produit *
            </label>
            <input
              type="text"
              required
              value={form.nom_produit}
              onChange={set("nom_produit")}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              rows={2}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-gray-900 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                Référence
              </label>
              <input
                type="text"
                value={form.reference}
                onChange={set("reference")}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                Code barre
              </label>
              <input
                type="text"
                value={form.code_barre}
                onChange={set("code_barre")}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-gray-900"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                Quantité initiale *
              </label>
              <input
                type="number"
                required
                min={0}
                value={form.quantite}
                onChange={set("quantite")}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                Seuil d'alerte *
              </label>
              <input
                type="number"
                required
                min={0}
                value={form.seuil_alerte}
                onChange={set("seuil_alerte")}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-gray-900"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Catégorie *
            </label>
            <select
              required
              value={form.id_categorie}
              onChange={set("id_categorie")}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-gray-900"
            >
              <option value="">Choisir une catégorie…</option>
              {categories.map((c) => (
                <option key={c.id_categorie} value={c.id_categorie}>
                  {c.nom_categorie}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {loading ? "Création..." : "Créer le produit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

const StockProducts: React.FC = () => {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categories, setCategories] = useState<CategorieOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "alerte" | "ok">(
    "all",
  );
  const [filterCat, setFilterCat] = useState("");

  // Modals
  const [showAddStock, setShowAddStock] = useState(false);
  const [showCreateProduit, setShowCreate] = useState(false);
  const [preselected, setPreselected] = useState<Produit | null>(null);
  const [lotsModal, setLotsModal] = useState<{
    id: number;
    nom: string;
  } | null>(null);

  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [pr, fd] = await Promise.all([
        api.get("/stock/produits"),
        api.get("/produits/form-data"),
      ]);
      setProduits(pr.data);
      setCategories(fd.data.categories ?? []);
    } catch {
      showToast("Erreur de chargement", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const catNames = [
    ...new Set(produits.map((p) => p.categorie_nom).filter(Boolean)),
  ] as string[];
  const alertCount = produits.filter((p) => p.en_alerte).length;

  const filtered = produits.filter((p) => {
    const matchSearch =
      p.nom.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "all"
        ? true
        : filterStatus === "alerte"
          ? p.en_alerte
          : !p.en_alerte;
    const matchCat = filterCat ? p.categorie_nom === filterCat : true;
    return matchSearch && matchStatus && matchCat;
  });

  const chartData = [...produits]
    .sort((a, b) => b.quantite - a.quantite)
    .slice(0, 8)
    .map((p) => ({
      name: p.nom.slice(0, 12),
      stock: p.quantite,
      alerte: p.seuil_alerte,
    }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Catalogue produits
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {produits.length} produit{produits.length > 1 ? "s" : ""} au total
              {alertCount > 0 && (
                <span className="ml-2 font-semibold text-amber-600">
                  · {alertCount} en alerte
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
            {/* ── NEW: Créer un produit ── */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Nouveau produit
            </button>
            <button
              onClick={() => {
                setPreselected(null);
                setShowAddStock(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-sm transition-colors"
            >
              <ArrowUp className="w-4 h-4" /> Entrée de stock
            </button>
          </div>
        </div>

        {/* Alert banner */}
        {!loading && alertCount > 0 && (
          <div className="flex items-center gap-3 px-5 py-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {alertCount} produit{alertCount > 1 ? "s" : ""} sous le seuil
              d'alerte
            </span>
            <button
              onClick={() => setFilterStatus("alerte")}
              className="ml-auto text-xs font-semibold text-amber-700 dark:text-amber-400 underline underline-offset-2"
            >
              Voir uniquement
            </button>
          </div>
        )}

        {/* Chart */}
        {!loading && produits.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Niveaux de stock (Top 8)
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={chartData}
                margin={{ top: 0, right: 0, left: -15, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(156,163,175,0.15)"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="stock"
                  name="Stock actuel"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="alerte"
                  name="Seuil alerte"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Nom, référence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-44"
            />
          </div>
          <div className="flex gap-1.5">
            {[
              { key: "all", label: `Tous (${produits.length})` },
              { key: "alerte", label: `Alerte (${alertCount})` },
              { key: "ok", label: `OK (${produits.length - alertCount})` },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilterStatus(opt.key as any)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterStatus === opt.key ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {catNames.length > 0 && (
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="ml-auto text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none"
            >
              <option value="">Toutes catégories</option>
              {catNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Filter className="w-8 h-8 text-gray-300 mb-3" />
              <p className="font-semibold text-gray-600 dark:text-gray-300">
                Aucun produit trouvé
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Essayez un autre filtre
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    {[
                      "Produit",
                      "Référence",
                      "Catégorie",
                      "Stock",
                      "Seuil",
                      "Statut",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {filtered.map((p) => {
                    const pct = Math.min(
                      100,
                      Math.round(
                        (p.quantite / Math.max(p.seuil_alerte, 1)) * 100,
                      ),
                    );
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${p.en_alerte ? "bg-amber-50/30 dark:bg-amber-900/5" : ""}`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.en_alerte ? "bg-amber-100 dark:bg-amber-900/40" : "bg-indigo-100 dark:bg-indigo-900/40"}`}
                            >
                              <Package
                                className={`w-4 h-4 ${p.en_alerte ? "text-amber-600" : "text-indigo-600"}`}
                              />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                {p.nom}
                              </p>
                              {p.description && (
                                <p className="text-xs text-gray-400 truncate max-w-[160px]">
                                  {p.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs font-mono text-gray-500">
                          {p.reference ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          {p.categorie_nom ? (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
                              {p.categorie_nom}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-bold ${p.en_alerte ? "text-amber-600" : "text-gray-900 dark:text-white"}`}
                            >
                              {p.quantite}
                            </span>
                            <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${p.en_alerte ? "bg-amber-400" : "bg-green-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">
                          {p.seuil_alerte}
                        </td>
                        <td className="px-5 py-3.5">
                          {p.en_alerte ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-lg">
                              <AlertTriangle className="w-3 h-3" /> Alerte
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-lg">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {/* ── Lots FIFO ── */}
                            <button
                              onClick={() =>
                                setLotsModal({ id: p.id, nom: p.nom })
                              }
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-600"
                              title="Voir les lots FIFO"
                            >
                              <Layers className="w-3.5 h-3.5" /> Lots
                            </button>
                            {/* ── Entrée stock ── */}
                            <button
                              onClick={() => {
                                setPreselected(p);
                                setShowAddStock(true);
                              }}
                              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${p.en_alerte ? "bg-green-500 hover:bg-green-600 text-white" : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300"}`}
                            >
                              <ArrowUp className="w-3 h-3" /> Ajouter
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
              {filtered.length} produit{filtered.length > 1 ? "s" : ""} affiché
              {filtered.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showAddStock && (
        <AddStockModal
          produits={produits}
          preselected={preselected}
          onClose={() => {
            setShowAddStock(false);
            setPreselected(null);
          }}
          onSuccess={() => fetchData(true)}
          showToast={showToast}
        />
      )}

      {showCreateProduit && (
        <CreateProduitModal
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={(p) => {
            setProduits((prev) => [p, ...prev]);
          }}
          showToast={showToast}
        />
      )}

      {lotsModal && (
        <ProductLotsModal
          produitId={lotsModal.id}
          produitNom={lotsModal.nom}
          endpointPrefix="/stock"
          onClose={() => setLotsModal(null)}
        />
      )}

      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default StockProducts;
