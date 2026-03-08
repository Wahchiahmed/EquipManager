import { User, Departement, Categorie, Produit, Demande, MouvementStock, Historique, Notification } from '@/types';

export const mockCurrentUser: User = {
  id_utilisateur: 1,
  nom: 'Dupont',
  prenom: 'Marie',
  email: 'marie.dupont@company.com',
  telephone: '+33 6 12 34 56 78',
  id_role: 1,
  role_nom: 'EMPLOYEE',
  id_departement: 1,
  departement_nom: 'Informatique',
  is_active: true,
  created_at: '2024-01-15',
};

export const mockUsers: User[] = [
  { id_utilisateur: 1, nom: 'Dupont', prenom: 'Marie', email: 'marie.dupont@company.com', telephone: '+33 6 12 34 56 78', id_role: 1, role_nom: 'EMPLOYEE', id_departement: 1, departement_nom: 'Informatique', is_active: true, created_at: '2024-01-15' },
  { id_utilisateur: 2, nom: 'Martin', prenom: 'Jean', email: 'jean.martin@company.com', telephone: '+33 6 23 45 67 89', id_role: 2, role_nom: 'RESPONSABLE_DEPARTEMENT', id_departement: 1, departement_nom: 'Informatique', is_active: true, created_at: '2023-06-10' },
  { id_utilisateur: 3, nom: 'Bernard', prenom: 'Sophie', email: 'sophie.bernard@company.com', telephone: '+33 6 34 56 78 90', id_role: 3, role_nom: 'RESPONSABLE_STOCK', id_departement: 5, departement_nom: 'Logistique', is_active: true, created_at: '2023-03-20' },
  { id_utilisateur: 4, nom: 'Petit', prenom: 'Lucas', email: 'lucas.petit@company.com', telephone: '+33 6 45 67 89 01', id_role: 4, role_nom: 'ADMIN', id_departement: 6, departement_nom: 'Direction', is_active: true, created_at: '2022-11-05' },
  { id_utilisateur: 5, nom: 'Leroy', prenom: 'Emma', email: 'emma.leroy@company.com', telephone: '+33 6 56 78 90 12', id_role: 1, role_nom: 'EMPLOYEE', id_departement: 2, departement_nom: 'RH', is_active: true, created_at: '2024-03-01' },
  { id_utilisateur: 6, nom: 'Moreau', prenom: 'Thomas', email: 'thomas.moreau@company.com', telephone: '+33 6 67 89 01 23', id_role: 1, role_nom: 'EMPLOYEE', id_departement: 3, departement_nom: 'Finance', is_active: false, created_at: '2023-09-15' },
];

export const mockDepartements: Departement[] = [
  { id_departement: 1, nom_departement: 'Informatique', id_responsable: 2, responsable_nom: 'Jean Martin' },
  { id_departement: 2, nom_departement: 'Ressources Humaines', id_responsable: 2, responsable_nom: 'Jean Martin' },
  { id_departement: 3, nom_departement: 'Finance', id_responsable: 2, responsable_nom: 'Jean Martin' },
  { id_departement: 4, nom_departement: 'Marketing', id_responsable: 2, responsable_nom: 'Jean Martin' },
  { id_departement: 5, nom_departement: 'Logistique', id_responsable: 3, responsable_nom: 'Sophie Bernard' },
  { id_departement: 6, nom_departement: 'Direction', id_responsable: 4, responsable_nom: 'Lucas Petit' },
];

export const mockCategories: Categorie[] = [
  { id_categorie: 1, nom_categorie: 'Informatique', description: 'Équipements informatiques et accessoires' },
  { id_categorie: 2, nom_categorie: 'Mobilier', description: 'Meubles de bureau' },
  { id_categorie: 3, nom_categorie: 'Fournitures', description: 'Fournitures de bureau' },
  { id_categorie: 4, nom_categorie: 'Téléphonie', description: 'Équipements téléphoniques' },
];

