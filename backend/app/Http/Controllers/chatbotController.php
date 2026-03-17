<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Demande;
use App\Models\Produit;
use App\Models\User;

class ChatbotController extends Controller
{
    private const MAX_HISTORY = 10;

    // ── Entry point ───────────────────────────────────────────────────────────

    public function message(Request $request)
    {
        $request->validate([
            'message'           => 'required|string|max:2000',
            'history'           => 'nullable|array|max:20',
            'history.*.role'    => 'required|in:user,assistant',
            'history.*.content' => 'required|string|max:4000',
        ]);

        $user    = $request->user();
        $role    = strtolower(trim($user->role->nom ?? 'employé'));
        $history = collect($request->input('history', []))
            ->slice(-self::MAX_HISTORY)
            ->values()
            ->toArray();

        $messages = array_merge(
            [['role' => 'system', 'content' => $this->buildSystemPrompt($user, $role)]],
            $history,
            [['role' => 'user', 'content' => $request->message]]
        );

        // ── 1st API call: let the AI decide if it needs a tool ────────────────
        $tools    = $this->buildTools($role);
        $response = $this->callGroq($messages, $tools);

        if (!$response) {
            return response()->json([
                'message' => 'Le service est temporairement indisponible. Veuillez réessayer.',
            ], 503);
        }

        $choice = $response->json('choices.0');

        // ── If the AI wants to call a tool ────────────────────────────────────
        if (($choice['finish_reason'] ?? '') === 'tool_calls') {

            $toolCalls = $choice['message']['tool_calls'] ?? [];

            // Append the assistant's tool_call message to history
            $messages[] = $choice['message'];

            // Execute each tool and append results
            foreach ($toolCalls as $toolCall) {
                $functionName = $toolCall['function']['name'];
                // json_decode can return null if arguments is empty string or null — always fallback to []
                $arguments    = json_decode($toolCall['function']['arguments'] ?? '{}', true) ?? [];
                $toolResult   = $this->executeFunction($functionName, $arguments, $user, $role);

                $messages[] = [
                    'role'         => 'tool',
                    'tool_call_id' => $toolCall['id'],
                    'content'      => json_encode($toolResult),
                ];
            }

            // ── 2nd API call: AI formulates final answer with tool results ────
            $finalResponse = $this->callGroq($messages, $tools);

            if (!$finalResponse) {
                return response()->json([
                    'message' => 'Le service est temporairement indisponible. Veuillez réessayer.',
                ], 503);
            }

            $content = $finalResponse->json('choices.0.message.content', '...');

        } else {
            // No tool needed — direct answer
            $content = $choice['message']['content'] ?? '...';
        }

        return response()->json(['reply' => $content]);
    }

    // ── Groq API call ─────────────────────────────────────────────────────────

    private function callGroq(array $messages, array $tools = [])
    {
        $payload = [
            'model'       => 'openai/gpt-oss-120b',
            'messages'    => $messages,
            'max_tokens'  => 1024,
            'temperature' => 0.4,
        ];

        if (!empty($tools)) {
            $payload['tools']       = $tools;
            $payload['tool_choice'] = 'auto';
        }

        try {
            $response = Http::withoutVerifying()
                ->withHeaders([
                    'Authorization' => 'Bearer ' . config('services.groq.key'),
                    'Content-Type'  => 'application/json',
                ])
                ->timeout(30)
                ->post('https://api.groq.com/openai/v1/chat/completions', $payload);
        } catch (\Exception $e) {
            Log::error('Chatbot Groq connection error', ['error' => $e->getMessage()]);
            return null;
        }

        if ($response->failed()) {
            Log::error('Chatbot Groq API error', [
                'status' => $response->status(),
                'body'   => $response->body(),
                'error'  => $response->json('error.message') ?? $response->json('error') ?? 'unknown',
            ]);
            return null;
        }

        if (!$response->json('choices')) {
            Log::error('Chatbot Groq unexpected response', ['body' => $response->body()]);
            return null;
        }

        return $response;
    }

