<?php

namespace App\Services;

use App\Models\MouvementLotDetail;
use App\Models\ProduitLot;
use App\Models\Produit;
use Illuminate\Support\Collection;

/**
 * FifoStockService
 *
 * Handles all FIFO lot creation and consumption logic.
 *
 * ⚠️  ALL public methods MUST be called inside a DB::transaction().
 *     The service itself does NOT open transactions — the caller controls them.
 */
class FifoStockService
{
    public function __construct(private AuditService $audit) {}

    // =========================================================================
    // CREATE LOT  — called on every stock entry (IN movement)
    // =========================================================================

    /**
     * Create a new stock lot tied to an IN movement.
     *
     * @param int         $produitId
     * @param int         $quantite
     * @param int         $mouvementId   ID of the MouvementStock IN row
     * @param string|null $numeroLot     Supplier/custom batch number (auto-generated if null)
     * @param string|null $dateExpiration  'Y-m-d' format
     * @param string|null $note
     * @param int         $userId        For audit (0 = skip audit)
     */
    public function createLot(
        int     $produitId,
        int     $quantite,
        int     $mouvementId,
        ?string $numeroLot      = null,
        ?string $dateExpiration = null,
        ?string $note           = null,
        int     $userId         = 0
    ): ProduitLot {
        $lot = ProduitLot::create([
            'id_produit'          => $produitId,
            'numero_lot'          => $numeroLot ?? $this->generateNumeroLot($produitId),
            'date_entree'         => now(),
            'date_expiration'     => $dateExpiration,
            'quantite_initiale'   => $quantite,
            'quantite_restante'   => $quantite,
            'id_mouvement_entree' => $mouvementId,
            'statut'              => ProduitLot::STATUT_ACTIF,
            'note'                => $note,
        ]);

        if ($userId > 0) {
            $this->audit->log(
                userId:         $userId,
                tableModifiee:  'produit_lots',
                typeAction:     'INSERT',
                description:    "Création lot #{$lot->id_lot} — produit #{$produitId}",
                referenceObjet: "lot#{$lot->id_lot}",
                details: [[
                    'champs_modifie' => 'produit_lots.creation',
                    'ancien_valeur'  => null,
                    'nouveau_valeur' => "lot#{$lot->id_lot} numero={$lot->numero_lot} qty={$quantite}",
                    'info_detail'    => "produit#{$produitId} mouvement#{$mouvementId}",
                    'commentaire'    => $note,
                ]],
            );
        }

        return $lot;
    }

    // =========================================================================
    // CONSUME  — FIFO OUT, called on each accepted detail line
    // =========================================================================