export const mockProduits: Produit[] = [
  { id_produit: 1, nom_produit: 'Laptop Dell XPS 15', description: 'Ordinateur portable haute performance', reference: 'DELL-XPS15-2024', code_barre: '1234567890123', quantite: 12, seuil_alerte: 5, id_categorie: 1, categorie_nom: 'Informatique', is_active: true, created_at: '2024-01-10' },
  { id_produit: 2, nom_produit: 'Écran 27" 4K', description: 'Moniteur 4K ultra-haute définition', reference: 'MON-27-4K-001', code_barre: '1234567890124', quantite: 3, seuil_alerte: 5, id_categorie: 1, categorie_nom: 'Informatique', is_active: true, created_at: '2024-01-12' },
  { id_produit: 3, nom_produit: 'Souris Logitech MX Master', description: 'Souris ergonomique sans fil', reference: 'LOG-MX3-001', code_barre: '1234567890125', quantite: 25, seuil_alerte: 10, id_categorie: 1, categorie_nom: 'Informatique', is_active: true, created_at: '2024-01-15' },
  { id_produit: 4, nom_produit: 'Clavier mécanique Keychron', description: 'Clavier mécanique sans fil', reference: 'KEY-K2-001', code_barre: '1234567890126', quantite: 2, seuil_alerte: 8, id_categorie: 1, categorie_nom: 'Informatique', is_active: true, created_at: '2024-01-20' },
  { id_produit: 5, nom_produit: 'Chaise de bureau ergonomique', description: 'Chaise réglable multi-positions', reference: 'CHAISE-ERG-001', code_barre: '1234567890127', quantite: 8, seuil_alerte: 3, id_categorie: 2, categorie_nom: 'Mobilier', is_active: true, created_at: '2024-02-01' },
  { id_produit: 6, nom_produit: 'Téléphone IP Cisco', description: 'Téléphone IP bureau entreprise', reference: 'CIS-IP-7942', code_barre: '1234567890128', quantite: 15, seuil_alerte: 5, id_categorie: 4, categorie_nom: 'Téléphonie', is_active: true, created_at: '2024-02-05' },
  { id_produit: 7, nom_produit: 'Rame de papier A4', description: '500 feuilles 80g/m²', reference: 'PAP-A4-80G', code_barre: '1234567890129', quantite: 1, seuil_alerte: 20, id_categorie: 3, categorie_nom: 'Fournitures', is_active: true, created_at: '2024-02-10' },
  { id_produit: 8, nom_produit: 'Webcam HD 1080p', description: 'Webcam haute définition USB', reference: 'WEB-HD-1080', code_barre: '1234567890130', quantite: 18, seuil_alerte: 6, id_categorie: 1, categorie_nom: 'Informatique', is_active: true, created_at: '2024-02-15' },
];

