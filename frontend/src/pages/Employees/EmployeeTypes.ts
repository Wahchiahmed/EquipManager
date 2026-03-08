// src/pages/employee/employeeTypes.ts

export interface ApiProduit {
  id_produit: number; nom_produit: string; description: string | null;
  reference: string | null; quantite: number; seuil_alerte: number;
  is_active: boolean; en_alerte: boolean; categorie_nom: string;
}

export interface ApiDetail {
  id_detail: number; id_produit: number;
  produit_nom?: string;   // some endpoints
  Produit_nom?: string;   // DemandeController.format() sends this
  nom?: string;           // DemandeController.format() also sends this
  reference: string | null; quantite: number;
  statut?: string; commentaire?: string | null;
  quantite_dispo?: number;
}
// add this to EmployeeTypes.ts or a utils file
export const getProduitNom = (d: ApiDetail): string =>
  d.nom ?? d.produit_nom ?? d.Produit_nom ?? '—';

export interface ApiDemande {
  id_demande: number; date_demande: string; statut: string;
  commentaire: string | null; id_demandeur: number;
  demandeur_nom: string; demandeur_prenom: string; departement_nom: string;
  responsable_dept: string | null; responsable_stock: string | null;
  date_validation_dept: string | null; date_validation_stock: string | null;
  details: ApiDetail[];
}

export interface Stats {
  total: number; pending: number; approved: number; rejected: number;
}

export interface CartLine {
  produit: ApiProduit; quantite: number;
}

export const inputCls =
  'w-full px-3 py-2 text-sm bg-muted border border-transparent rounded-lg ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';