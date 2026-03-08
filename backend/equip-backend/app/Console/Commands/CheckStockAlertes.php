<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Produit; // Vérifie que ton modèle s'appelle bien Produit
use Illuminate\Support\Facades\Log;

class CheckStockAlertes extends Command
{
    /**
     * Le nom et la signature de la commande.
     * C'est ce que tu appelles dans le Kernel.
     */
    protected $signature = 'stock:check-alertes';

    /**
     * La description de la commande.
     */
    protected $description = 'Vérification quotidienne des seuils de stock';

    /**
     * Logique d'exécution de la commande.
     */
    public function handle()
    {
        // 1. Récupération des produits en alerte
        // On compare la quantité actuelle (stock) au seuil minimal (seuil_alerte)
        $produitsCritiques = Produit::whereColumn('quantite', '<=', 'seuil_alerte')
            ->where('is_active', true)
            ->get();

        if ($produitsCritiques->isEmpty()) {
            $this->info("Aucune alerte de stock aujourd'hui.");
            return 0;
        }

        // 2. Traitement des alertes
        foreach ($produitsCritiques as $Produit) {
            $message = "Alerte Stock : Le Produit [{$Produit->nom}] a atteint un niveau critique ({$Produit->quantite}).";
            
            // On écrit dans les logs (storage/logs/laravel.log)
            Log::warning($message);
            
            // On affiche dans la console pour le test manuel
            $this->warn($message);

            /* Note : Tu pourras ajouter ici l'envoi d'un email 
               ou une notification en base de données plus tard.
            */
        }

        $this->info("La vérification du " . now()->format('d/m/Y') . " est terminée.");
        return 0;
    }
}