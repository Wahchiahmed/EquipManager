<?php

namespace App\Services;

use App\Models\Historique;
use App\Models\DetailHistorique;
use Illuminate\Support\Facades\DB;

class AuditService
{
    /**
     * Crée une entrée d'historique + détails.
     *
     * @param int    $userId
     * @param string $tableModifiee  ex: 'demandes', 'mouvements_stock', 'produits'
     * @param string $typeAction     INSERT|UPDATE|DELETE|ACTION
     * @param string $description
     * @param string|null $referenceObjet ex: "demande#12"
     * @param array $details [
     *   [
     *     'champs_modifie' => 'quantite',
     *     'ancien_valeur'  => '10',
     *     'nouveau_valeur' => '15',
     *     'info_detail'    => 'Produit#2',
     *     'commentaire'    => 'Entrée manuelle',
     *   ],
     *   ...
     * ]
     */
    public function log(
        int $userId,
        string $tableModifiee,
        string $typeAction,
        string $description,
        ?string $referenceObjet = null,
        array $details = []
    ): Historique {
        return DB::transaction(function () use ($userId, $tableModifiee, $typeAction, $description, $referenceObjet, $details) {

            $historique = Historique::create([
                'id_utilisateur'  => $userId,
                'date_action'     => now(),
                'table_modifiee'  => $tableModifiee,
                'type_action'     => $typeAction,
                'description'     => $description,
                'reference_objet' => $referenceObjet,
            ]);

            if (!empty($details)) {
                $rows = array_map(function ($d) use ($historique) {
                    return [
                        'id_historique'  => $historique->id_historique,
                        'champs_modifie' => $d['champs_modifie'] ?? '—',
                        'ancien_valeur'  => $d['ancien_valeur'] ?? null,
                        'nouveau_valeur' => $d['nouveau_valeur'] ?? null,
                        'info_detail'    => $d['info_detail'] ?? null,
                        'commentaire'    => $d['commentaire'] ?? null,
                        'created_at'     => now(),
                        'updated_at'     => now(),
                    ];
                }, $details);

                DetailHistorique::insert($rows);
            }

            return $historique->load('details');
        });
    }

    /**
     * Helper pour logguer un seul champ modifié rapidement.
     */
    public function logFieldChange(
        int $userId,
        string $tableModifiee,
        string $description,
        string $champ,
        $ancien,
        $nouveau,
        ?string $referenceObjet = null,
        ?string $infoDetail = null,
        ?string $commentaire = null
    ): Historique {
        return $this->log(
            $userId,
            $tableModifiee,
            'UPDATE',
            $description,
            $referenceObjet,
            [[
                'champs_modifie' => $champ,
                'ancien_valeur'  => is_scalar($ancien) || is_null($ancien) ? (string) $ancien : json_encode($ancien),
                'nouveau_valeur' => is_scalar($nouveau) || is_null($nouveau) ? (string) $nouveau : json_encode($nouveau),
                'info_detail'    => $infoDetail,
                'commentaire'    => $commentaire,
            ]]
        );
    }
}