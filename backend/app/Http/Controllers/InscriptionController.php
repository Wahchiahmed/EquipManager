<?php

namespace App\Http\Controllers;

use App\Models\InscriptionDemande;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class InscriptionController extends Controller
{
    public function __construct(private AuditService $audit) {}

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/inscription  — public, no auth required
    // ─────────────────────────────────────────────────────────────────────────
    public function store(Request $request)
    {
        $request->validate([
            'nom'       => 'required|string|max:255',
            'prenom'    => 'required|string|max:255',
            'email'     => [
                'required', 'email',
                // unique across BOTH tables
                function ($attribute, $value, $fail) {
                    if (User::where('email', $value)->exists()) {
                        $fail('Cette adresse email est déjà utilisée.');
                    }
                    if (InscriptionDemande::where('email', $value)->where('statut', 'en_attente')->exists()) {
                        $fail('Une demande avec cette adresse email est déjà en attente.');
                    }
                },
            ],
            'password'  => 'required|string|min:6',
            'cin'       => [
                'nullable', 'string', 'max:20',
                function ($attribute, $value, $fail) {
                    if ($value && User::where('cin', $value)->exists()) {
                        $fail('Ce numéro CIN est déjà utilisé.');
                    }
                    if ($value && InscriptionDemande::where('cin', $value)->where('statut', 'en_attente')->exists()) {
                        $fail('Une demande avec ce CIN est déjà en attente.');
                    }
                },
            ],
            'telephone' => 'nullable|string|max:20',
            'role_id'   => 'required|exists:roles,id',
        ]);

        // Prevent inscriptions for admin role (role_id = 1 — adjust if needed)
        $role = Role::findOrFail($request->role_id);
        if (strtolower($role->nom) === 'admin') {
            return response()->json(['message' => 'Impossible de demander le rôle Administrateur.'], 422);
        }

        $demande = InscriptionDemande::create([
            'nom'       => $request->nom,
            'prenom'    => $request->prenom,
            'email'     => $request->email,
            'password'  => Hash::make($request->password),
            'cin'       => $request->cin,
            'telephone' => $request->telephone,
            'role_id'   => $request->role_id,
            'statut'    => 'en_attente',
        ]);

        return response()->json([
            'message' => 'Votre demande d\'inscription a été soumise. Vous recevrez un email après validation par un administrateur.',
            'id'      => $demande->id,
        ], 201);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/admin/inscriptions  — admin only
    // ─────────────────────────────────────────────────────────────────────────
    public function index(Request $request)
    {
        $statut = $request->query('statut', 'en_attente');

        $query = InscriptionDemande::with(['role', 'traitePar'])
            ->orderByRaw("CASE statut WHEN 'en_attente' THEN 0 ELSE 1 END")
            ->orderBy('created_at', 'desc');

        if ($statut !== 'all') {
            $query->where('statut', $statut);
        }

        $demandes = $query->get()->map(fn($d) => $this->format($d));

        return response()->json($demandes);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/admin/inscriptions/{id}/accepter  — admin only
    // ─────────────────────────────────────────────────────────────────────────
    public function accepter(Request $request, InscriptionDemande $inscriptionDemande)
    {
        $demande = $inscriptionDemande;

        if ($demande->statut !== 'en_attente') {
            return response()->json(['message' => 'Cette demande a déjà été traitée.'], 422);
        }

        // Check again for email/cin conflicts
        if (User::where('email', $demande->email)->exists()) {
            $demande->update(['statut' => 'refuse', 'commentaire_admin' => 'Email déjà utilisé par un autre compte.', 'traite_par' => $request->user()->id, 'traite_le' => now()]);
            return response()->json(['message' => 'Email déjà utilisé — demande refusée automatiquement.'], 422);
        }

        DB::transaction(function () use ($demande, $request) {
            // ── Create the user ────────────────────────────────────────────
            $user = User::create([
                'nom'            => $demande->nom,
                'prenom'         => $demande->prenom,
                'email'          => $demande->email,
                'password'       => $demande->password, // already hashed
                'cin'            => $demande->cin,
                'telephone'      => $demande->telephone,
                'role_id'        => $demande->role_id,
                'departement_id' => null,
                'is_active'      => true,
            ]);

            // ── Update demande status ──────────────────────────────────────
            $demande->update([
                'statut'            => 'accepte',
                'commentaire_admin' => $request->input('commentaire') ?? null,
                'traite_par'        => $request->user()->id,
                'traite_le'         => now(),
            ]);

            // ── Audit ──────────────────────────────────────────────────────
            $this->audit->log(
                userId:         $request->user()->id,
                tableModifiee:  'inscription_demandes',
                typeAction:     'ACTION',
                description:    "Inscription acceptée pour {$demande->prenom} {$demande->nom} ({$demande->email}) → user#{$user->id} créé",
                referenceObjet: "inscription#{$demande->id}",
                details: [[
                    'champs_modifie' => 'statut',
                    'ancien_valeur'  => 'en_attente',
                    'nouveau_valeur' => 'accepte',
                    'info_detail'    => "user#{$user->id} créé",
                    'commentaire'    => 'Demande acceptée',
                ]]
            );

            // ── Send acceptance email ──────────────────────────────────────
            $this->sendAcceptanceEmail($demande, $user);
        });

        return response()->json([
            'message'  => "Inscription de {$demande->prenom} {$demande->nom} acceptée. Compte créé et email envoyé.",
            'demande'  => $this->format($demande->fresh(['role', 'traitePar'])),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/admin/inscriptions/{id}/refuser  — admin only
    // ─────────────────────────────────────────────────────────────────────────
    public function refuser(Request $request, InscriptionDemande $inscriptionDemande)
    {
        $demande = $inscriptionDemande;

        if ($demande->statut !== 'en_attente') {
            return response()->json(['message' => 'Cette demande a déjà été traitée.'], 422);
        }

        $demande->update([
            'statut'            => 'refuse',
            'commentaire_admin' => $request->input('commentaire') ?? null,
            'traite_par'        => $request->user()->id,
            'traite_le'         => now(),
        ]);

        // ── Audit ──────────────────────────────────────────────────────────
        $this->audit->log(
            userId:         $request->user()->id,
            tableModifiee:  'inscription_demandes',
            typeAction:     'ACTION',
            description:    "Inscription refusée pour {$demande->prenom} {$demande->nom} ({$demande->email})",
            referenceObjet: "inscription#{$demande->id}",
            details: [[
                'champs_modifie' => 'statut',
                'ancien_valeur'  => 'en_attente',
                'nouveau_valeur' => 'refuse',
                'info_detail'    => "inscription#{$demande->id}",
                'commentaire'    => $request->input('commentaire') ?? 'Demande refusée',
            ]]
        );

        // ── Send refusal email ─────────────────────────────────────────────
        $this->sendRefusalEmail($demande);

        return response()->json([
            'message' => "Demande de {$demande->prenom} {$demande->nom} refusée. Email de notification envoyé.",
            'demande' => $this->format($demande->fresh(['role', 'traitePar'])),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/admin/inscriptions/stats
    // ─────────────────────────────────────────────────────────────────────────
    public function stats()
    {
        return response()->json([
            'en_attente' => InscriptionDemande::where('statut', 'en_attente')->count(),
            'acceptes'   => InscriptionDemande::where('statut', 'accepte')->count(),
            'refuses'    => InscriptionDemande::where('statut', 'refuse')->count(),
            'total'      => InscriptionDemande::count(),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/inscription/roles  — public, returns non-admin roles
    // ─────────────────────────────────────────────────────────────────────────
    public function roles()
    {
        $roles = Role::whereRaw("LOWER(nom) != 'admin'")->get(['id', 'nom']);
        return response()->json($roles);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private function format(InscriptionDemande $d): array
    {
        return [
            'id'                => $d->id,
            'nom'               => $d->nom,
            'prenom'            => $d->prenom,
            'email'             => $d->email,
            'cin'               => $d->cin,
            'telephone'         => $d->telephone,
            'role_id'           => $d->role_id,
            'role_nom'          => $d->role?->nom ?? '—',
            'statut'            => $d->statut,
            'commentaire_admin' => $d->commentaire_admin,
            'traite_par_nom'    => $d->traitePar ? "{$d->traitePar->prenom} {$d->traitePar->nom}" : null,
            'traite_le'         => $d->traite_le ? Carbon::parse($d->traite_le)->format('Y-m-d H:i') : null,
            'created_at'        => $d->created_at?->format('Y-m-d H:i'),
        ];
    }

    private function sendAcceptanceEmail(InscriptionDemande $demande, User $user): void
    {
        try {
            $appName = config('app.name', 'EquipManager');
            $loginUrl = config('app.frontend_url', 'http://localhost:5173') . '/login';

            Mail::html(
                $this->acceptanceEmailHtml($demande, $loginUrl, $appName),
                function ($message) use ($demande, $appName) {
                    $message
                        ->to($demande->email, "{$demande->prenom} {$demande->nom}")
                        ->subject("✅ Votre demande d'inscription a été acceptée — {$appName}");
                }
            );
        } catch (\Throwable $e) {
            // Log but don't fail the request
            Log::warning("Impossible d'envoyer l'email d'acceptation à {$demande->email}: " . $e->getMessage());
        }
    }

    private function sendRefusalEmail(InscriptionDemande $demande): void
    {
        try {
            $appName = config('app.name', 'EquipManager');

            Mail::html(
                $this->refusalEmailHtml($demande, $appName),
                function ($message) use ($demande, $appName) {
                    $message
                        ->to($demande->email, "{$demande->prenom} {$demande->nom}")
                        ->subject("❌ Votre demande d'inscription — {$appName}");
                }
            );
        } catch (\Throwable $e) {
            Log::warning("Impossible d'envoyer l'email de refus à {$demande->email}: " . $e->getMessage());
        }
    }

    private function acceptanceEmailHtml(InscriptionDemande $demande, string $loginUrl, string $appName): string
    {
        $nom    = htmlspecialchars("{$demande->prenom} {$demande->nom}");
        $email  = htmlspecialchars($demande->email);
        $role   = htmlspecialchars($demande->role?->nom ?? '');
        $comment = $demande->commentaire_admin ? '<p style="margin:0 0 16px;color:#6b7280;">Message de l\'administrateur : <em>' . htmlspecialchars($demande->commentaire_admin) . '</em></p>' : '';

        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:40px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">✅</div>
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Demande acceptée !</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">{$appName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;color:#111827;font-size:16px;">Bonjour <strong>{$nom}</strong>,</p>
            <p style="margin:0 0 24px;color:#374151;line-height:1.6;">
              Votre demande d'inscription à <strong>{$appName}</strong> a été <strong style="color:#16a34a;">acceptée</strong>. 
              Votre compte est maintenant actif.
            </p>
            {$comment}
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;margin-bottom:32px;">
              <tr>
                <td style="padding:20px;">
                  <p style="margin:0 0 8px;color:#166534;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Vos informations</p>
                  <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Email :</strong> {$email}</p>
                  <p style="margin:0;color:#374151;font-size:14px;"><strong>Rôle :</strong> {$role}</p>
                </td>
              </tr>
            </table>
            <div style="text-align:center;margin-bottom:32px;">
              <a href="{$loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
                Se connecter maintenant →
              </a>
            </div>
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              Si vous n'avez pas soumis cette demande, contactez notre support immédiatement.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">{$appName} · Système de gestion d'équipements</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }

    private function refusalEmailHtml(InscriptionDemande $demande, string $appName): string
    {
        $nom     = htmlspecialchars("{$demande->prenom} {$demande->nom}");
        $comment = $demande->commentaire_admin
            ? '<p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>Raison :</strong> ' . htmlspecialchars($demande->commentaire_admin) . '</p>'
            : '';

        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:40px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">❌</div>
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Demande non approuvée</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">{$appName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;color:#111827;font-size:16px;">Bonjour <strong>{$nom}</strong>,</p>
            <p style="margin:0 0 24px;color:#374151;line-height:1.6;">
              Votre demande d'inscription à <strong>{$appName}</strong> n'a pas pu être approuvée.
            </p>
            {$comment}
            <p style="margin:0 0 24px;color:#374151;line-height:1.6;">
              Pour toute question, veuillez contacter l'administrateur de la plateforme.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              {$appName} · Système de gestion d'équipements
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }
}