import React, { useState, useEffect, useCallback } from "react";
import {
  Check,
  X,
  Clock,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Package,
  User,
  Calendar,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Eye,
  Plus,
  Trash2,
  Loader2,
  Info,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import axios from "axios";

// ─── API helpers ─────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiProduit {
  id_produit: number;
  nom_produit: string;
  description: string | null;
  reference: string | null;
  quantite: number;
  seuil_alerte: number;
  is_active: boolean;
  en_alerte: boolean;
  categorie_nom: string;
}

interface ApiDetail {
  id_detail: number;
  id_produit: number;
  produit_nom?: string;
  nom?: string;
  reference: string | null;
  quantite: number;
  statut?: string;
}

interface ApiDemande {
  id_demande: number;
  date_demande: string;
  statut: string;
  commentaire: string | null;
  id_demandeur: number;
  demandeur?: {
    id: number;
    nom: string;
    prenom: string;
    email?: string;
    departement?: { nom: string };
  };
  demandeur_nom?: string;
  demandeur_prenom?: string;
  details: ApiDetail[];
}

interface Stats {
  total: number;
  en_attente: number;
  transmises: number;
  traitees: number;
  refusees: number;
  par_mois?: { mois: number; total: number }[];
  validees?: number;
}

interface CartLine {
  produit: ApiProduit;
  quantite: number;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  EN_ATTENTE_DEPT: {
    label: "En attente",
    color: "#f59e0b",
    bg: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  EN_ATTENTE_STOCK: {
    label: "Att. Stock",
    color: "#8b5cf6",
    bg: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  },
  VALIDEE: {
    label: "Validée",
    color: "#10b981",
    bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  LIVREE: {
    label: "Livrée",
    color: "#3b82f6",
    bg: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  REFUSEE_DEPT: {
    label: "Refusée",
    color: "#ef4444",
    bg: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  REFUSEE_STOCK: {
    label: "Ref. Stock",
    color: "#dc2626",
    bg: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-900 border border-transparent rounded-lg " +
  "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    bg: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide ${cfg.bg}`}
    >
      {cfg.label}
    </span>
  );
};

const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
  loading?: boolean;
}> = ({ label, value, icon: Icon, colorClass, loading }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-3xl font-bold mt-1.5 text-gray-900 dark:text-white">
          {loading ? (
            <span className="inline-block w-8 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            value
          )}
        </p>
      </div>
      <div
        className={`w-12 h-12 rounded-xl ${colorClass} flex items-center justify-center shadow-sm`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const Toast: React.FC<{
  msg: string;
  type: "success" | "error";
  onClose: () => void;
}> = ({ msg, type, onClose }) => (
  <div
    className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium ${type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
  >
    {type === "success" ? (
      <CheckCircle2 className="w-5 h-5" />
    ) : (
      <AlertTriangle className="w-5 h-5" />
    )}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
      <X className="w-4 h-4" />
    </button>
  </div>
);

// ─── Cart Panel (shared between modals) ──────────────────────────────────────

interface CartPanelProps {
  produits: ApiProduit[];
  cart: CartLine[];
  search: string;
  commentaire: string;
  loading: boolean;
  error: string;
  onSearchChange: (v: string) => void;
  onCommentChange: (v: string) => void;
  onAddToCart: (p: ApiProduit) => void;
  onUpdateQty: (id: number, qty: number) => void;
  onRemoveFromCart: (id: number) => void;
  onSubmit: () => void;
  submitLabel: string;
}

const CartPanel: React.FC<CartPanelProps> = ({
  produits,
  cart,
  search,
  commentaire,
  loading,
  error,
  onSearchChange,
  onCommentChange,
  onAddToCart,
  onUpdateQty,
  onRemoveFromCart,
  onSubmit,
  submitLabel,
}) => {
  const activeProduits = produits.filter((p) => p.is_active);
  const filtered = activeProduits.filter(
    (p) =>
      p.nom_produit.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Left: product picker ── */}
      <div className="flex-1 flex flex-col border-r border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <input
            type="text"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Aucun produit trouvé.
            </p>
          ) : (
            filtered.map((p) => {
              const inCart = cart.find(
                (l) => l.produit.id_produit === p.id_produit,
              );
              return (
                <div
                  key={p.id_produit}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${inCart ? "bg-indigo-50 dark:bg-indigo-900/10" : ""}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {p.nom_produit}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-gray-400">
                        {p.categorie_nom}
                      </span>
                      {p.reference && (
                        <span className="text-[11px] font-mono text-gray-400">
                          · {p.reference}
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-semibold ${p.en_alerte ? "text-amber-600" : "text-emerald-600"}`}
                      >
                        {p.en_alerte ? "⚠ " : ""}
                        {p.quantite} u. dispo.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onAddToCart(p)}
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-sm font-bold
                    ${
                      inCart
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    +
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: cart + submit ── */}
      <div className="w-64 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Sélection{" "}
            <span className="text-gray-400 font-normal">({cart.length})</span>
          </p>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-gray-400 text-center px-4">
              Cliquez sur + pour ajouter des produits
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {cart.map((line) => (
              <div key={line.produit.id_produit} className="px-4 py-3">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate mb-2">
                  {line.produit.nom_produit}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      onUpdateQty(line.produit.id_produit, line.quantite - 1)
                    }
                    className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-bold flex items-center justify-center"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={line.quantite}
                    onChange={(e) =>
                      onUpdateQty(
                        line.produit.id_produit,
                        Number(e.target.value),
                      )
                    }
                    className="w-12 text-center text-sm font-semibold bg-gray-100 dark:bg-gray-700 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() =>
                      onUpdateQty(line.produit.id_produit, line.quantite + 1)
                    }
                    className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                  <button
                    onClick={() => onRemoveFromCart(line.produit.id_produit)}
                    className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment + submit */}
        <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700 space-y-3 shrink-0">
          <textarea
            placeholder="Commentaire (optionnel)…"
            value={commentaire}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-xs bg-gray-100 dark:bg-gray-900 border border-transparent rounded-lg focus:border-indigo-500 focus:outline-none resize-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={onSubmit}
            disabled={loading || cart.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? "Envoi…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── New Request Modal (Chef Département) ─────────────────────────────────────

const NewRequestModal: React.FC<{
  produits: ApiProduit[];
  onClose: () => void;
  onCreated: (d: ApiDemande) => void;
}> = ({ produits, onClose, onCreated }) => {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [commentaire, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addToCart = (p: ApiProduit) =>
    setCart((prev) => {
      const exists = prev.find((l) => l.produit.id_produit === p.id_produit);
      return exists
        ? prev.map((l) =>
            l.produit.id_produit === p.id_produit
              ? { ...l, quantite: l.quantite + 1 }
              : l,
          )
        : [...prev, { produit: p, quantite: 1 }];
    });

  const updateQty = (id: number, qty: number) => {
    if (qty < 1) {
      removeFromCart(id);
      return;
    }
    setCart((prev) =>
      prev.map((l) =>
        l.produit.id_produit === id ? { ...l, quantite: qty } : l,
      ),
    );
  };

  const removeFromCart = (id: number) =>
    setCart((prev) => prev.filter((l) => l.produit.id_produit !== id));

  const handleSubmit = async () => {
    if (cart.length === 0) {
      setError("Ajoutez au moins un produit.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // POST /dept/demandes → storeChefDept → statut EN_ATTENTE_STOCK directement
      const res = await api.post("/dept/demandes", {
        commentaire: commentaire || null,
        details: cart.map((l) => ({
          id_produit: l.produit.id_produit,
          quantite: l.quantite,
        })),
      });
      onCreated(res.data);
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <Plus className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                Nouvelle demande
              </h3>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 ml-9">
              Votre demande sera transmise directement au responsable stock
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Info banner */}
        <div className="mx-6 mt-4 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl flex items-center gap-2 shrink-0">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
            En tant que chef de département, votre demande bypasse la validation
            département et est envoyée directement au stock.
          </p>
        </div>

        <CartPanel
          produits={produits}
          cart={cart}
          search={search}
          commentaire={commentaire}
          loading={loading}
          error={error}
          onSearchChange={setSearch}
          onCommentChange={setComment}
          onAddToCart={addToCart}
          onUpdateQty={updateQty}
          onRemoveFromCart={removeFromCart}
          onSubmit={handleSubmit}
          submitLabel={`Envoyer au stock (${cart.length} produit${cart.length > 1 ? "s" : ""})`}
        />
      </div>
    </div>
  );
};

// ─── Action Modal ─────────────────────────────────────────────────────────────

const ActionModal: React.FC<{
  demande: ApiDemande;
  onClose: () => void;
  onApprove: (id: number, comment: string) => void;
  onReject: (id: number, comment: string) => void;
  submitting: boolean;
}> = ({ demande, onClose, onApprove, onReject, submitting }) => {
  const [comment, setComment] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  const handleSubmit = () => {
    if (action === "approve") onApprove(demande.id_demande, comment);
    else if (action === "reject") onReject(demande.id_demande, comment);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">
              Demande #{demande.id_demande}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Choisissez une action ci-dessous
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Demande details */}
        <div className="px-6 py-4 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Demandeur</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 ml-auto">
                {demande.demandeur?.prenom} {demande.demandeur?.nom}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Date</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 ml-auto">
                {new Date(demande.date_demande).toLocaleDateString("fr-FR")}
              </span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Articles demandés
              </p>
              {demande.details.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1"
                >
                  <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Package className="w-3 h-3 text-indigo-400" />
                    {d.nom ?? d.produit_nom ?? `Produit #${d.id_produit}`}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">
                    ×{d.quantite}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MessageSquare className="w-3.5 h-3.5" />
              Commentaire
              {action === "reject" && (
                <span className="text-red-500 ml-1">
                  (obligatoire pour refus)
                </span>
              )}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full text-sm px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none transition"
              rows={3}
              placeholder="Votre commentaire (optionnel pour approbation)..."
            />
          </div>

          {/* Action buttons */}
          {!action ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAction("approve")}
                className="flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                <Check className="w-4 h-4" /> Approuver
              </button>
              <button
                onClick={() => setAction("reject")}
                className="flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                <X className="w-4 h-4" /> Refuser
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                className={`text-xs font-medium text-center py-2 rounded-lg ${action === "approve" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700" : "bg-red-50 dark:bg-red-900/30 text-red-700"}`}
              >
                Confirmer : {action === "approve" ? "✓ Approbation" : "✗ Refus"}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    submitting || (action === "reject" && !comment.trim())
                  }
                  className={`flex items-center justify-center gap-2 py-2.5 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${action === "approve" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Confirmer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Demande Row (expandable) ─────────────────────────────────────────────────

const DemandeRow: React.FC<{
  demande: ApiDemande;
  onAction: (d: ApiDemande) => void;
}> = ({ demande, onAction }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group">
        <td className="px-5 py-3.5">
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            #{demande.id_demande}
          </span>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">
                {demande.demandeur?.prenom?.[0]}
                {demande.demandeur?.nom?.[0]}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {demande.demandeur?.prenom} {demande.demandeur?.nom}
              </p>
              <p className="text-xs text-gray-400">
                {demande.demandeur?.email}
              </p>
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400">
          {new Date(demande.date_demande).toLocaleDateString("fr-FR")}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex flex-wrap gap-1">
            {demande.details.slice(0, 2).map((d, i) => (
              <span
                key={i}
                className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md"
              >
                {d.quantite}× {d.nom ?? d.produit_nom ?? `#${d.id_produit}`}
              </span>
            ))}
            {demande.details.length > 2 && (
              <span className="text-xs text-gray-400">
                +{demande.details.length - 2}
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-3.5">
          <StatusBadge status={demande.statut} />
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {demande.statut === "EN_ATTENTE_DEPT" && (
              <button
                onClick={() => onAction(demande)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <Eye className="w-3 h-3" /> Traiter
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-indigo-50/40 dark:bg-indigo-900/10">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Détail des articles
                </p>
                <div className="space-y-1.5">
                  {demande.details.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Package className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium">
                        {d.nom ?? d.produit_nom ?? `Produit #${d.id_produit}`}
                      </span>
                      <span className="ml-auto font-bold text-gray-900 dark:text-white">
                        ×{d.quantite}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {demande.commentaire && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Commentaire
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic bg-white dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                    "{demande.commentaire}"
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const ChefDeptDashboard: React.FC = () => {
  const [demandes, setDemandes] = useState<ApiDemande[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [produits, setProduits] = useState<ApiProduit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [produitsLoading, setProduitsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("EN_ATTENTE_DEPT");
  const [selectedDemande, setSelected] = useState<ApiDemande | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [demandesRes, statsRes] = await Promise.all([
        api.get("/dept/demandes"),
        api.get("/dept/stats"),
      ]);
      setDemandes(demandesRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors du chargement des données", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load produits separately (only needed when opening the new request modal)
  const fetchProduits = useCallback(async () => {
    if (produits.length > 0) return; // already loaded
    setProduitsLoading(true);
    try {
      const res = await api.get("/produits");
      setProduits(res.data);
    } catch {
      showToast("Erreur lors du chargement des produits", "error");
    } finally {
      setProduitsLoading(false);
    }
  }, [produits.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenNewRequest = () => {
    fetchProduits();
    setShowNewRequest(true);
  };

  const handleApprove = async (id: number, commentaire: string) => {
    setSubmitting(true);
    try {
      await api.post(`/dept/demandes/${id}/approuver`, { commentaire });
      showToast("Demande approuvée avec succès ✓", "success");
      setSelected(null);
      fetchData(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(
        e.response?.data?.message ?? "Erreur lors de l'approbation",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id: number, commentaire: string) => {
    setSubmitting(true);
    try {
      await api.post(`/dept/demandes/${id}/refuser`, { commentaire });
      showToast("Demande refusée", "success");
      setSelected(null);
      fetchData(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e.response?.data?.message ?? "Erreur lors du refus", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreated = (demande: ApiDemande) => {
    setDemandes((prev) => [demande, ...prev]);
    setStats((prev) =>
      prev ? { ...prev, total: (prev.total ?? 0) + 1 } : prev,
    );
    showToast("Demande envoyée au responsable stock ✓", "success");
  };

  // Derived data
  const pending = demandes.filter((d) => d.statut === "EN_ATTENTE_DEPT");
  const filtered =
    filterStatus === "all"
      ? demandes
      : demandes.filter((d) => d.statut === filterStatus);

  const pieData = [
    {
      name: "En attente",
      value: demandes.filter((d) => d.statut === "EN_ATTENTE_DEPT").length,
      color: "#f59e0b",
    },
    {
      name: "Att. Stock",
      value: demandes.filter((d) => d.statut === "EN_ATTENTE_STOCK").length,
      color: "#8b5cf6",
    },
    {
      name: "Validée",
      value: demandes.filter((d) => d.statut === "VALIDEE").length,
      color: "#10b981",
    },
    {
      name: "Livrée",
      value: demandes.filter((d) => d.statut === "LIVREE").length,
      color: "#3b82f6",
    },
    {
      name: "Refusée",
      value: demandes.filter((d) => d.statut.startsWith("REFUSEE")).length,
      color: "#ef4444",
    },
  ].filter((d) => d.value > 0);

  const monthLabels = [
    "Jan",
    "Fév",
    "Mar",
    "Avr",
    "Mai",
    "Jun",
    "Jul",
    "Aoû",
    "Sep",
    "Oct",
    "Nov",
    "Déc",
  ];
  const barData = (stats?.par_mois ?? []).map((m) => ({
    mois: monthLabels[m.mois - 1],
    total: m.total,
  }));

  const FILTER_OPTS = [
    { key: "EN_ATTENTE_DEPT", label: `En attente (${pending.length})` },
    { key: "all", label: `Toutes (${demandes.length})` },
    { key: "EN_ATTENTE_STOCK", label: "Au stock" },
    { key: "REFUSEE_DEPT", label: "Refusées" },
  ];

  return (
    <div className="w-full min-h-screen  p-4 sm:p-6">
      <div className="w-full space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Validation des demandes
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Gérez et validez les demandes de votre département
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* ── Nouvelle demande ── */}
            <button
              onClick={handleOpenNewRequest}
              disabled={produitsLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl transition-colors shadow-sm"
            >
              {produitsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Nouvelle demande
            </button>

            {/* ── Actualiser ── */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${refreshing ? "animate-spin" : ""}`}
              />
              Actualiser
            </button>
          </div>
        </div>

        {/* ── Stat cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="En attente"
            value={stats?.en_attente ?? 0}
            icon={Clock}
            colorClass="bg-amber-500"
            loading={loading}
          />
          <StatCard
            label="Total"
            value={stats?.total ?? 0}
            icon={BarChart3}
            colorClass="bg-indigo-600"
            loading={loading}
          />
          <StatCard
            label="Validées"
            value={stats?.validees ?? stats?.traitees ?? 0}
            icon={Check}
            colorClass="bg-emerald-500"
            loading={loading}
          />
          <StatCard
            label="Refusées dept"
            value={stats?.refusees ?? 0}
            icon={X}
            colorClass="bg-red-500"
            loading={loading}
          />
        </div>

        {/* ── Main grid ──────────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Demandes table */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <h2 className="font-bold text-gray-900 dark:text-white text-sm">
                  Demandes
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setFilterStatus(opt.key)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      filterStatus === opt.key
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <Spinner />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="font-semibold text-gray-700 dark:text-gray-200">
                  Aucune demande
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Aucun résultat pour ce filtre
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      {["#", "Demandeur", "Date", "Articles", "Statut", ""].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {filtered.map((d) => (
                      <DemandeRow
                        key={d.id_demande}
                        demande={d}
                        onAction={setSelected}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Charts sidebar */}
          <div className="space-y-4">
            {/* Pie chart */}
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4">
                Répartition des statuts
              </h3>
              {loading ? (
                <Spinner />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [v, "Demandes"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {pieData.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: s.color }}
                          />
                          <span className="text-gray-500 dark:text-gray-400">
                            {s.name}
                          </span>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {s.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Monthly bar chart */}
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4">
                Demandes par mois
              </h3>
              {loading ? (
                <Spinner />
              ) : barData.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">
                  Pas encore de données
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart
                    data={barData}
                    margin={{ top: 0, right: 0, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(156,163,175,0.2)"
                    />
                    <XAxis
                      dataKey="mois"
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
                    <Tooltip cursor={{ fill: "rgba(99,102,241,0.1)" }} />
                    <Bar
                      dataKey="total"
                      name="Demandes"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Quick pending list */}
            {pending.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-sm text-amber-800 dark:text-amber-300">
                    {pending.length} demande{pending.length > 1 ? "s" : ""} à
                    traiter
                  </h3>
                </div>
                <div className="space-y-2">
                  {pending.slice(0, 3).map((d) => (
                    <button
                      key={d.id_demande}
                      onClick={() => {
                        setFilterStatus("EN_ATTENTE_DEPT");
                        setSelected(d);
                      }}
                      className="w-full text-left flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-amber-100 dark:border-amber-800/40 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-amber-600">
                          {d.demandeur?.prenom?.[0]}
                          {d.demandeur?.nom?.[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {d.demandeur?.prenom} {d.demandeur?.nom}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          #{d.id_demande} · {d.details.length} article(s)
                        </p>
                      </div>
                    </button>
                  ))}
                  {pending.length > 3 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center pt-1">
                      +{pending.length - 3} autre(s)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {showNewRequest && (
        <NewRequestModal
          produits={produits}
          onClose={() => setShowNewRequest(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedDemande && (
        <ActionModal
          demande={selectedDemande}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          submitting={submitting}
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

export default ChefDeptDashboard;