    /**
     * Consume stock from lots using FIFO (oldest date_entree first).
     *
     * Steps:
     *  1. Lock all eligible lots (lockForUpdate)
     *  2. Check total available >= requested
     *  3. Iterate lots oldest→newest, drain each until satisfied
     *  4. Write MouvementLotDetail rows
     *  5. Decrement produits.quantite
     *  6. Write audit
     *
     * Returns a FifoConsumeResult (check ->success before proceeding).
     */
    public function consume(
        int  $produitId,
        int  $quantiteDemandee,
        int  $mouvementId,
        ?int $demandeId       = null,
        ?int $detailDemandeId = null,
        int  $userId          = 0,
    ): FifoConsumeResult {

        // Lock lots to prevent race conditions
        $lots = ProduitLot::lockForUpdate()
            ->disponibles()
            ->pourProduit($produitId)
            ->get();

        $stockDisponible = $lots->sum('quantite_restante');

        // ── Insufficient stock ────────────────────────────────────────────────
        if ($stockDisponible < $quantiteDemandee) {
            if ($userId > 0) {
                $this->audit->log(
                    userId:         $userId,
                    tableModifiee:  'produit_lots',
                    typeAction:     'ACTION',
                    description:    "FIFO refusé — stock insuffisant — produit #{$produitId}",
                    referenceObjet: "produit#{$produitId}",
                    details: [[
                        'champs_modifie' => 'audit.fifo.refuse',
                        'ancien_valeur'  => null,
                        'nouveau_valeur' => 'STOCK_INSUFFISANT',
                        'info_detail'    => "produit#{$produitId} dispo={$stockDisponible} demande={$quantiteDemandee}"
                                         . ($demandeId       ? " demande#{$demandeId}"       : '')
                                         . ($detailDemandeId ? " ligne#{$detailDemandeId}"   : ''),
                        'commentaire'    => "Disponible: {$stockDisponible}, Demandé: {$quantiteDemandee}",
                    ]],
                );
            }

            return FifoConsumeResult::failure(
                raison:           "Stock insuffisant (disponible: {$stockDisponible}, demandé: {$quantiteDemandee})",
                stockDisponible:  $stockDisponible,
                quantiteDemandee: $quantiteDemandee,
            );
        }

        // ── FIFO consumption ──────────────────────────────────────────────────
        $restant       = $quantiteDemandee;
        $lotsConsommes = [];
        $auditDetails  = [];

        foreach ($lots as $lot) {
            if ($restant <= 0) break;

            $prendre = min($lot->quantite_restante, $restant);
            $avant   = $lot->quantite_restante;
            $apres   = $avant - $prendre;

            // Update lot
            $lot->quantite_restante = $apres;
            $lot->statut            = ($apres <= 0) ? ProduitLot::STATUT_EPUISE : ProduitLot::STATUT_ACTIF;
            $lot->save();

            // Record consumption
            MouvementLotDetail::create([
                'id_mouvement'       => $mouvementId,
                'id_demande'         => $demandeId,
                'id_detail_demande'  => $detailDemandeId,
                'id_lot'             => $lot->id_lot,
                'quantite_sortie'    => $prendre,
                'quantite_lot_avant' => $avant,
                'quantite_lot_apres' => $apres,
            ]);

            $lotsConsommes[] = [
                'id_lot'         => $lot->id_lot,
                'numero_lot'     => $lot->numero_lot,
                'date_entree'    => $lot->date_entree->format('Y-m-d'),
                'quantite_prise' => $prendre,
                'avant'          => $avant,
                'apres'          => $apres,
                'epuise'         => $apres <= 0,
            ];

            $auditDetails[] = [
                'champs_modifie' => 'produit_lots.quantite_restante',
                'ancien_valeur'  => (string) $avant,
                'nouveau_valeur' => (string) $apres,
                'info_detail'    => "lot#{$lot->id_lot} numero={$lot->numero_lot} produit#{$produitId}"
                                  . ($demandeId       ? " demande#{$demandeId}"     : '')
                                  . ($detailDemandeId ? " ligne#{$detailDemandeId}" : ''),
                'commentaire'    => $apres <= 0 ? 'Lot épuisé' : null,
            ];

            if ($apres <= 0) {
                $auditDetails[] = [
                    'champs_modifie' => 'produit_lots.statut',
                    'ancien_valeur'  => ProduitLot::STATUT_ACTIF,
                    'nouveau_valeur' => ProduitLot::STATUT_EPUISE,
                    'info_detail'    => "lot#{$lot->id_lot} produit#{$produitId}",
                    'commentaire'    => 'Lot épuisé suite sortie FIFO',
                ];
            }

            $restant -= $prendre;
        }

        // ── Decrement global product quantity ─────────────────────────────────
        Produit::where('id_produit', $produitId)
               ->lockForUpdate()
               ->decrement('quantite', $quantiteDemandee);

        // ── Audit ─────────────────────────────────────────────────────────────
        if ($userId > 0 && !empty($auditDetails)) {
            $this->audit->log(
                userId:         $userId,
                tableModifiee:  'produit_lots',
                typeAction:     'UPDATE',
                description:    "Sortie FIFO — produit #{$produitId} — {$quantiteDemandee} unité(s)",
                referenceObjet: "produit#{$produitId}",
                details:        $auditDetails,
            );
        }

        return FifoConsumeResult::success(
            lotsConsommes:     $lotsConsommes,
            quantiteConsommee: $quantiteDemandee,
        );
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /** Total available stock across active lots for a product. */
    public function stockDisponible(int $produitId): int
    {
        return ProduitLot::disponibles()->pourProduit($produitId)->sum('quantite_restante');
    }

    /** Active lots ordered FIFO. */
    public function lotsDisponibles(int $produitId): Collection
    {
        return ProduitLot::disponibles()->pourProduit($produitId)->get();
    }

    private function generateNumeroLot(int $produitId): string
    {
        $count = ProduitLot::where('id_produit', $produitId)->count() + 1;
        return sprintf('LOT-P%04d-%04d-%s', $produitId, $count, now()->format('Ymd'));
    }
}

// =============================================================================
// FifoConsumeResult — Value Object
// =============================================================================

class FifoConsumeResult
{
    private function __construct(
        public readonly bool   $success,
        public readonly string $raison            = '',
        public readonly int    $stockDisponible   = 0,
        public readonly int    $quantiteDemandee  = 0,
        public readonly array  $lotsConsommes     = [],
        public readonly int    $quantiteConsommee = 0,
    ) {}

    public static function success(array $lotsConsommes, int $quantiteConsommee): self
    {
        return new self(
            success:           true,
            lotsConsommes:     $lotsConsommes,
            quantiteConsommee: $quantiteConsommee,
        );
    }

    public static function failure(string $raison, int $stockDisponible, int $quantiteDemandee): self
    {
        return new self(
            success:          false,
            raison:           $raison,
            stockDisponible:  $stockDisponible,
            quantiteDemandee: $quantiteDemandee,
        );
    }

    /** Summary string of which lots were consumed, for audit comments. */
    public function lotsResume(): string
    {
        return collect($this->lotsConsommes)
            ->map(fn($l) => "{$l['numero_lot']}(−{$l['quantite_prise']})")
            ->implode(', ');
    }
}