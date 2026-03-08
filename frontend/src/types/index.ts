export type Role = 'EMPLOYEE' | 'RESPONSABLE_DEPARTEMENT' | 'RESPONSABLE_STOCK' | 'ADMIN';

export type RequestStatus =
  | 'EN_ATTENTE_DEPT'
  | 'REFUSEE_DEPT'
  | 'EN_ATTENTE_STOCK'
  | 'REFUSEE_STOCK'
  | 'VALIDEE'
  |'PARTIELLEMENT_VALIDEE'
  | 'LIVREE';

export type MovementType = 'IN' | 'OUT';

export interface User {
  id_utilisateur: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  id_role: number;
  role_nom: Role;
  id_departement: number;
  departement_nom: string;
  is_active: boolean;
  created_at: string;
}

export interface Departement {
  id_departement: number;
  nom_departement: string;
  id_responsable: number;
  responsable_nom?: string;
}

export interface Categorie {
  id_categorie: number;
  nom_categorie: string;
  description: string;
}

export interface Produit {
  id_produit: number;
  nom_produit: string;
  description: string;
  reference: string;
  code_barre: string;
  quantite: number;
  seuil_alerte: number;
  id_categorie: number;
  categorie_nom?: string;
  is_active: boolean;
  created_at: string;
}

export interface DetailDemande {
  id_detail: number;
  id_demande: number;
  id_produit: number;
  produit_nom?: string;
  quantite: number;
}

export interface Demande {
  id_demande: number;
  date_demande: string;
  statut: RequestStatus;
  id_demandeur: number;
  demandeur_nom?: string;
  demandeur_prenom?: string;
  id_responsable_dept?: number;
  date_validation_dept?: string;
  id_responsable_stock?: number;
  date_validation_stock?: string;
  commentaire?: string;
  details?: DetailDemande[];
  departement_nom?: string;
}

export interface MouvementStock {
  id_mouvement: number;
  type_mouvement: MovementType;
  id_produit: number;
  produit_nom?: string;
  quantite_avant: number;
  quantite_mouvement: number;
  quantite_apres: number;
  date_mouvement: string;
  id_user: number;
  user_nom?: string;
  id_demande?: number;
}

export interface Historique {
  id_historique: number;
  date_action: string;
  id_utilisateur: number;
  user_nom?: string;
  type_action: string;
  table_modifiee: string;
  description: string;
}

export interface Notification {
  id_notification: number;
  id_user: number;
  message: string;
  is_read: boolean;
  created_at: string;
}
