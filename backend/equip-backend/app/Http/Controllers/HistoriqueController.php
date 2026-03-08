<?php

namespace App\Http\Controllers;

use App\Models\Historique;
use Illuminate\Http\Request;

class HistoriqueController extends Controller
{
    /**
     * GET /api/admin/historiques
     * Query params:
     *  - table (optional)
     *  - type_action (optional)
     *  - user_id (optional)
     *  - q (optional) search in description
     *  - per_page (optional, default 30)
     */
    public function index(Request $request)
    {
        $query = Historique::with([
            'user:id,nom,prenom,email',
            'details:id_details,id_historique,champs_modifie,ancien_valeur,nouveau_valeur,info_detail,commentaire',
        ])->orderByDesc('date_action');

        if ($request->filled('table')) {
            $query->where('table_modifiee', $request->query('table'));
        }

        if ($request->filled('type_action')) {
            $query->where('type_action', $request->query('type_action'));
        }

        if ($request->filled('user_id')) {
            $query->where('id_utilisateur', (int) $request->query('user_id'));
        }

        if ($request->filled('q')) {
            $q = (string) $request->query('q');
            $query->where('description', 'like', "%{$q}%");
        }

        $perPage = (int) $request->query('per_page', 30);

        return response()->json(
            $query->paginate($perPage)->through(function (Historique $h) {
                return $this->format($h);
            })
        );
    }

    /**
     * GET /api/admin/historiques/{historique}
     */
    public function show(Historique $historique)
    {
        $historique->load([
            'user:id,nom,prenom,email',
            'details',
        ]);

        return response()->json($this->format($historique, true));
    }

    private function format(Historique $h, bool $withDetails = true): array
    {
        return [
            'id_historique'   => $h->id_historique,
            'date_action'     => optional($h->date_action)->format('Y-m-d H:i:s'),
            'type_action'     => $h->type_action,
            'table_modifiee'  => $h->table_modifiee,
            'description'     => $h->description,
            'reference_objet' => $h->reference_objet,
            'user'            => $h->user ? [
                'id'     => $h->user->id,
                'nom'    => $h->user->nom,
                'prenom' => $h->user->prenom,
                'email'  => $h->user->email,
            ] : null,
            'details'         => !$withDetails ? [] : $h->details->map(fn($d) => [
                'id_details'     => $d->id_details,
                'champs_modifie' => $d->champs_modifie,
                'ancien_valeur'  => $d->ancien_valeur,
                'nouveau_valeur' => $d->nouveau_valeur,
                'info_detail'    => $d->info_detail,
                'commentaire'    => $d->commentaire,
            ])->toArray(),
        ];
    }
}