    // ── Tool definitions sent to Groq ─────────────────────────────────────────

    private function buildTools(string $role): array
    {
        $tools = [];

        // ── Available to ALL roles ────────────────────────────────────────────

        $tools[] = [
            'type'     => 'function',
            'function' => [
                'name'        => 'get_my_demandes',
                'description' => 'Get the current user\'s own supply requests (demandes) with their status, products, and dates. Use when the user asks about their own requests or orders.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'statut' => [
                            'type'        => 'string',
                            'description' => 'Optional: filter by status. Values: EN_ATTENTE_DEPT, EN_ATTENTE_STOCK, VALIDEE, LIVREE, REFUSEE_DEPT, REFUSEE_STOCK',
                        ],
                        'limit' => [
                            'type'        => 'integer',
                            'description' => 'How many demandes to return. Default 10, max 20.',
                        ],
                    ],
                    'required' => [],
                ],
            ],
        ];

        $tools[] = [
            'type'     => 'function',
            'function' => [
                'name'        => 'get_demande_detail',
                'description' => 'Get full details of a specific demande by its ID number. Use when the user mentions a specific demande number like "demande #7" or "ma demande numéro 3".',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'id_demande' => [
                            'type'        => 'integer',
                            'description' => 'The numeric ID of the demande',
                        ],
                    ],
                    'required' => ['id_demande'],
                ],
            ],
        ];

        $tools[] = [
            'type'     => 'function',
            'function' => [
                'name'        => 'get_stock_produits',
                'description' => 'Get the product catalogue with current stock quantities and alert thresholds. Use when the user asks about available products, stock levels, or low stock items.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'en_alerte' => [
                            'type'        => 'boolean',
                            'description' => 'If true, return only products below their alert threshold (low stock)',
                        ],
                        'categorie' => [
                            'type'        => 'string',
                            'description' => 'Optional: filter by category name',
                        ],
                    ],
                    'required' => [],
                ],
            ],
        ];

        // ── Chef département + Admin ──────────────────────────────────────────

        if (in_array($role, ['responsable departement', 'admin'])) {

            $tools[] = [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_dept_demandes',
                    'description' => 'Get all supply requests from the user\'s department. Use when a department manager asks about their team\'s requests.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'statut' => [
                                'type'        => 'string',
                                'description' => 'Optional: filter by status',
                            ],
                            'limit' => [
                                'type'        => 'integer',
                                'description' => 'Number of demandes to return. Default 15.',
                            ],
                        ],
                        'required' => [],
                    ],
                ],
            ];

            $tools[] = [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_dept_stats',
                    'description' => 'Get statistics for the user\'s department: total, pending, approved, refused demande counts.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => (object) [],
                        'required'   => [],
                    ],
                ],
            ];
        }

        // ── Responsable stock + Admin ─────────────────────────────────────────

        if (in_array($role, ['responsable stock', 'admin'])) {

            $tools[] = [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_stock_stats',
                    'description' => 'Get stock management statistics: total active products, products in alert, demandes awaiting stock validation, delivered demandes.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => (object) [],
                        'required'   => [],
                    ],
                ],
            ];

            $tools[] = [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_mouvements',
                    'description' => 'Get recent stock movements (entries and exits). Use when the user asks about recent stock activity or deliveries.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'limit' => [
                                'type'        => 'integer',
                                'description' => 'Number of movements to return. Default 10.',
                            ],
                            'type' => [
                                'type'        => 'string',
                                'description' => 'Filter by type: entree (stock in) or sortie (stock out)',
                            ],
                        ],
                        'required' => [],
                    ],
                ],
            ];
        }

        // ── Admin only ────────────────────────────────────────────────────────

        if ($role === 'admin') {

            $tools[] = [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_all_dept_stats',
                    'description' => 'Get demande statistics broken down by each department. Use when admin asks how many demandes per department or wants a department-by-department overview.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => (object) [],
                        'required'   => [],
                    ],
                ],
            ];

            $tools[] = [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_global_stats',
                    'description' => 'Get platform-wide statistics: total users, demandes by status, total products, total departments.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => (object) [],
                        'required'   => [],
                    ],
                ],
            ];

            $tools[] = [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_audit_logs',
                    'description' => 'Get recent audit log entries showing who performed what actions and when.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'limit' => [
                                'type'        => 'integer',
                                'description' => 'Number of log entries to return. Default 10.',
                            ],
                            'action' => [
                                'type'        => 'string',
                                'description' => 'Filter by action: INSERT, UPDATE, DELETE',
                            ],
                        ],
                        'required' => [],
                    ],
                ],
            ];

            $tools[] = [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_all_demandes',
                    'description' => 'Get all demandes across all departments. Admin use only.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'statut' => [
                                'type'        => 'string',
                                'description' => 'Optional: filter by status',
                            ],
                            'limit' => [
                                'type'        => 'integer',
                                'description' => 'Number of demandes. Default 15, max 30.',
                            ],
                        ],
                        'required' => [],
                    ],
                ],
            ];
        }

        return $tools;
    }

    // ── Function router ───────────────────────────────────────────────────────

    private function executeFunction(string $name, array $args, $user, string $role): array
    {
        try {
            return match ($name) {
                'get_my_demandes'    => $this->fnGetMyDemandes($user, $args),
                'get_demande_detail' => $this->fnGetDemandeDetail($user, $role, $args),
                'get_stock_produits' => $this->fnGetStockProduits($args),
                'get_dept_demandes'  => $this->fnGetDeptDemandes($user, $args),
                'get_dept_stats'     => $this->fnGetDeptStats($user),
                'get_stock_stats'    => $this->fnGetStockStats(),
                'get_mouvements'     => $this->fnGetMouvements($args),
                'get_global_stats'   => $this->fnGetGlobalStats(),
                'get_all_dept_stats' => $this->fnGetAllDeptStats(),
                'get_audit_logs'     => $this->fnGetAuditLogs($args),
                'get_all_demandes'   => $this->fnGetAllDemandes($args),
                default              => ['error' => "Unknown function: {$name}"],
            };
        } catch (\Exception $e) {
            Log::error("Chatbot function error: {$name}", ['error' => $e->getMessage()]);
            return ['error' => 'Could not fetch data: ' . $e->getMessage()];
        }
    }

    // ── DB query functions ────────────────────────────────────────────────────

    private function fnGetMyDemandes($user, array $args): array
    {
        $limit = min($args['limit'] ?? 10, 20);
        $query = Demande::with(['details.Produit'])
            ->where('id_demandeur', $user->id)
            ->orderByDesc('date_demande')
            ->limit($limit);

        if (!empty($args['statut'])) {
            $query->where('statut', $args['statut']);
        }

        $results = $query->get()->map(fn($d) => [
            'id'          => $d->id_demande,
            'statut'      => $d->statut,
            'date'        => $d->date_demande?->format('Y-m-d H:i'),
            'commentaire' => $d->commentaire,
            'produits'    => $d->details->map(fn($det) => [
                'nom'      => $det->Produit?->nom_produit ?? 'Produit inconnu',
                'quantite' => $det->quantite,
                'statut'   => $det->statut,
            ])->toArray(),
        ])->toArray();

        return [
            'count'    => count($results),
            'demandes' => $results,
        ];
    }

    private function fnGetDemandeDetail($user, string $role, array $args): array
    {
        if (empty($args['id_demande'])) {
            return ['error' => 'id_demande is required'];
        }

        $demande = Demande::with([
            'details.Produit',
            'demandeur.departement',
            'responsableDept',
            'responsableStock',
        ])->find($args['id_demande']);

        if (!$demande) {
            return ['error' => "Demande #{$args['id_demande']} introuvable"];
        }

        // Employees can only see their own demandes
        if ($role === 'employé' && $demande->id_demandeur !== $user->id) {
            return ['error' => 'Accès refusé : cette demande ne vous appartient pas'];
        }

        return [
            'id'                    => $demande->id_demande,
            'statut'                => $demande->statut,
            'date_demande'          => $demande->date_demande?->format('Y-m-d H:i'),
            'commentaire'           => $demande->commentaire,
            'demandeur'             => $demande->demandeur?->prenom . ' ' . $demande->demandeur?->nom,
            'departement'           => $demande->demandeur?->departement?->nom,
            'responsable_dept'      => $demande->responsableDept
                ? $demande->responsableDept->prenom . ' ' . $demande->responsableDept->nom
                : null,
            'responsable_stock'     => $demande->responsableStock
                ? $demande->responsableStock->prenom . ' ' . $demande->responsableStock->nom
                : null,
            'date_validation_dept'  => $demande->date_validation_dept?->format('Y-m-d H:i'),
            'date_validation_stock' => $demande->date_validation_stock?->format('Y-m-d H:i'),
            'produits'              => $demande->details->map(fn($det) => [
                'nom'          => $det->Produit?->nom_produit ?? 'Produit inconnu',
                'reference'    => $det->Produit?->reference,
                'quantite'     => $det->quantite,
                'statut_ligne' => $det->statut,
            ])->toArray(),
        ];
    }

    private function fnGetStockProduits(array $args): array
    {
        $query = Produit::with('categorie')
            ->where('is_active', true)
            ->orderBy('nom_produit');

        if (!empty($args['en_alerte']) && $args['en_alerte'] === true) {
            $query->whereRaw('quantite <= seuil_alerte');
        }

        if (!empty($args['categorie'])) {
            $query->whereHas('categorie', fn($q) =>
                $q->where('nom', 'like', '%' . $args['categorie'] . '%')
            );
        }

        $results = $query->get()->map(fn($p) => [
            'id'           => $p->id_produit,
            'nom'          => $p->nom_produit,
            'reference'    => $p->reference,
            'categorie'    => $p->categorie?->nom ?? '—',
            'quantite'     => $p->quantite,
            'seuil_alerte' => $p->seuil_alerte,
            'en_alerte'    => $p->quantite <= $p->seuil_alerte,
        ])->toArray();

        return [
            'count'    => count($results),
            'produits' => $results,
        ];
    }

    private function fnGetDeptDemandes($user, array $args): array
    {
        $limit = min($args['limit'] ?? 15, 30);
        $query = Demande::with(['details.Produit', 'demandeur'])
            ->whereHas('demandeur', fn($q) =>
                $q->where('departement_id', $user->departement_id)
            )
            ->orderByDesc('date_demande')
            ->limit($limit);

        if (!empty($args['statut'])) {
            $query->where('statut', $args['statut']);
        }

        $results = $query->get()->map(fn($d) => [
            'id'        => $d->id_demande,
            'statut'    => $d->statut,
            'date'      => $d->date_demande?->format('Y-m-d H:i'),
            'demandeur' => $d->demandeur?->prenom . ' ' . $d->demandeur?->nom,
            'produits'  => $d->details->map(fn($det) => [
                'nom'      => $det->Produit?->nom_produit ?? '?',
                'quantite' => $det->quantite,
            ])->toArray(),
        ])->toArray();

        return [
            'count'    => count($results),
            'demandes' => $results,
        ];
    }

    private function fnGetDeptStats($user): array
    {
        $base = Demande::whereHas('demandeur', fn($q) =>
            $q->where('departement_id', $user->departement_id)
        );

        return [
            'total'            => (clone $base)->count(),
            'en_attente_dept'  => (clone $base)->where('statut', 'EN_ATTENTE_DEPT')->count(),
            'en_attente_stock' => (clone $base)->where('statut', 'EN_ATTENTE_STOCK')->count(),
            'validees'         => (clone $base)->whereIn('statut', ['VALIDEE', 'PARTIELLEMENT_VALIDEE'])->count(),
            'livrees'          => (clone $base)->where('statut', 'LIVREE')->count(),
            'refusees_dept'    => (clone $base)->where('statut', 'REFUSEE_DEPT')->count(),
            'refusees_stock'   => (clone $base)->where('statut', 'REFUSEE_STOCK')->count(),
        ];
    }

    private function fnGetStockStats(): array
    {
        return [
            'total_produits_actifs'     => Produit::where('is_active', true)->count(),
            'produits_en_alerte'        => Produit::where('is_active', true)
                                            ->whereRaw('quantite <= seuil_alerte')->count(),
            'demandes_en_attente_stock' => Demande::where('statut', 'EN_ATTENTE_STOCK')->count(),
            'demandes_validees'         => Demande::whereIn('statut', ['VALIDEE', 'PARTIELLEMENT_VALIDEE'])->count(),
            'demandes_livrees'          => Demande::where('statut', 'LIVREE')->count(),
        ];
    }

    private function fnGetMouvements(array $args): array
    {
        $limit = min($args['limit'] ?? 10, 30);

        $query = \App\Models\MouvementStock::with(['Produit', 'user'])
            ->orderByDesc('date_mouvement')
            ->limit($limit);

        // MouvementStock uses 'IN' / 'OUT' — map friendly names
        if (!empty($args['type'])) {
            $typeMap = ['entree' => 'IN', 'sortie' => 'OUT', 'in' => 'IN', 'out' => 'OUT'];
            $mapped  = $typeMap[strtolower($args['type'])] ?? strtoupper($args['type']);
            $query->where('type_mouvement', $mapped);
        }

        return [
            'mouvements' => $query->get()->map(fn($m) => [
                'id'             => $m->id,
                'type'           => $m->type_mouvement === 'IN' ? 'Entrée stock' : 'Sortie stock',
                'produit'        => $m->Produit?->nom_produit ?? '?',
                'quantite'       => $m->quantite_mouvement,
                'quantite_avant' => $m->quantite_avant,
                'quantite_apres' => $m->quantite_apres,
                'date'           => $m->date_mouvement?->format('Y-m-d'),
                'par'            => $m->user
                    ? $m->user->prenom . ' ' . $m->user->nom
                    : null,
                'note'           => $m->note,
            ])->toArray(),
        ];
    }

    private function fnGetAllDeptStats(): array
    {
        $departements = \App\Models\Departement::all();

        $stats = $departements->map(function ($dept) {
            $base = Demande::whereHas('demandeur', fn($q) =>
                $q->where('departement_id', $dept->id)
            );

            return [
                'departement'      => $dept->nom,
                'total'            => (clone $base)->count(),
                'en_attente_dept'  => (clone $base)->where('statut', 'EN_ATTENTE_DEPT')->count(),
                'en_attente_stock' => (clone $base)->where('statut', 'EN_ATTENTE_STOCK')->count(),
                'validees'         => (clone $base)->whereIn('statut', ['VALIDEE', 'PARTIELLEMENT_VALIDEE'])->count(),
                'livrees'          => (clone $base)->where('statut', 'LIVREE')->count(),
                'refusees'         => (clone $base)->whereIn('statut', ['REFUSEE_DEPT', 'REFUSEE_STOCK'])->count(),
            ];
        })->toArray();

        return [
            'total_departements' => $departements->count(),
            'stats_par_dept'     => $stats,
        ];
    }

    private function fnGetGlobalStats(): array
    {
        return [
            'total_utilisateurs'  => User::count(),
            'utilisateurs_actifs' => User::where('is_active', true)->count(),
            'total_demandes'      => Demande::count(),
            'demandes_par_statut' => [
                'EN_ATTENTE_DEPT'       => Demande::where('statut', 'EN_ATTENTE_DEPT')->count(),
                'EN_ATTENTE_STOCK'      => Demande::where('statut', 'EN_ATTENTE_STOCK')->count(),
                'VALIDEE'               => Demande::where('statut', 'VALIDEE')->count(),
                'PARTIELLEMENT_VALIDEE' => Demande::where('statut', 'PARTIELLEMENT_VALIDEE')->count(),
                'LIVREE'                => Demande::where('statut', 'LIVREE')->count(),
                'REFUSEE_DEPT'          => Demande::where('statut', 'REFUSEE_DEPT')->count(),
                'REFUSEE_STOCK'         => Demande::where('statut', 'REFUSEE_STOCK')->count(),
            ],
            'total_produits_actifs' => Produit::where('is_active', true)->count(),
            'total_departements'    => \App\Models\Departement::count(),
        ];
    }

    private function fnGetAuditLogs(array $args): array
    {
        $limit = min($args['limit'] ?? 10, 30);

        // Historique uses id_historique PK, id_utilisateur FK, type_action, table_modifiee
        $query = \App\Models\Historique::with('user')
            ->orderByDesc('date_action')
            ->limit($limit);

        if (!empty($args['action'])) {
            $query->where('type_action', strtoupper($args['action']));
        }

        return [
            'logs' => $query->get()->map(fn($h) => [
                'id'          => $h->id_historique,
                'action'      => $h->type_action,
                'table'       => $h->table_modifiee,
                'description' => $h->description,
                'reference'   => $h->reference_objet,
                'par'         => $h->user
                    ? $h->user->prenom . ' ' . $h->user->nom
                    : 'Système',
                'date'        => $h->date_action?->format('Y-m-d H:i'),
            ])->toArray(),
        ];
    }

    private function fnGetAllDemandes(array $args): array
    {
        $limit   = min($args['limit'] ?? 15, 30);
        $query   = Demande::with(['details', 'demandeur.departement'])
            ->orderByDesc('date_demande')
            ->limit($limit);

        if (!empty($args['statut'])) {
            $query->where('statut', $args['statut']);
        }

        $results = $query->get()->map(fn($d) => [
            'id'          => $d->id_demande,
            'statut'      => $d->statut,
            'date'        => $d->date_demande?->format('Y-m-d H:i'),
            'demandeur'   => $d->demandeur?->prenom . ' ' . $d->demandeur?->nom,
            'departement' => $d->demandeur?->departement?->nom ?? '—',
            'nb_articles' => $d->details->count(),
        ])->toArray();

        return [
            'count'    => count($results),
            'demandes' => $results,
        ];
    }

    // ── System prompt ─────────────────────────────────────────────────────────

    private function buildSystemPrompt($user, string $role): string
    {
        $userName = "{$user->prenom} {$user->nom}";
        $isAdmin  = $role === 'admin';
        $deptLine = $isAdmin
            ? 'N/A (admin — access to all departments)'
            : ($user->departement?->nom ?? '—');

        return <<<PROMPT
You are a helpful assistant for a stock management platform.
User: {$userName} | Role: {$role} | Department: {$deptLine}

LANGUAGE: Always respond in the same language the user writes in.

RULES:
- Always call a tool for any data question — never invent numbers
- If a tool returns an error, respond politely, never show raw error text
- If data is empty, say so naturally
- Admin has no department — they manage the entire platform across all departments

ACCESS BY ROLE:
- employe: own demandes only
- responsable departement: their department demandes only
- responsable stock: stock data and EN_ATTENTE_STOCK demandes
- admin: full access to everything, all departments

TOOLS AVAILABLE:
- get_my_demandes     → own requests
- get_demande_detail  → specific demande by ID number
- get_stock_produits  → products and stock levels
- get_dept_demandes   → team requests (chef dept only)
- get_dept_stats      → department stats (chef dept only)
- get_stock_stats     → stock overview (responsable stock)
- get_mouvements      → recent stock movements
- get_all_dept_stats  → demandes broken down by ALL departments (admin only)
- get_global_stats    → full platform statistics (admin only)
- get_audit_logs      → audit trail, who did what (admin only)
- get_all_demandes    → all demandes across all departments (admin only)

WORKFLOW:
employe creates demande → EN_ATTENTE_DEPT → chef approves → EN_ATTENTE_STOCK → stock validates → VALIDEE → LIVREE
Chef own demandes go directly to EN_ATTENTE_STOCK (bypass dept step).
PROMPT;
    }
}