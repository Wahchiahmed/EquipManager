import React, { useState, useEffect, useCallback } from "react";
import {
  Check,
  X,
  Package,
  User,
  Calendar,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Search,
  Filter,
  Building2,
  Clock,
  ArrowUpRight,
  MoreHorizontal,
} from "lucide-react";
import axios from "axios";

// ─── API ──────────────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Detail {
  id_detail: number;
  id_produit: number;
  produit?: { nom?: string; nom_produit?: string };
  nom?: string;
  quantite: number;
  statut?: "en_attente" | "accepte" | "refuse";
  commentaire_stock?: string | null;
}
interface Demande {
  id_demande: number;
  date_demande: string;
  statut: string;
  commentaire: string | null;
  demandeur?: {
    prenom: string;
    nom: string;
    email?: string;
    departement?: { nom: string } | null;
  } | null;
  demandeur_nom?: string;
  demandeur_prenom?: string;
  departement_nom?: string;
  responsable_dept?: string | null;
  responsable_stock?: string | null;
  date_validation_dept?: string | null;
  date_validation_stock?: string | null;
  details: Detail[];
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> =
  {
    EN_ATTENTE_DEPT: {
      label: "En attente dept",
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
      dot: "bg-amber-400",
    },
    EN_ATTENTE_STOCK: {
      label: "Au stock",
      cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
      dot: "bg-violet-400",
    },
    VALIDEE: {
      label: "Validée",
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
      dot: "bg-emerald-400",
    },
    PARTIELLEMENT_VALIDEE: {
      label: "Partielle",
      cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
      dot: "bg-blue-400",
    },
    LIVREE: {
      label: "Livrée",
      cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
      dot: "bg-sky-400",
    },
    REFUSEE_DEPT: {
      label: "Refusée dept",
      cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
      dot: "bg-red-400",
    },
    REFUSEE_STOCK: {
      label: "Refusée stock",
      cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
      dot: "bg-red-400",
    },
  };

const DETAIL_STATUT_CFG: Record<string, { label: string; cls: string }> = {
  en_attente: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  accepte: { label: "Accepté", cls: "bg-emerald-100 text-emerald-700" },
  refuse: { label: "Refusé", cls: "bg-red-100 text-red-700" },
};

const FILTER_STATUTS = [
  { key: "all", label: "Toutes" },
  { key: "EN_ATTENTE_DEPT", label: "En attente" },
  { key: "EN_ATTENTE_STOCK", label: "Au stock" },
  { key: "VALIDEE", label: "Validées" },
  { key: "PARTIELLEMENT_VALIDEE", label: "Partielles" },
  { key: "LIVREE", label: "Livrées" },
  { key: "REFUSEE_DEPT", label: "Refusées" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const getProduitNom = (d: Detail) =>
  d.produit?.nom ??
  d.produit?.nom_produit ??
  d.nom ??
  `Produit #${d.id_produit}`;
const getDemandeurNom = (d: Demande) =>
  d.demandeur
    ? `${d.demandeur.prenom} ${d.demandeur.nom}`
    : `${d.demandeur_prenom ?? ""} ${d.demandeur_nom ?? ""}`.trim() || "—";
const getInitials = (d: Demande) => {
  const p = d.demandeur?.prenom ?? d.demandeur_prenom ?? "";
  const n = d.demandeur?.nom ?? d.demandeur_nom ?? "";
  return `${p[0] ?? ""}${n[0] ?? ""}`.toUpperCase();
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const c = STATUS_CFG[status] ?? {
    label: status,
    cls: "bg-gray-100 text-gray-700",
    dot: "bg-gray-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide ${c.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast: React.FC<{
  msg: string;
  type: "success" | "error";
  onClose: () => void;
}> = ({ msg, type, onClose }) => (
  <div
    className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white text-sm font-semibold ${type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
  >
    {type === "success" ? (
      <CheckCircle2 className="w-5 h-5 shrink-0" />
    ) : (
      <AlertTriangle className="w-5 h-5 shrink-0" />
    )}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
      <X className="w-4 h-4" />
    </button>
  </div>
);

// ─── Action Modal ─────────────────────────────────────────────────────────────
const ActionModal: React.FC<{
  demande: Demande;
  onClose: () => void;
  onApprove: (id: number, comment: string) => Promise<void>;
  onReject: (id: number, comment: string) => Promise<void>;
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              Traiter demande #{demande.id_demande}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {getDemandeurNom(demande)} · {fmt(demande.date_demande)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-2">
            {demande.details.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Package className="w-3 h-3 text-indigo-400" />
                  {getProduitNom(d)}
                </span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  ×{d.quantite}
                </span>
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Commentaire
              {action === "reject" && (
                <span className="text-red-500 ml-1">* obligatoire</span>
              )}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Votre commentaire..."
              className="w-full text-sm px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none"
            />
          </div>
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
            <div className="space-y-3">
              <div
                className={`text-xs font-semibold text-center py-2 rounded-lg ${action === "approve" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700" : "bg-red-50 dark:bg-red-900/30 text-red-700"}`}
              >
                {action === "approve" ? "✓ Approbation" : "✗ Refus"}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-sm"
                >
                  Retour
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    submitting || (action === "reject" && !comment.trim())
                  }
                  className={`flex items-center justify-center gap-2 py-2.5 text-white rounded-xl font-semibold text-sm disabled:opacity-50 ${action === "approve" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}{" "}
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
  demande: Demande;
  onAction: (d: Demande) => void;
}> = ({ demande, onAction }) => {
  const [expanded, setExpanded] = useState(false);
  const nom = getDemandeurNom(demande);
  const initials = getInitials(demande);
  const dept =
    demande.demandeur?.departement?.nom ?? demande.departement_nom ?? "—";
  const isPending = demande.statut === "EN_ATTENTE_DEPT";

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group">
        <td className="px-5 py-3.5">
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
            #{demande.id_demande}
          </span>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">
                {initials || "??"}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {nom}
              </p>
              <p className="text-xs text-gray-400">{dept}</p>
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400">
          {fmt(demande.date_demande)}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex flex-wrap gap-1">
            {demande.details.slice(0, 2).map((d, i) => (
              <span
                key={i}
                className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md"
              >
                {d.quantite}× {getProduitNom(d)}
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
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {isPending && (
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

      {/* Expanded row */}
      {expanded && (
        <tr className="bg-indigo-50/30 dark:bg-indigo-900/10">
          <td colSpan={6} className="px-6 py-5">
            <div className="grid sm:grid-cols-3 gap-5 text-xs">
              {/* Articles */}
              <div className="sm:col-span-2">
                <p className="font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Détail des articles
                </p>
                <div className="space-y-1.5">
                  {demande.details.map((det) => {
                    const dcfg = DETAIL_STATUT_CFG[
                      det.statut ?? "en_attente"
                    ] ?? {
                      label: det.statut,
                      cls: "bg-gray-100 text-gray-700",
                    };
                    return (
                      <div
                        key={det.id_detail}
                        className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <Package className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="flex-1 font-medium text-gray-800 dark:text-gray-200">
                          {getProduitNom(det)}
                        </span>
                        <span className="text-gray-500">×{det.quantite}</span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${dcfg.cls}`}
                        >
                          {dcfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Workflow */}
              <div>
                <p className="font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Workflow
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Soumise le</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {fmt(demande.date_demande)}
                    </span>
                  </div>
                  {demande.responsable_dept && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dept</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {demande.responsable_dept}
                      </span>
                    </div>
                  )}
                  {demande.date_validation_dept && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Validé le</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {fmt(demande.date_validation_dept)}
                      </span>
                    </div>
                  )}
                  {demande.responsable_stock && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Stock</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {demande.responsable_stock}
                      </span>
                    </div>
                  )}
                </div>
                {demande.commentaire && (
                  <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 italic">
                      "{demande.commentaire}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ManagerAllRequests: React.FC = () => {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [selected, setSelected] = useState<Demande | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
      const r = await api.get("/dept/demandes");
      setDemandes(r.data);
    } catch {
      showToast("Erreur lors du chargement", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id: number, commentaire: string) => {
    setSubmitting(true);
    try {
      await api.post(`/dept/demandes/${id}/approuver`, { commentaire });
      showToast("Demande approuvée ✓", "success");
      setSelected(null);
      fetchData(true);
    } catch (err: any) {
      showToast(err.response?.data?.message ?? "Erreur", "error");
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
    } catch (err: any) {
      showToast(err.response?.data?.message ?? "Erreur", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = demandes.filter((d) => {
    const nom = getDemandeurNom(d);
    const matchSearch = `${nom} #${d.id_demande}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchStatut =
      filterStatut === "all" ? true : d.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const pendingCount = demandes.filter(
    (d) => d.statut === "EN_ATTENTE_DEPT",
  ).length;

  return (
    <div className="w-full min-h-screen  p-4 sm:p-6">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Toutes les demandes
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {demandes.length} demande{demandes.length > 1 ? "s" : ""} dans
              votre département
              {pendingCount > 0 && (
                <span className="ml-2 font-semibold text-amber-600">
                  · {pendingCount} en attente
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 text-gray-500 ${refreshing ? "animate-spin" : ""}`}
            />
            Actualiser
          </button>
        </div>

        {/* Filters toolbar */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 w-44"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {FILTER_STATUTS.map((opt) => {
              const count =
                opt.key === "all"
                  ? demandes.length
                  : demandes.filter((d) => d.statut === opt.key).length;
              return (
                <button
                  key={opt.key}
                  onClick={() => setFilterStatut(opt.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    filterStatut === opt.key
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {opt.label}
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filterStatut === opt.key ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-4">
                <Filter className="w-6 h-6 text-gray-400" />
              </div>
              <p className="font-semibold text-gray-700 dark:text-gray-200">
                Aucune demande trouvée
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Essayez un autre filtre ou terme de recherche
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    {[
                      "#",
                      "Demandeur",
                      "Date",
                      "Articles",
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

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
              {filtered.length} résultat{filtered.length > 1 ? "s" : ""} affiché
              {filtered.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <ActionModal
          demande={selected}
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

export default ManagerAllRequests;
