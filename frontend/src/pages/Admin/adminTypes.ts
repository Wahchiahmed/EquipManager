// src/pages/admin/adminTypes.ts
// ── Shared types used across all admin pages ──────────────────────────────────

export interface ApiUser {
  id_utilisateur: number; nom: string; prenom: string; email: string;
  telephone: string | null; is_active: boolean; role_id: number;
  role_nom: 'ADMIN' | 'EMPLOYEE' | 'RESPONSABLE_DEPARTEMENT' | 'RESPONSABLE_STOCK';
  departement_id: number | null; departement_nom: string; created_at: string;
}

export interface ApiDepartement {
  id: number; nom: string; users_count: number; created_at: string;
}

export interface ApiCategorie {
  id_categorie: number; nom_categorie: string; description: string | null;
  produits_count: number; created_at: string;
}

export interface ApiProduit {
  id_produit: number; nom_produit: string; description: string | null;
  reference: string | null; code_barre: string | null;
  quantite: number; seuil_alerte: number; is_active: boolean; en_alerte: boolean;
  id_categorie: number; categorie_nom: string; created_at: string;
}

export interface ApiDemandeDetail {
  id_detail: number; id_produit: number; produit_nom?: string; nom?: string;
  reference: string | null; quantite: number; statut?: string;
  commentaire_stock?: string | null;
}

export interface ApiDemande {
  id_demande: number; date_demande: string; statut: string;
  commentaire: string | null; id_demandeur: number;
  demandeur_nom?: string; demandeur_prenom?: string; departement_nom?: string;
  demandeur?: { id: number; nom: string; prenom: string; departement?: { nom: string } | null } | null;
  responsable_dept: string | null; responsable_stock: string | null;
  date_validation_dept: string | null; date_validation_stock: string | null;
  details: ApiDemandeDetail[];
}

export interface ApiMouvement {
  id_mouvement: number; type_mouvement: 'IN' | 'OUT';
  quantite_mouvement: number; quantite_avant: number; quantite_apres: number;
  date_mouvement: string; note?: string | null;
  produit?: { id_produit: number; nom_produit: string; reference?: string | null } | null;
  user?: { id: number; nom: string; prenom: string } | null;
  demande?: { id_demande: number } | null;
}

export interface ApiAuditUser {
  id: number; nom: string; prenom: string; email?: string;
}

export interface ApiDetailHistorique {
  id_details?: number; champs_modifie: string;
  ancien_valeur: string | null; nouveau_valeur: string | null;
  info_detail: string | null; commentaire: string | null; created_at?: string;
}

export interface ApiHistorique {
  id_historique: number; date_action: string; table_modifiee: string;
  type_action: 'INSERT' | 'UPDATE' | 'DELETE' | 'ACTION';
  description: string; reference_objet: string | null;
  user?: ApiAuditUser | null; details?: ApiDetailHistorique[];
}

export interface Role { id: number; nom: string; }
export interface Departement { id: number; nom: string; }
export interface CategorieOption { id_categorie: number; nom_categorie: string; }

export interface CreateUserForm {
  nom: string; prenom: string; email: string; password: string;
  telephone: string; role_id: string; departement_id: string;
}

export interface ProduitForm {
  nom_produit: string; description: string; reference: string;
  code_barre: string; quantite: string; seuil_alerte: string;
  id_categorie: string; is_active: boolean;
}


export interface ApiProduitLot {
  id_lot:              number;
  id_produit:          number;
  produit_nom:         string;
  produit_reference:   string | null;
  numero_lot:          string;
  date_entree:         string | null;
  date_expiration:     string | null;
  quantite_initiale:   number;
  quantite_restante:   number;
  quantite_consommee:  number;
  pourcentage_utilise: number;
  statut:              'actif' | 'epuise' | 'expire';
  note:                string | null;
  consommations?:      ApiLotConsommation[];
}

export interface ApiLotConsommation {
  id:                  number;
  quantite_sortie:     number;
  quantite_lot_avant:  number;
  quantite_lot_apres:  number;
  id_demande:          number | null;
  id_mouvement:        number | null;
  date:                string | null;
}

export interface ApiLotsParProduitResponse {
  produit: {
    id_produit:  number;
    nom_produit: string;
    reference:   string | null;
    quantite:    number;
  };
  lots:             ApiProduitLot[];
  total_lots:       number;
  lots_actifs:      number;
  lots_epuises:     number;
  stock_disponible: number;
}

// Extend existing ApiMouvement to include lot details
export interface ApiMouvementLotDetail {
  id:                  number;
  id_lot:              number;
  numero_lot:          string;
  date_entree:         string;
  quantite_sortie:     number;
  quantite_lot_avant:  number;
  quantite_lot_apres:  number;
  id_demande:          number | null;
  id_mouvement:        number | null;
}
// ── Shared constants ──────────────────────────────────────────────────────────

export const roleColors: Record<string, string> = {
  EMPLOYEE: 'bg-blue-100 text-blue-700',
  RESPONSABLE_DEPARTEMENT: 'bg-amber-100 text-amber-700',
  RESPONSABLE_STOCK: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-red-100 text-red-700',
};

export const roleLabels: Record<string, string> = {
  EMPLOYEE: 'Employé',
  RESPONSABLE_DEPARTEMENT: 'Resp. Département',
  RESPONSABLE_STOCK: 'Resp. Stock',
  ADMIN: 'Admin',
};

export const EMPTY_USER_FORM: CreateUserForm = {
  nom: '', prenom: '', email: '', password: '', telephone: '', role_id: '', departement_id: '',
};

export const EMPTY_PRODUIT_FORM: ProduitForm = {
  nom_produit: '', description: '', reference: '', code_barre: '',
  quantite: '0', seuil_alerte: '5', id_categorie: '', is_active: true,
};

export const inputCls = "w-full px-3 py-2 text-sm bg-muted border border-transparent rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";