export const mockDemandes: Demande[] = [
  {
    id_demande: 1, date_demande: '2025-02-10', statut: 'EN_ATTENTE_DEPT',
    id_demandeur: 1, demandeur_nom: 'Dupont', demandeur_prenom: 'Marie',
    departement_nom: 'Informatique',
    details: [{ id_detail: 1, id_demande: 1, id_produit: 1, produit_nom: 'Laptop Dell XPS 15', quantite: 1 }],
  },
  {
    id_demande: 2, date_demande: '2025-02-08', statut: 'EN_ATTENTE_STOCK',
    id_demandeur: 5, demandeur_nom: 'Leroy', demandeur_prenom: 'Emma',
    id_responsable_dept: 2, date_validation_dept: '2025-02-09',
    departement_nom: 'RH',
    details: [
      { id_detail: 2, id_demande: 2, id_produit: 3, produit_nom: 'Souris Logitech MX Master', quantite: 2 },
      { id_detail: 3, id_demande: 2, id_produit: 4, produit_nom: 'Clavier mécanique Keychron', quantite: 2 },
    ],
  },
  {
    id_demande: 3, date_demande: '2025-02-05', statut: 'VALIDEE',
    id_demandeur: 1, demandeur_nom: 'Dupont', demandeur_prenom: 'Marie',
    id_responsable_dept: 2, date_validation_dept: '2025-02-06',
    id_responsable_stock: 3, date_validation_stock: '2025-02-07',
    departement_nom: 'Informatique',
    details: [{ id_detail: 4, id_demande: 3, id_produit: 8, produit_nom: 'Webcam HD 1080p', quantite: 1 }],
  },
  {
    id_demande: 4, date_demande: '2025-02-01', statut: 'REFUSEE_DEPT',
    id_demandeur: 6, demandeur_nom: 'Moreau', demandeur_prenom: 'Thomas',
    id_responsable_dept: 2, date_validation_dept: '2025-02-02',
    commentaire: 'Budget insuffisant pour ce trimestre',
    departement_nom: 'Finance',
    details: [{ id_detail: 5, id_demande: 4, id_produit: 2, produit_nom: 'Écran 27" 4K', quantite: 3 }],
  },
  {
    id_demande: 5, date_demande: '2025-01-28', statut: 'LIVREE',
    id_demandeur: 5, demandeur_nom: 'Leroy', demandeur_prenom: 'Emma',
    id_responsable_dept: 2, date_validation_dept: '2025-01-29',
    id_responsable_stock: 3, date_validation_stock: '2025-01-30',
    departement_nom: 'RH',
    details: [{ id_detail: 6, id_demande: 5, id_produit: 6, produit_nom: 'Téléphone IP Cisco', quantite: 1 }],
  },
  {
    id_demande: 6, date_demande: '2025-02-12', statut: 'EN_ATTENTE_DEPT',
    id_demandeur: 1, demandeur_nom: 'Dupont', demandeur_prenom: 'Marie',
    departement_nom: 'Informatique',
    details: [{ id_detail: 7, id_demande: 6, id_produit: 5, produit_nom: 'Chaise de bureau ergonomique', quantite: 2 }],
  },
];

export const mockMouvements: MouvementStock[] = [
  { id_mouvement: 1, type_mouvement: 'OUT', id_produit: 8, produit_nom: 'Webcam HD 1080p', quantite_avant: 19, quantite_mouvement: 1, quantite_apres: 18, date_mouvement: '2025-02-07', id_user: 3, user_nom: 'Sophie Bernard', id_demande: 3 },
  { id_mouvement: 2, type_mouvement: 'IN', id_produit: 1, produit_nom: 'Laptop Dell XPS 15', quantite_avant: 8, quantite_mouvement: 4, quantite_apres: 12, date_mouvement: '2025-02-06', id_user: 3, user_nom: 'Sophie Bernard' },
  { id_mouvement: 3, type_mouvement: 'OUT', id_produit: 6, produit_nom: 'Téléphone IP Cisco', quantite_avant: 16, quantite_mouvement: 1, quantite_apres: 15, date_mouvement: '2025-01-30', id_user: 3, user_nom: 'Sophie Bernard', id_demande: 5 },
  { id_mouvement: 4, type_mouvement: 'IN', id_produit: 3, produit_nom: 'Souris Logitech MX Master', quantite_avant: 15, quantite_mouvement: 10, quantite_apres: 25, date_mouvement: '2025-01-25', id_user: 3, user_nom: 'Sophie Bernard' },
  { id_mouvement: 5, type_mouvement: 'OUT', id_produit: 7, produit_nom: 'Rame de papier A4', quantite_avant: 11, quantite_mouvement: 10, quantite_apres: 1, date_mouvement: '2025-02-15', id_user: 3, user_nom: 'Sophie Bernard' },
];

