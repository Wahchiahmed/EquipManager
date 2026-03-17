<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * NotificationService
 *
 * Central service for creating and counting in-app notifications.
 * All writes are lightweight DB inserts — they do NOT dispatch jobs,
 * so callers remain inside the same transaction if needed.
 *
 * Usage (inject via constructor or resolve from service container):
 *
 *   $notif->notifyUser($userId, Notification::TYPE_DEMANDE_CREEE, 'Titre', 'Corps', [...], '/link');
 *   $notif->notifyRole('responsable stock', Notification::TYPE_ALERTE_STOCK, ...);
 */
class NotificationService
{
    // ─── Core writers ─────────────────────────────────────────────────────────

    /**
     * Send a notification to a single user.
     *
     * @param  int         $recipientId
     * @param  string      $type         One of Notification::TYPE_* constants
     * @param  string      $title        Short title shown in the bell dropdown
     * @param  string      $message      Full message body
     * @param  array       $data         Arbitrary JSON (demande_id, Produit_id …)
     * @param  string|null $link         Frontend route  e.g.  /my-requests/42
     */
    public function notifyUser(
        int $recipientId,
        string $type,
        string $title,
        string $message,
        array $data = [],
        ?string $link = null
    ): Notification {
        return Notification::create([
            'recipient_user_id' => $recipientId,
            'type'    => $type,
            'title'   => $title,
            'message' => $message,
            'data'    => $data ?: null,
            'link'    => $link,
            'is_read' => false,
        ]);
    }

    /**
     * Send the same notification to multiple users.
     * Uses a single bulk insert for performance.
     *
     * @param  int[]  $recipientIds
     */
    public function notifyUsers(
        array $recipientIds,
        string $type,
        string $title,
        string $message,
        array $data = [],
        ?string $link = null
    ): void {
        if (empty($recipientIds)) {
            return;
        }

        $now  = now();
        $rows = array_map(fn(int $id) => [
            'recipient_user_id' => $id,
            'type'       => $type,
            'title'      => $title,
            'message'    => $message,
            'data'       => $data ? json_encode($data) : null,
            'link'       => $link,
            'is_read'    => false,
            'read_at'    => null,
            'created_at' => $now,
            'updated_at' => $now,
        ], array_unique($recipientIds));

        Notification::insert($rows);
    }

    /**
     * Send a notification to ALL active users with a given role name.
     *
     * Assumes: users table has a `role` relation whose model has a `nom` column.
     * Assumes: User model has `is_active` boolean column.
     *
     * @param  string $roleName  e.g. 'responsable stock'  (case-insensitive match)
     */
    public function notifyRole(
        string $roleName,
        string $type,
        string $title,
        string $message,
        array $data = [],
        ?string $link = null
    ): void {
        $ids = User::where('is_active', true)
            ->whereHas('role', fn($q) => $q->whereRaw('LOWER(TRIM(nom)) = ?', [strtolower(trim($roleName))]))
            ->pluck('id')
            ->all();

        $this->notifyUsers($ids, $type, $title, $message, $data, $link);
    }

    // ─── Reads ────────────────────────────────────────────────────────────────

    /**
     * Number of unread notifications for a user.
     * Used for the badge counter — must be fast.
     */
    public function unreadCount(int $recipientId): int
    {
        return Notification::forUser($recipientId)->unread()->count();
    }

    // ─── Domain-specific helpers ──────────────────────────────────────────────
    // These match the trigger spec exactly and keep controllers clean.

    /**
     * A) Employee creates a demande.
     *    → Notify dept manager (responsable dép. of the employee's dept)
     *    → Optionally notify the employee themselves (confirmation)
     */
    public function onDemandeCreee(
        int $demandeId,
        int $demandeurId,
        string $demandeurFullName,
        int $departementId,
        bool $notifyEmployee = false  // default: no employee confirmation
    ): void {
        // Find the dept manager
        $deptManager = User::where('is_active', true)
            ->where('departement_id', $departementId)
            ->whereHas('role', fn($q) => $q->whereRaw("LOWER(TRIM(nom)) = 'responsable departement'"))
            ->first();

        if ($deptManager) {
            $this->notifyUser(
                $deptManager->id,
                Notification::TYPE_DEMANDE_CREEE,
                'Nouvelle demande à valider',
                "{$demandeurFullName} a soumis une nouvelle demande nécessitant votre approbation.",
                ['demande_id' => $demandeId, 'demandeur_id' => $demandeurId],
                "/pending-requests/{$demandeId}"
            );
        }

        if ($notifyEmployee) {
            $this->notifyUser(
                $demandeurId,
                Notification::TYPE_DEMANDE_CREEE,
                'Demande envoyée',
                "Votre demande #{$demandeId} a bien été enregistrée et est en attente d'approbation.",
                ['demande_id' => $demandeId],
                "/my-requests/{$demandeId}"
            );
        }
    }

    /**
     * B) Dept manager approves → goes to stock.
     *    → Notify all responsable stock users
     *    → Notify employee
     */
    public function onDemandeApprouvee(
        int $demandeId,
        int $demandeurId,
        string $deptManagerName
    ): void {
        // All stock managers
        $this->notifyRole(
            'responsable stock',
            Notification::TYPE_DEMANDE_APPROUVEE_DEPT,
            'Demande en attente de traitement stock',
            "La demande #{$demandeId} a été approuvée par le département et attend votre traitement.",
            ['demande_id' => $demandeId],
            "/stock-requests/{$demandeId}"
        );

        // Employee
        $this->notifyUser(
            $demandeurId,
            Notification::TYPE_DEMANDE_APPROUVEE_DEPT,
            'Demande approuvée par le département',
            "Votre demande #{$demandeId} a été approuvée par {$deptManagerName} et transmise au service stock.",
            ['demande_id' => $demandeId],
            "/my-requests/{$demandeId}"
        );
    }

