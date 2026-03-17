<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationsController extends Controller
{
    // ── GET /api/notifications ────────────────────────────────────────────────
    // Query params:
    //   unread=1          → only unread
    //   per_page=20       → pagination size (max 100)
    public function index(Request $request)
    {
        $userId  = $request->user()->id;
        $perPage = min((int) $request->query('per_page', 20), 100);

        $query = Notification::forUser($userId)
            ->orderByDesc('created_at');

        if ($request->query('unread') === '1') {
            $query->unread();
        }

        $paginated = $query->paginate($perPage);

        return response()->json([
            'data'         => $paginated->map(fn($n) => $this->format($n)),
            'total'        => $paginated->total(),
            'current_page' => $paginated->currentPage(),
            'last_page'    => $paginated->lastPage(),
        ]);
    }

    // ── GET /api/notifications/unread-count ───────────────────────────────────
    public function unreadCount(Request $request)
    {
        $count = Notification::forUser($request->user()->id)->unread()->count();
        return response()->json(['count' => $count]);
    }

    // ── POST /api/notifications/{notification}/read ───────────────────────────
    public function markRead(Request $request, Notification $notification)
    {
        $this->authorizeOwner($notification, $request->user()->id);

        if (!$notification->is_read) {
            $notification->update([
                'is_read' => true,
                'read_at' => now(),
            ]);
        }

        return response()->json($this->format($notification));
    }

    // ── POST /api/notifications/read-all ─────────────────────────────────────
    public function markAllRead(Request $request)
    {
        Notification::forUser($request->user()->id)
            ->unread()
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return response()->json(['message' => 'Toutes les notifications ont été marquées comme lues.']);
    }

    // ── DELETE /api/notifications/{notification} ──────────────────────────────
    public function destroy(Request $request, Notification $notification)
    {
        $this->authorizeOwner($notification, $request->user()->id);
        $notification->delete();
        return response()->json(['message' => 'Notification supprimée.']);
    }

    // ── DELETE /api/notifications (bulk clear) ────────────────────────────────
    public function destroyAll(Request $request)
    {
        Notification::forUser($request->user()->id)->delete();
        return response()->json(['message' => 'Toutes les notifications supprimées.']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authorizeOwner(Notification $notification, int $userId): void
    {
        if ($notification->recipient_user_id !== $userId) {
            abort(403, 'Non autorisé.');
        }
    }

    private function format(Notification $n): array
    {
        return [
            'id'         => $n->id,
            'type'       => $n->type,
            'title'      => $n->title,
            'message'    => $n->message,
            'data'       => $n->data,
            'link'       => $n->link,
            'is_read'    => $n->is_read,
            'read_at'    => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at->toIso8601String(),
        ];
    }
}