export const mockHistorique: Historique[] = [
  { id_historique: 1, date_action: '2025-02-15 14:32', id_utilisateur: 3, user_nom: 'Sophie Bernard', type_action: 'UPDATE', table_modifiee: 'mouvements_stock', description: 'Mouvement de stock OUT pour Rame de papier A4 (-10 unités)' },
  { id_historique: 2, date_action: '2025-02-12 09:15', id_utilisateur: 1, user_nom: 'Marie Dupont', type_action: 'INSERT', table_modifiee: 'demandes', description: 'Création de la demande #6 pour Chaise de bureau ergonomique' },
  { id_historique: 3, date_action: '2025-02-10 11:20', id_utilisateur: 1, user_nom: 'Marie Dupont', type_action: 'INSERT', table_modifiee: 'demandes', description: 'Création de la demande #1 pour Laptop Dell XPS 15' },
  { id_historique: 4, date_action: '2025-02-09 16:45', id_utilisateur: 2, user_nom: 'Jean Martin', type_action: 'UPDATE', table_modifiee: 'demandes', description: 'Validation département de la demande #2 - Statut: EN_ATTENTE_STOCK' },
  { id_historique: 5, date_action: '2025-02-07 10:00', id_utilisateur: 3, user_nom: 'Sophie Bernard', type_action: 'UPDATE', table_modifiee: 'demandes', description: 'Validation stock de la demande #3 - Statut: VALIDEE' },
  { id_historique: 6, date_action: '2025-02-06 14:00', id_utilisateur: 3, user_nom: 'Sophie Bernard', type_action: 'INSERT', table_modifiee: 'mouvements_stock', description: 'Entrée de stock: Laptop Dell XPS 15 (+4 unités)' },
  { id_historique: 7, date_action: '2025-02-04 09:30', id_utilisateur: 4, user_nom: 'Lucas Petit', type_action: 'INSERT', table_modifiee: 'utilisateurs', description: 'Création du compte utilisateur Emma Leroy' },
];

export const mockNotifications: Notification[] = [
  { id_notification: 1, id_user: 1, message: 'Votre demande #3 a été validée par le stock.', is_read: false, created_at: '2025-02-07 10:01' },
  { id_notification: 2, id_user: 1, message: 'Votre demande #4 a été refusée par le département. Motif: Budget insuffisant.', is_read: false, created_at: '2025-02-02 14:30' },
  { id_notification: 3, id_user: 1, message: 'Votre demande #5 a été livrée avec succès.', is_read: true, created_at: '2025-01-30 16:00' },
  { id_notification: 4, id_user: 2, message: 'Nouvelle demande en attente de validation: Demande #1 de Marie Dupont.', is_read: false, created_at: '2025-02-10 09:15' },
  { id_notification: 5, id_user: 2, message: 'Nouvelle demande en attente de validation: Demande #6 de Marie Dupont.', is_read: false, created_at: '2025-02-12 09:20' },
  { id_notification: 6, id_user: 3, message: 'Alerte stock: Écran 27" 4K est en dessous du seuil d\'alerte (3 unités).', is_read: false, created_at: '2025-02-14 08:00' },
  { id_notification: 7, id_user: 3, message: 'Alerte stock: Clavier mécanique Keychron est en dessous du seuil (2 unités).', is_read: false, created_at: '2025-02-14 08:01' },
  { id_notification: 8, id_user: 3, message: 'Nouvelle demande validée par département à traiter: Demande #2.', is_read: false, created_at: '2025-02-09 16:50' },
];

export const roleUsers: Record<string, User> = {
  'employee@company.com': { ...mockUsers[0], role_nom: 'EMPLOYEE' },
  'manager@company.com': { ...mockUsers[1], role_nom: 'RESPONSABLE_DEPARTEMENT' },
  'stock@company.com': { ...mockUsers[2], role_nom: 'RESPONSABLE_STOCK' },
  'admin@company.com': { ...mockUsers[3], role_nom: 'ADMIN' },
};