    /**
     * C) Dept manager refuses.
     *    → Notify employee
     */
    public function onDemandeRefusee(
        int $demandeId,
        int $demandeurId,
        string $deptManagerName,
        ?string $commentaire = null
    ): void {
        $msg = "Votre demande #{$demandeId} a été refusée par {$deptManagerName}.";
        if ($commentaire) {
            $msg .= " Motif : {$commentaire}";
        }

        $this->notifyUser(
            $demandeurId,
            Notification::TYPE_DEMANDE_REFUSEE_DEPT,
            'Demande refusée par le département',
            $msg,
            ['demande_id' => $demandeId],
            "/my-requests/{$demandeId}"
        );
    }

    /**
     * D) Stock manager processes lines (validerLignes / recalculerStatut resolved).
     *    → Notify employee always
     *    → Notify dept manager (default: true)
     */
    public function onDemandeTraiteeStock(
        int $demandeId,
        int $demandeurId,
        int $departementId,
        string $finalStatut,     // VALIDEE | PARTIELLEMENT_VALIDEE | REFUSEE_STOCK
        int $acceptees,
        int $refusees,
        bool $notifyDept = true
    ): void {
        $statutLabel = match ($finalStatut) {
            'VALIDEE'               => 'entièrement validée ✅',
            'PARTIELLEMENT_VALIDEE' => 'partiellement validée ⚠️',
            'REFUSEE_STOCK'         => 'refusée par le stock ❌',
            default                 => $finalStatut,
        };

        $summary = "{$acceptees} ligne(s) acceptée(s), {$refusees} ligne(s) refusée(s).";
        $title   = "Demande #{$demandeId} {$statutLabel}";

        // Employee
        $this->notifyUser(
            $demandeurId,
            Notification::TYPE_DEMANDE_TRAITEE_STOCK,
            $title,
            "Votre demande a été traitée par le stock : {$summary}",
            ['demande_id' => $demandeId, 'statut' => $finalStatut, 'acceptees' => $acceptees, 'refusees' => $refusees],
            "/my-requests/{$demandeId}"
        );

        if ($notifyDept) {
            $deptManager = User::where('is_active', true)
                ->where('departement_id', $departementId)
                ->whereHas('role', fn($q) => $q->whereRaw("LOWER(TRIM(nom)) = 'responsable departement'"))
                ->first();

            if ($deptManager) {
                $this->notifyUser(
                    $deptManager->id,
                    Notification::TYPE_DEMANDE_TRAITEE_STOCK,
                    $title,
                    "La demande #{$demandeId} de votre département a été traitée par le stock : {$summary}",
                    ['demande_id' => $demandeId, 'statut' => $finalStatut],
                    "/all-requests/{$demandeId}"
                );
            }
        }
    }

    /**
     * E) Stock manager marks as delivered.
     *    → Notify employee
     *    → Notify dept manager (optional, default true)
     */
    public function onDemandeLivree(
        int $demandeId,
        int $demandeurId,
        int $departementId,
        bool $notifyDept = true
    ): void {
        $this->notifyUser(
            $demandeurId,
            Notification::TYPE_DEMANDE_LIVREE,
            'Demande livrée 🎉',
            "Votre demande #{$demandeId} a été marquée comme livrée. Vous pouvez récupérer vos articles.",
            ['demande_id' => $demandeId],
            "/my-requests/{$demandeId}"
        );

        if ($notifyDept) {
            $deptManager = User::where('is_active', true)
                ->where('departement_id', $departementId)
                ->whereHas('role', fn($q) => $q->whereRaw("LOWER(TRIM(nom)) = 'responsable departement'"))
                ->first();

            if ($deptManager) {
                $this->notifyUser(
                    $deptManager->id,
                    Notification::TYPE_DEMANDE_LIVREE,
                    "Demande #{$demandeId} livrée",
                    "La demande #{$demandeId} de votre département a été livrée.",
                    ['demande_id' => $demandeId],
                    "/all-requests/{$demandeId}"
                );
            }
        }
    }

    /**
     * F) Stock alert — notifies all responsable stock users.
     *    Anti-spam: only once per Produit per calendar day.
     */
    public function onAlerteStock(
        int $ProduitId,
        string $ProduitNom,
        int $quantite,
        int $seuilAlerte
    ): void {
        // Anti-spam: check if already notified today
        $alreadyNotified = \App\Models\StockAlertLog::where('Produit_id', $ProduitId)
            ->where('notified_at', '>=', now()->startOfDay())
            ->exists();

        if ($alreadyNotified) {
            return;
        }

        $this->notifyRole(
            'responsable stock',
            Notification::TYPE_ALERTE_STOCK,
            "Alerte stock : {$ProduitNom}",
            "Le Produit \"{$ProduitNom}\" est en dessous du seuil d'alerte (stock : {$quantite} / seuil : {$seuilAlerte}).",
            ['Produit_id' => $ProduitId, 'quantite' => $quantite, 'seuil_alerte' => $seuilAlerte],
            "/produits?alert=1"
        );

        // Record the alert to prevent duplicate notifications today
        \App\Models\StockAlertLog::create([
            'Produit_id'   => $ProduitId,
            'notified_at'  => now(),
        ]);
    }
}