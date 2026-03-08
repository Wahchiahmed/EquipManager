// src/pages/dashboards/StockDashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Check, X, Plus, AlertTriangle, Package, ArrowUp, ArrowDown,
  RefreshCw, CheckCircle2, Truck, Eye, MessageSquare, CheckCheck,
  MinusCircle, Layers, Loader2, Lock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import api from "@/lib/api";
import ProductLotsModal from "./../Admin/ProductLotsModal";
import LotConsumptionDetails from "./../Admin/LotConsumptionDetails";

// ─── Types ─────────────────────────────────────────────────────────────────────

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

interface DetailLigne {
  id_detail: number;
  id_produit: number;
  nom: string | null;
  reference: string | null;
  quantite: number;
  quantite_dispo: number;
  statut: "en_attente" | "accepte" | "refuse";
  commentaire_stock: string | null;
  // true = ce gestionnaire peut traiter cette ligne
  // false/null = ligne gérée par un autre gestionnaire
  ma_responsabilite: boolean | null;
}

interface Demande {
  id_demande: number;
  date_demande: string;
  statut: string;
  commentaire: string | null;
  demandeur: {
    id: number;
    nom: string;
    prenom: string;
    departement: { nom: string } | null;
  } | null;
  details: DetailLigne[];
  date_validation_dept: string | null;
  date_validation_stock: string | null;
  responsable_dept: string | null;
  responsable_stock: string | null;
}

interface StatsData {
  a_valider: number;
  total_produits: number;
  alertes: number;
  total_mouvements: number;
  par_mois: { mois: number; entrees: number; sorties: number }[];
}

