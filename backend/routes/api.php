<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\DepartementController;
use App\Http\Controllers\CategorieController;
use App\Http\Controllers\ProduitController;
use App\Http\Controllers\DemandeController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\HistoriqueController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\NotificationsController;
use App\Http\Controllers\ChatbotController;
use Illuminate\Support\Facades\Route;


// ── Public ────────────────────────────────────────────────────────────────────
Route::post('/login', [AuthController::class, 'login']);

// ── Authenticated ─────────────────────────────────────────────────   ────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me',      [AuthController::class, 'me']);

    Route::prefix('notifications')->group(function () {
        Route::get('/',                     [NotificationsController::class, 'index']);
        Route::get('/unread-count',         [NotificationsController::class, 'unreadCount']);
        Route::post('/{notification}/read', [NotificationsController::class, 'markRead']);
        Route::post('/read-all',            [NotificationsController::class, 'markAllRead']);
        Route::delete('/{notification}',    [NotificationsController::class, 'destroy']);
        Route::delete('/',                  [NotificationsController::class, 'destroyAll']);
    });

    Route::prefix('profile')->group(function () {
        Route::get('/',               [ProfileController::class, 'show']);
        Route::patch('/',             [ProfileController::class, 'update']);
        Route::post('change-password', [ProfileController::class, 'changePassword']);
        Route::post('logout-all',     [ProfileController::class, 'logoutAll']);
        Route::patch('preferences',   [ProfileController::class, 'updatePreferences']);
        Route::get('activity',        [ProfileController::class, 'activity']);
    });

    // Produits: READ for everyone
    Route::get('produits',           [ProduitController::class, 'index']);
    Route::get('produits/form-data', [ProduitController::class, 'formData']);
    Route::get('produits/{Produit}', [ProduitController::class, 'show']);

    // Demandes: all authenticated roles
    Route::get('demandes/stats',                     [DemandeController::class, 'stats']);
    Route::get('demandes',                           [DemandeController::class, 'index']);
    Route::post('demandes',                          [DemandeController::class, 'store']);
    Route::get('demandes/{demande}',                 [DemandeController::class, 'show']);
    Route::put('demandes/{demande}',                 [DemandeController::class, 'update']);
    Route::delete('demandes/{demande}',              [DemandeController::class, 'destroy']);
    Route::put('demandes/{demande}/modifier',        [DemandeController::class, 'modifier']);


    Route::post('chatbot/message', [ChatbotController::class, 'message']);


    // ── Responsable département ───────────────────────────────────────────────
    Route::middleware('role:responsable departement')->group(function () {
        Route::get('dept/stats',                         [DemandeController::class, 'statsDept']);
        Route::get('dept/demandes',                      [DemandeController::class, 'indexForDept']);

        // ← NOUVELLE ROUTE
        Route::post('dept/demandes',                     [DemandeController::class, 'storeChefDept']);

        Route::post('dept/demandes/{demande}/approuver', [DemandeController::class, 'approuverDept']);
        Route::post('dept/demandes/{demande}/refuser',   [DemandeController::class, 'refuserDept']);
    });

    // ── Responsable stock ─────────────────────────────────────────────────────
    Route::middleware('role:responsable stock')->group(function () {
        Route::get('stock/stats',    [StockController::class, 'stats']);
        Route::get('stock/demandes', [StockController::class, 'indexDemandes']);
        Route::get('stock/produits', [StockController::class, 'indexproduits']);
        Route::get('stock/mouvements', [StockController::class, 'indexMouvements']);

        // Stock entry (now also accepts numero_lot + date_expiration)
        Route::post('stock/entree',  [StockController::class, 'entreeStock']);

        // ── FIFO: lots endpoints ──────────────────────────────────────────────
        Route::get('stock/lots',                        [StockController::class, 'indexLots']);
        Route::get('stock/produits/{produit}/lots',     [StockController::class, 'lotsParProduit']);

        // Per-line FIFO validation
        Route::post('stock/demandes/{demande}/valider-lignes', [StockController::class, 'validerLignes']);

        // Whole-demande shortcuts
        Route::post('stock/demandes/{demande}/approuver', [StockController::class, 'approuver']);
        Route::post('stock/demandes/{demande}/refuser',   [StockController::class, 'refuser']);
        Route::post('stock/demandes/{demande}/livrer',    [StockController::class, 'marquerLivree']);

        Route::post('stock/check-alerts', [StockController::class, 'checkAlertes']);

        Route::get('stock/mouvements/{mouvement}/lots', [StockController::class, 'lotsParMouvement']);
        Route::get('stock/details/{detail}/lots',       [StockController::class, 'lotsParDetail']);
        Route::get('stock/demandes/{demande}/lots', [StockController::class, 'lotsParDemande']);


        Route::post('produits', [ProduitController::class, 'store']);
    });

    // ── Admin ─────────────────────────────────────────────────────────────────
    Route::middleware('role:admin')->group(function () {
        Route::get('users/form-data',              [UserController::class, 'formData']);
        Route::patch('users/{user}/toggle-active', [UserController::class, 'toggleActive']);
        Route::apiResource('users', UserController::class);

        Route::get('departements',                                    [DepartementController::class, 'index']);
        Route::post('departements',                                   [DepartementController::class, 'store']);
        Route::patch('departements/{departement}',                    [DepartementController::class, 'update']);
        Route::delete('departements/{departement}',                   [DepartementController::class, 'destroy']);
        Route::get('departements/available-users',                    [DepartementController::class, 'availableUsers']);
        Route::get('departements/{departement}/users',                [DepartementController::class, 'users']);
        Route::post('departements/{departement}/assign',              [DepartementController::class, 'assignUser']);
        Route::delete('departements/{departement}/users/{user}',      [DepartementController::class, 'unassignUser']);

        Route::get('categories',                [CategorieController::class, 'index']);
        Route::post('categories',               [CategorieController::class, 'store']);
        Route::delete('categories/{categorie}', [CategorieController::class, 'destroy']);

        Route::post('produits',                          [ProduitController::class, 'store']);
        Route::put('produits/{Produit}',                 [ProduitController::class, 'update']);
        Route::delete('produits/{Produit}',              [ProduitController::class, 'destroy']);
        Route::patch('produits/{Produit}/toggle-active', [ProduitController::class, 'toggleActive']);

        Route::get('/admin/demandes',   [DemandeController::class, 'adminIndex']);
        Route::get('/admin/mouvements', [StockController::class, 'indexMouvements']);

        // ── FIFO: admin lots endpoints ────────────────────────────────────────
        Route::get('/admin/lots',                        [StockController::class, 'indexLots']);
        Route::get('/admin/produits/{produit}/lots',     [StockController::class, 'lotsParProduit']);

        Route::get('/admin/historiques',              [HistoriqueController::class, 'index']);
        Route::get('/admin/historiques/{historique}', [HistoriqueController::class, 'show']);

        Route::get('admin/mouvements/{mouvement}/lots', [StockController::class, 'lotsParMouvement']);
        Route::get('admin/details/{detail}/lots',       [StockController::class, 'lotsParDetail']);
        Route::get('admin/demandes/{demande}/lots', [StockController::class, 'lotsParDemande']);

        Route::get('/admin/stocks',                          [StockController::class, 'indexAssignations']);
        Route::get('/admin/gestionnaires',                   [StockController::class, 'indexGestionnaires']);
        Route::get('/admin/produits/{produit}/gestionnaires', [StockController::class, 'gestionnairesParProduit']);
        Route::post('/admin/stocks/assigner',                [StockController::class, 'assigner']);
        Route::delete('/admin/stocks/desassigner',           [StockController::class, 'desassigner']);
    });
});