interface LigneDecision {
  id_detail: number;
  statut: "en_attente" | "accepte" | "refuse";
  commentaire_stock: string;
  ma_responsabilite: boolean | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const fmt    = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

const STATUTS_AVEC_LOTS = ["VALIDEE", "PARTIELLEMENT_VALIDEE", "LIVREE", "REFUSEE_STOCK"];

const DEMANDE_STATUS: Record<string, { label: string; cls: string }> = {
  EN_ATTENTE_DEPT:       { label: "Att. Dept",  cls: "bg-amber-100 text-amber-800"  },
  EN_ATTENTE_STOCK:      { label: "Att. Stock", cls: "bg-purple-100 text-purple-800" },
  VALIDEE:               { label: "Validée",    cls: "bg-green-100 text-green-800"   },
  PARTIELLEMENT_VALIDEE: { label: "Partielle",  cls: "bg-blue-100 text-blue-800"     },
  LIVREE:                { label: "Livrée",     cls: "bg-teal-100 text-teal-800"     },
  REFUSEE_STOCK:         { label: "Ref. Stock", cls: "bg-red-100 text-red-800"       },
  REFUSEE_DEPT:          { label: "Ref. Dept",  cls: "bg-red-100 text-red-800"       },
};

const LIGNE_STATUS: Record<string, { label: string; rowCls: string; dotCls: string }> = {
  en_attente: { label: "En attente", rowCls: "border-amber-200 bg-amber-50/40",  dotCls: "bg-amber-400" },
  accepte:    { label: "Accepté",   rowCls: "border-green-200 bg-green-50/60",  dotCls: "bg-green-500" },
  refuse:     { label: "Refusé",    rowCls: "border-red-200   bg-red-50/60",    dotCls: "bg-red-500"   },
};

// ─── Shared tiny components ────────────────────────────────────────────────────

const DemandeBadge: React.FC<{ status: string }> = ({ status }) => {
  const c = DEMANDE_STATUS[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${c.cls}`}>{c.label}</span>;
};

const LigneBadge: React.FC<{ statut: string }> = ({ statut }) => {
  const c = LIGNE_STATUS[statut];
  if (!c) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold">
      <span className={`w-1.5 h-1.5 rounded-full ${c.dotCls}`} />
      {c.label}
    </span>
  );
};

const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const Toast: React.FC<{ msg: string; type: "success" | "error"; onClose: () => void }> = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-semibold ${type === "success" ? "bg-green-600" : "bg-red-600"}`}>
    {type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
    <span>{msg}</span>
    <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
  </div>
);

// ─── Per-line Decision Modal ───────────────────────────────────────────────────

const DemandeModal: React.FC<{
  demande: Demande;
  onClose: () => void;
  onUpdated: (d: Demande) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}> = ({ demande, onClose, onUpdated, showToast }) => {
  const canEdit   = demande.statut === "EN_ATTENTE_STOCK";
  const canLivrer = demande.statut === "VALIDEE" || demande.statut === "PARTIELLEMENT_VALIDEE";
  const hasLots   = STATUTS_AVEC_LOTS.includes(demande.statut);

  // Séparer mes lignes / lignes des autres gestionnaires
  const mesLignes    = demande.details.filter(d => d.ma_responsabilite !== false);
  const autresLignes = demande.details.filter(d => d.ma_responsabilite === false);

  const [decisions, setDecisions] = useState<LigneDecision[]>(() =>
    demande.details.map(d => ({
      id_detail:        d.id_detail,
      statut:           d.statut,
      commentaire_stock: d.commentaire_stock ?? "",
      ma_responsabilite: d.ma_responsabilite,
    }))
  );
  const [submitting, setSubmitting]       = useState(false);
  const [confirmLivrer, setConfirmLivrer] = useState(false);

  const mesDecisions     = decisions.filter(d => d.ma_responsabilite !== false);
  const pendingCount     = mesDecisions.filter(d => d.statut === "en_attente").length;
  const accepteCount     = mesDecisions.filter(d => d.statut === "accepte").length;
  const refuseCount      = mesDecisions.filter(d => d.statut === "refuse").length;
  const allDecided       = pendingCount === 0;
  const missingMotif     = mesDecisions.some(d => d.statut === "refuse" && !d.commentaire_stock.trim());

  const setLigneStatut  = (id: number, statut: "accepte" | "refuse") =>
    setDecisions(prev => prev.map(d => d.id_detail === id ? { ...d, statut } : d));
  const setLigneComment = (id: number, val: string) =>
    setDecisions(prev => prev.map(d => d.id_detail === id ? { ...d, commentaire_stock: val } : d));

  // Accepter/refuser uniquement MES lignes
  const acceptAll = () => setDecisions(prev => prev.map(d => d.ma_responsabilite !== false ? { ...d, statut: "accepte" as const } : d));
  const refuseAll = () => setDecisions(prev => prev.map(d => d.ma_responsabilite !== false ? { ...d, statut: "refuse" as const } : d));

  const handleSubmitLignes = async () => {
    if (!allDecided) { showToast("Traitez toutes vos lignes avant de confirmer.", "error"); return; }
    if (missingMotif) { showToast("Ajoutez un motif pour chaque ligne refusée.", "error"); return; }
    setSubmitting(true);
    try {
      // N'envoyer que les lignes qui me sont assignées
      const lignesAEnvoyer = decisions
        .filter(d => d.ma_responsabilite !== false)
        .map(d => ({ id_detail: d.id_detail, statut: d.statut, commentaire_stock: d.commentaire_stock || undefined }));

      const res = await api.post(`/stock/demandes/${demande.id_demande}/valider-lignes`, { lignes: lignesAEnvoyer });
      onUpdated(res.data.demande as Demande);
      const msg = refuseCount === 0
        ? `✓ ${accepteCount} ligne(s) acceptée(s)`
        : accepteCount === 0 ? "Lignes refusées"
        : `${accepteCount} acceptée(s), ${refuseCount} refusée(s)`;
      showToast(msg, "success");
      onClose();
    } catch (e: any) {
      showToast(e.response?.data?.message ?? "Erreur lors de la validation", "error");
    } finally { setSubmitting(false); }
  };

  const handleLivrer = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/stock/demandes/${demande.id_demande}/livrer`);
      onUpdated(res.data.demande as Demande);
      showToast("Demande marquée comme livrée 🚚");
      onClose();
    } catch (e: any) {
      showToast(e.response?.data?.message ?? "Erreur", "error");
    } finally { setSubmitting(false); }
  };

  const summaryLabel = !allDecided
    ? `${pendingCount} ligne(s) à traiter`
    : refuseCount === 0  ? "Toutes vos lignes seront acceptées"
    : accepteCount === 0 ? "Toutes vos lignes seront refusées"
    :                      `${accepteCount} acceptée(s) + ${refuseCount} refusée(s)`;
  const summaryColor = !allDecided ? "bg-amber-50 border-amber-200 text-amber-800"
    : refuseCount === 0  ? "bg-green-50  border-green-200  text-green-800"
    : accepteCount === 0 ? "bg-red-50    border-red-200    text-red-800"
    :                      "bg-blue-50   border-blue-200   text-blue-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-foreground text-base">Demande #{demande.id_demande}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {demande.demandeur?.prenom} {demande.demandeur?.nom}
              {demande.demandeur?.departement && ` · ${demande.demandeur.departement.nom}`}
              {` · reçue le ${fmt(demande.date_demande)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DemandeBadge status={demande.statut} />
            <button onClick={onClose} className="ml-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Quick actions — seulement si j'ai des lignes à traiter */}
          {canEdit && mesLignes.some(d => d.statut === "en_attente") && (
            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs text-muted-foreground mr-auto font-medium">Mes lignes :</span>
              <button onClick={acceptAll} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
                <CheckCheck className="w-3.5 h-3.5" /> Tout accepter
              </button>
              <button onClick={refuseAll} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors">
                <MinusCircle className="w-3.5 h-3.5" /> Tout refuser
              </button>
            </div>
          )}

          {/* MES lignes (ma responsabilité) */}
          {demande.details.map(det => {
            const dec     = decisions.find(d => d.id_detail === det.id_detail)!;
            const isMine  = det.ma_responsabilite !== false;
            const stockOk = det.quantite_dispo >= det.quantite;
            const cfg     = LIGNE_STATUS[dec.statut];

            // Ligne d'un autre gestionnaire — affichage lecture seule grisé
            if (!isMine) {
              return (
                <div key={det.id_detail} className="rounded-xl border border-border bg-muted/30 p-3 opacity-60">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{det.nom}</span>
                        {det.reference && <span className="text-[10px] font-mono text-muted-foreground border border-border px-1 rounded">{det.reference}</span>}
                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-full">Autre gestionnaire</span>
                        <LigneBadge statut={det.statut} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Demandé : <strong>{det.quantite}</strong></p>
                    </div>
                  </div>
                </div>
              );
            }

            // Ma ligne — éditable
            return (
              <div key={det.id_detail} className={`rounded-xl border p-3 space-y-2.5 transition-all duration-150 ${cfg.rowCls}`}>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{det.nom}</span>
                      {det.reference && <span className="text-[10px] font-mono text-muted-foreground border border-border px-1 rounded">{det.reference}</span>}
                      {!canEdit && <LigneBadge statut={det.statut} />}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs">
                      <span className="text-muted-foreground">Demandé : <strong className="text-foreground">{det.quantite}</strong></span>
                      <span className={`font-semibold flex items-center gap-1 ${stockOk ? "text-green-600" : "text-red-500"}`}>
                        Dispo : {det.quantite_dispo}
                        {!stockOk && <AlertTriangle className="w-3 h-3" />}
                      </span>
                    </div>
                    {!canEdit && det.commentaire_stock && (
                      <p className="mt-1 text-[11px] italic text-muted-foreground">"{det.commentaire_stock}"</p>
                    )}
                    {!canEdit && det.statut === "accepte" && hasLots && (
                      <LotConsumptionDetails detailDemandeId={det.id_detail} endpointPrefix="/stock" compact={true} defaultOpen={false} />
                    )}
                  </div>
                  {canEdit && <div className="shrink-0"><LigneBadge statut={dec.statut} /></div>}
                </div>

                {canEdit && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button onClick={() => setLigneStatut(det.id_detail, "accepte")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${dec.statut === "accepte" ? "bg-green-500 text-white border-green-500 shadow-sm" : "border-border hover:border-green-400 hover:bg-green-50 hover:text-green-700 text-muted-foreground"}`}>
                        <Check className="w-3.5 h-3.5" /> Accepter
                      </button>
                      <button onClick={() => setLigneStatut(det.id_detail, "refuse")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${dec.statut === "refuse" ? "bg-red-500 text-white border-red-500 shadow-sm" : "border-border hover:border-red-400 hover:bg-red-50 hover:text-red-700 text-muted-foreground"}`}>
                        <X className="w-3.5 h-3.5" /> Refuser
                      </button>
                    </div>
                    {dec.statut === "refuse" && (
                      <input type="text" autoFocus placeholder="Motif du refus (obligatoire)…" value={dec.commentaire_stock}
                        onChange={e => setLigneComment(det.id_detail, e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200 bg-white placeholder:text-muted-foreground" />
                    )}
                    {dec.statut === "accepte" && (
                      <input type="text" placeholder="Commentaire optionnel…" value={dec.commentaire_stock}
                        onChange={e => setLigneComment(det.id_detail, e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white placeholder:text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {canEdit && mesLignes.length > 0 && (
            <div className={`text-xs px-3 py-2.5 rounded-lg border font-medium flex items-center gap-2 ${summaryColor}`}>
              <span>{summaryLabel}</span>
              {autresLignes.length > 0 && (
                <span className="ml-auto text-muted-foreground font-normal italic">
                  + {autresLignes.length} ligne(s) gérée(s) par d'autres gestionnaires
                </span>
              )}
            </div>
          )}

          {!canEdit && hasLots && (
            <div className="pt-1 border-t border-border/60">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 mt-3">Résumé FIFO — consommation globale</p>
              <LotConsumptionDetails demandeId={demande.id_demande} endpointPrefix="/stock" compact={false} defaultOpen={false} />
            </div>
          )}

          {canLivrer && confirmLivrer && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm text-teal-800 font-medium flex items-center gap-2">
              <Truck className="w-4 h-4 shrink-0" />
              Confirmer la livraison ? Le demandeur recevra les articles acceptés.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 space-y-2">
          {canEdit && (
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">Annuler</button>
              <button onClick={handleSubmitLignes} disabled={submitting || !allDecided || missingMotif}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors">
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {submitting ? "Enregistrement…" : "Valider mes lignes"}
              </button>
            </div>
          )}
          {canLivrer && !confirmLivrer && (
            <button onClick={() => setConfirmLivrer(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors">
              <Truck className="w-4 h-4" /> Marquer comme livrée
            </button>
          )}
          {canLivrer && confirmLivrer && (
            <div className="flex gap-3">
              <button onClick={() => setConfirmLivrer(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted">← Retour</button>
              <button onClick={handleLivrer} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 disabled:opacity-50">
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmer la livraison
              </button>
            </div>
          )}
          {!canEdit && !canLivrer && (
            <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Create Product Modal ──────────────────────────────────────────────────────

const CreateProduitModal: React.FC<{
  categories: CategorieOption[];
  onClose: () => void;
  onCreated: (p: Produit) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}> = ({ categories, onClose, onCreated, showToast }) => {
  const [form, setForm] = useState({ nom_produit: "", description: "", reference: "", code_barre: "", quantite: "0", seuil_alerte: "5", id_categorie: "" });
  const [loading, setLoading] = useState(false);

  const set = (f: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/produits", { ...form, quantite: Number(form.quantite), seuil_alerte: Number(form.seuil_alerte), id_categorie: Number(form.id_categorie), is_active: true });
      const p   = res.data;
      onCreated({ id: p.id_produit, nom: p.nom_produit, description: p.description, reference: p.reference, quantite: p.quantite, seuil_alerte: p.seuil_alerte, categorie_nom: p.categorie_nom, en_alerte: p.en_alerte });
      showToast("Produit créé avec succès ✓", "success");
      onClose();
    } catch (err: any) {
      const m = err.response?.data?.message ?? err.response?.data?.errors;
      showToast(typeof m === "string" ? m : JSON.stringify(m ?? "Une erreur est survenue."), "error");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-bold text-foreground">Nouveau produit</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Actif par défaut · lot initial créé automatiquement</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {[["nom_produit","Nom du produit *","text",true],["reference","Référence","text",false],["code_barre","Code barre","text",false]].map(([f,l,t,req]) => (
            <div key={f as string}>
              <label className="block text-xs font-medium text-foreground mb-1.5">{l as string}</label>
              <input type={t as string} required={req as boolean} value={form[f as keyof typeof form]} onChange={set(f as keyof typeof form)}
                className="w-full px-3 py-2 text-sm bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Quantité initiale *</label>
              <input type="number" required min={0} value={form.quantite} onChange={set("quantite")} className="w-full px-3 py-2 text-sm bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Seuil d'alerte *</label>
              <input type="number" required min={0} value={form.seuil_alerte} onChange={set("seuil_alerte")} className="w-full px-3 py-2 text-sm bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Catégorie *</label>
            <select required value={form.id_categorie} onChange={set("id_categorie")} className="w-full px-3 py-2 text-sm bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none">
              <option value="">Choisir…</option>
              {categories.map(c => <option key={c.id_categorie} value={c.id_categorie}>{c.nom_categorie}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? "Création..." : "Créer le produit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Stock Dashboard ───────────────────────────────────────────────────────────

const StockDashboard: React.FC = () => {
  const [tab, setTab]               = useState<"requests" | "products" | "movements">("requests");
  const [stats, setStats]           = useState<StatsData | null>(null);
  const [demandes, setDemandes]     = useState<Demande[]>([]);
  const [produits, setProduits]     = useState<Produit[]>([]);
  const [categories, setCategories] = useState<CategorieOption[]>([]);
  const [mouvements, setMouvements] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [showAddStock, setShowAddStock]     = useState(false);
  const [selProduct, setSelProduct]         = useState("");
  const [stockQty, setStockQty]             = useState("");
  const [stockNote, setStockNote]           = useState("");
  const [addSubmitting, setAddSubmitting]   = useState(false);
  const [showCreateProduit, setShowCreate]  = useState(false);
  const [lotsModal, setLotsModal]           = useState<{ id: number; nom: string } | null>(null);
  const [activeDemande, setActiveDemande]   = useState<Demande | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [s, d, p, m, fd] = await Promise.all([
        api.get("/stock/stats"),
        api.get("/stock/demandes"),       // filtrées par mes produits
        api.get("/stock/produits"),       // seulement mes produits
        api.get("/stock/mouvements"),
        api.get("/produits/form-data"),
      ]);
      setStats(s.data);
      setDemandes(d.data);
      setProduits(p.data);
      setMouvements(m.data?.data ?? m.data);
      setCategories(fd.data.categories ?? []);
    } catch {
      showToast("Erreur de chargement", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDemandeUpdated = (updated: Demande) => {
    setDemandes(prev => prev.map(d => d.id_demande === updated.id_demande ? updated : d));
    fetchAll(true);
  };

  const handleAddStock = async () => {
    if (!selProduct || !stockQty) return;
    setAddSubmitting(true);
    try {
      await api.post("/stock/entree", { id_produit: Number(selProduct), quantite: Number(stockQty), note: stockNote || undefined });
      showToast("Entrée de stock enregistrée ✓");
      setShowAddStock(false);
      setSelProduct(""); setStockQty(""); setStockNote("");
      fetchAll(true);
    } catch (e: any) {
      showToast(e.response?.data?.message ?? "Erreur lors de l'entrée", "error");
    } finally { setAddSubmitting(false); }
  };

  const pending   = demandes.filter(d => d.statut === "EN_ATTENTE_STOCK");
  const toDeliver = demandes.filter(d => d.statut === "VALIDEE" || d.statut === "PARTIELLEMENT_VALIDEE");
  const alerts    = produits.filter(p => p.en_alerte);
  const selProd   = produits.find(p => p.id === Number(selProduct));

  const stockChartData = produits.slice(0, 8).map(p => ({ name: p.nom.slice(0, 12), stock: p.quantite, alerte: p.seuil_alerte }));
  const chartData      = (stats?.par_mois ?? []).map(m => ({ mois: MONTHS[m.mois - 1], entrees: m.entrees, sorties: m.sorties }));

  const tabDef = [
    { key: "requests"  as const, label: `Demandes à valider (${pending.length})` },
    { key: "products"  as const, label: `Mes produits (${produits.length})` },
    { key: "movements" as const, label: "Mouvements" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion du stock</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Vos produits assignés · validez les demandes ligne par ligne
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchAll(true)} disabled={refreshing}
            className="p-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nouveau produit
          </button>
          <button onClick={() => setShowAddStock(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Entrée de stock
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "À valider",      value: stats?.a_valider        ?? 0, color: "bg-purple-500", pulse: (stats?.a_valider ?? 0) > 0 },
          { label: "Mes produits",   value: stats?.total_produits   ?? 0, color: "bg-primary",    pulse: false },
          { label: "Alertes stock",  value: stats?.alertes          ?? 0, color: "bg-amber-500",  pulse: (stats?.alertes ?? 0) > 0 },
          { label: "Mouvements",     value: stats?.total_mouvements ?? 0, color: "bg-green-500",  pulse: false },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{s.label}</p>
                {loading ? <div className="h-8 w-14 bg-muted animate-pulse rounded mt-1" /> : <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>}
              </div>
              {s.pulse && !loading && s.value > 0 && (
                <span className="relative flex h-2.5 w-2.5 mt-1">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${s.color} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${s.color}`} />
                </span>
              )}
            </div>
            <div className={`w-1 h-6 ${s.color} rounded-full mt-3`} />
          </div>
        ))}
      </div>

      {/* No products assigned banner */}
      {!loading && produits.length === 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Aucun produit assigné</p>
            <p className="text-xs text-amber-700 mt-0.5">Contactez un administrateur pour vous assigner des produits à gérer.</p>
          </div>
        </div>
      )}

      {/* Alert banner */}
      {!loading && alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-sm text-amber-800">{alerts.length} de vos produits sous le seuil d'alerte</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map(p => (
              <div key={p.id} className="bg-white rounded-lg px-3 py-2 border border-amber-200 text-xs">
                <span className="font-semibold text-foreground">{p.nom}</span>
                <span className="text-red-600 ml-2 font-bold">{p.quantite} u.</span>
                <span className="text-muted-foreground"> / {p.seuil_alerte} min</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {tabDef.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════ TAB: REQUESTS ════════ */}
      {tab === "requests" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">
                Demandes à traiter
                {pending.length > 0 && <span className="ml-2 text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">{pending.length}</span>}
              </h2>
            </div>
            {loading ? <Spinner /> : pending.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune demande en attente pour vos produits</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pending.map(d => {
                  // Lignes qui me concernent
                  const mesLignes    = d.details.filter(det => det.ma_responsabilite !== false);
                  const autresLignes = d.details.filter(det => det.ma_responsabilite === false);
                  const insufficient = mesLignes.some(det => det.quantite_dispo < det.quantite);

                  return (
                    <div key={d.id_demande} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Package className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-bold text-foreground">Demande #{d.id_demande}</span>
                            <DemandeBadge status={d.statut} />
                            {insufficient && <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Stock insuffisant</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {d.demandeur?.prenom} {d.demandeur?.nom}
                            {d.demandeur?.departement && ` · ${d.demandeur.departement.nom}`} · {fmt(d.date_demande)}
                          </p>
                          {/* Mes lignes */}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {mesLignes.map((det, i) => (
                              <span key={i} className={`text-xs px-2 py-1 rounded-md font-medium border ${det.statut === "accepte" ? "bg-green-50 border-green-200 text-green-700" : det.statut === "refuse" ? "bg-red-50 border-red-200 text-red-700 line-through" : det.quantite_dispo < det.quantite ? "bg-red-50 border-red-200 text-red-700" : "bg-secondary border-border"}`}>
                                {det.quantite}× {det.nom}
                                {det.quantite_dispo < det.quantite && ` (${det.quantite_dispo} dispo)`}
                              </span>
                            ))}
                            {autresLignes.length > 0 && (
                              <span className="text-xs px-2 py-1 rounded-md font-medium border bg-muted border-border text-muted-foreground italic">
                                +{autresLignes.length} autre(s) gestionnaire(s)
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => setActiveDemande(d)}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors">
                          <Eye className="w-3 h-3" /> Traiter
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {toDeliver.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <h2 className="font-semibold text-foreground">À livrer</h2>
                <span className="text-xs bg-teal-100 text-teal-700 font-bold px-2 py-0.5 rounded-full">{toDeliver.length}</span>
              </div>
              <div className="divide-y divide-border">
                {toDeliver.map(d => (
                  <div key={d.id_demande} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">Demande #{d.id_demande}</span>
                          <DemandeBadge status={d.statut} />
                        </div>
                        <p className="text-xs text-muted-foreground">{d.demandeur?.prenom} {d.demandeur?.nom} · {fmt(d.date_demande)}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {d.details.filter(det => det.statut === "accepte").map((det, i) => (
                            <span key={i} className="text-xs bg-teal-50 border border-teal-200 text-teal-800 px-2 py-1 rounded-md font-medium">{det.quantite}× {det.nom}</span>
                          ))}
                          {d.details.filter(det => det.statut === "refuse").length > 0 && (
                            <span className="text-xs bg-red-50 border border-red-200 text-red-600 px-2 py-1 rounded-md font-medium">+{d.details.filter(det => det.statut === "refuse").length} refusée(s)</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => setActiveDemande(d)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">
                        <Truck className="w-3 h-3" /> Livrer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════ TAB: PRODUCTS ════════ */}
      {tab === "products" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">
                Mes produits assignés <span className="text-xs font-normal text-muted-foreground ml-1">({produits.length})</span>
              </h2>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nouveau produit
              </button>
            </div>
            {loading ? <Spinner /> : produits.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Aucun produit assigné</p>
                <p className="text-xs text-muted-foreground mt-1">Un administrateur doit vous assigner des produits.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      {["Produit","Référence","Catégorie","Quantité","Seuil","Statut","Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {produits.map(p => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">{p.nom}</p>
                          {p.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.description}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.reference ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-foreground">{p.categorie_nom ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${p.en_alerte ? "text-red-500" : "text-green-600"}`}>{p.quantite}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.seuil_alerte}</td>
                        <td className="px-4 py-3">
                          {p.en_alerte
                            ? <span className="text-xs font-semibold text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Alerte</span>
                            : <span className="text-xs font-semibold text-green-600">OK</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setLotsModal({ id: p.id, nom: p.nom })}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-muted hover:bg-border border border-border transition-colors" title="Voir les lots FIFO">
                              <Layers className="w-3.5 h-3.5" /> Lots
                            </button>
                            <button onClick={() => { setSelProduct(String(p.id)); setShowAddStock(true); }}
                              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${p.en_alerte ? "bg-green-500 hover:bg-green-600 text-white" : "bg-muted hover:bg-border border border-border"}`}>
                              <ArrowUp className="w-3 h-3" /> Ajouter
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {produits.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-sm text-foreground mb-4">Niveaux de stock — mes produits</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stockChartData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="stock"  fill="hsl(var(--primary))" radius={[4,4,0,0]} name="Stock actuel" />
                  <Bar dataKey="alerte" fill="#f59e0b"              radius={[4,4,0,0]} name="Seuil alerte" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ════════ TAB: MOVEMENTS ════════ */}
      {tab === "movements" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm text-foreground mb-4">Entrées / Sorties par mois — mes produits</h3>
            {chartData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Pas encore de données</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mois" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="entrees" name="Entrées" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981" }} />
                  <Line type="monotone" dataKey="sorties" name="Sorties" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Derniers mouvements — mes produits</h3>
            </div>
            {loading ? <Spinner /> : mouvements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Aucun mouvement</p>
            ) : (
              <div className="divide-y divide-border">
                {mouvements.map((m: any) => (
                  <div key={m.id} className="px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.type_mouvement === "IN" ? "bg-green-100" : "bg-red-100"}`}>
                        {m.type_mouvement === "IN" ? <ArrowUp className="w-4 h-4 text-green-600" /> : <ArrowDown className="w-4 h-4 text-red-500" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{m.produit?.nom_produit ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(m.date_mouvement)}{m.user && ` · ${m.user.prenom} ${m.user.nom}`}{m.note && ` · ${m.note}`}
                        </p>
                        {m.type_mouvement === "OUT" && (
                          <LotConsumptionDetails mouvementId={m.id} endpointPrefix="/stock" compact={true} defaultOpen={false} />
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${m.type_mouvement === "IN" ? "text-green-600" : "text-red-500"}`}>
                          {m.type_mouvement === "IN" ? "+" : "-"}{m.quantite_mouvement}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.quantite_avant} → {m.quantite_apres}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ MODAL: ADD STOCK ════════ */}
      {showAddStock && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Entrée de stock</h3>
              <button onClick={() => { setShowAddStock(false); setSelProduct(""); setStockQty(""); setStockNote(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Produit (vos produits assignés)</label>
                <select value={selProduct} onChange={e => setSelProduct(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background">
                  <option value="">Sélectionner…</option>
                  {produits.map(p => <option key={p.id} value={p.id}>{p.nom} (stock : {p.quantite})</option>)}
                </select>
              </div>
              {selProd && (
                <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${selProd.en_alerte ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  Stock actuel : <strong>{selProd.quantite} unités</strong>
                  {selProd.en_alerte && <AlertTriangle className="w-3.5 h-3.5 ml-auto" />}
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Quantité à ajouter</label>
                <input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} min="1" placeholder="Ex : 10"
                  className="w-full text-sm px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background" />
                {selProd && Number(stockQty) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Nouveau stock : <strong className="text-green-600">{selProd.quantite + Number(stockQty)}</strong></p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Note <span className="text-muted-foreground ml-1">(optionnel)</span>
                </label>
                <input type="text" value={stockNote} onChange={e => setStockNote(e.target.value)} placeholder="Ex : Réception commande fournisseur"
                  className="w-full text-sm px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button onClick={() => setShowAddStock(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted">Annuler</button>
              <button onClick={handleAddStock} disabled={!selProduct || !stockQty || addSubmitting}
                className="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {addSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateProduit && (
        <CreateProduitModal categories={categories} onClose={() => setShowCreate(false)}
          onCreated={p => { setProduits(prev => [p, ...prev]); fetchAll(true); }} showToast={showToast} />
      )}

      {lotsModal && (
        <ProductLotsModal produitId={lotsModal.id} produitNom={lotsModal.nom} endpointPrefix="/stock" onClose={() => setLotsModal(null)} />
      )}

      {activeDemande && (
        <DemandeModal demande={activeDemande} onClose={() => setActiveDemande(null)} onUpdated={handleDemandeUpdated} showToast={showToast} />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default StockDashboard;