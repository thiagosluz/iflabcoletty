<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class NotificationController extends Controller
{
    public function __construct()
    {
        // All notification routes require authentication, permissions are checked in methods
    }

    #[OA\Get(
        path: "/api/v1/notifications",
        summary: "Listar notificações do usuário",
        tags: ["Notificações"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "per_page", in: "query", required: false, schema: new OA\Schema(type: "integer", example: 20)),
            new OA\Parameter(name: "read", in: "query", required: false, schema: new OA\Schema(type: "boolean")),
            new OA\Parameter(name: "type", in: "query", required: false, schema: new OA\Schema(type: "string")),
        ],
        responses: [
            new OA\Response(response: 200, description: "Lista de notificações"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Não autorizado"),
        ]
    )]
    public function index(Request $request)
    {
        $user = auth()->user();
        
        if (!$user || !$user->can('notifications.view')) {
            return response()->json(['message' => 'Sem permissão para visualizar notificações'], 403);
        }
        
        $query = $user->notifications();

        // Filter by read status
        if ($request->has('read')) {
            $query->where('read', filter_var($request->read, FILTER_VALIDATE_BOOLEAN));
        }

        // Filter by type
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        $perPage = $request->query('per_page', 20);
        $perPage = min(max((int)$perPage, 5), 100);

        return $query->orderBy('created_at', 'desc')->paginate($perPage);
    }

    #[OA\Get(
        path: "/api/v1/notifications/unread-count",
        summary: "Obter contagem de notificações não lidas",
        tags: ["Notificações"],
        security: [["sanctum" => []]],
        responses: [
            new OA\Response(response: 200, description: "Contagem de notificações não lidas"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Não autorizado"),
        ]
    )]
    public function unreadCount()
    {
        $user = auth()->user();
        
        if (!$user) {
            return response()->json(['message' => 'Não autenticado'], 401);
        }
        
        // Check permission using Spatie Permission directly
        if (!$user->can('notifications.view')) {
            return response()->json(['message' => 'Sem permissão para visualizar notificações'], 403);
        }
        
        $count = $user->unreadNotificationsCount();

        return response()->json(['count' => $count]);
    }

    #[OA\Get(
        path: "/api/v1/notifications/{id}",
        summary: "Obter detalhes da notificação",
        tags: ["Notificações"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        responses: [
            new OA\Response(response: 200, description: "Detalhes da notificação"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Não autorizado"),
            new OA\Response(response: 404, description: "Notificação não encontrada"),
        ]
    )]
    public function show(Notification $notification)
    {
        $user = auth()->user();
        
        if (!$user || !$user->can('notifications.view')) {
            return response()->json(['message' => 'Sem permissão para visualizar notificações'], 403);
        }
        
        // Ensure user can only access their own notifications
        if ($notification->user_id !== $user->id) {
            return response()->json(['message' => 'Não autorizado'], 403);
        }

        return response()->json($notification);
    }

    #[OA\Put(
        path: "/api/v1/notifications/{id}/read",
        summary: "Marcar notificação como lida",
        tags: ["Notificações"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        responses: [
            new OA\Response(response: 200, description: "Notificação marcada como lida"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Não autorizado"),
            new OA\Response(response: 404, description: "Notificação não encontrada"),
        ]
    )]
    public function markAsRead(Notification $notification)
    {
        $user = auth()->user();
        
        if (!$user || !$user->can('notifications.update')) {
            return response()->json(['message' => 'Sem permissão para atualizar notificações'], 403);
        }
        
        // Ensure user can only access their own notifications
        if ($notification->user_id !== $user->id) {
            return response()->json(['message' => 'Não autorizado'], 403);
        }

        $notification->markAsRead();

        return response()->json($notification);
    }

    #[OA\Put(
        path: "/api/v1/notifications/{id}/unread",
        summary: "Marcar notificação como não lida",
        tags: ["Notificações"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        responses: [
            new OA\Response(response: 200, description: "Notificação marcada como não lida"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Não autorizado"),
            new OA\Response(response: 404, description: "Notificação não encontrada"),
        ]
    )]
    public function markAsUnread(Notification $notification)
    {
        $user = auth()->user();
        
        if (!$user || !$user->can('notifications.update')) {
            return response()->json(['message' => 'Sem permissão para atualizar notificações'], 403);
        }
        
        // Ensure user can only access their own notifications
        if ($notification->user_id !== $user->id) {
            return response()->json(['message' => 'Não autorizado'], 403);
        }

        $notification->markAsUnread();

        return response()->json($notification);
    }

    #[OA\Post(
        path: "/api/v1/notifications/mark-all-read",
        summary: "Marcar todas as notificações como lidas",
        tags: ["Notificações"],
        security: [["sanctum" => []]],
        responses: [
            new OA\Response(response: 200, description: "Todas as notificações marcadas como lidas"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Não autorizado"),
        ]
    )]
    public function markAllAsRead()
    {
        $user = auth()->user();
        
        if (!$user || !$user->can('notifications.update')) {
            return response()->json(['message' => 'Sem permissão para atualizar notificações'], 403);
        }
        
        $count = $user->notifications()
            ->where('read', false)
            ->update([
                'read' => true,
                'read_at' => now(),
            ]);

        return response()->json([
            'message' => "{$count} notificações marcadas como lidas",
            'count' => $count,
        ]);
    }

    #[OA\Delete(
        path: "/api/v1/notifications/{id}",
        summary: "Excluir notificação",
        tags: ["Notificações"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        responses: [
            new OA\Response(response: 204, description: "Notificação excluída"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Não autorizado"),
            new OA\Response(response: 404, description: "Notificação não encontrada"),
        ]
    )]
    public function destroy(Notification $notification)
    {
        $user = auth()->user();
        
        if (!$user || !$user->can('notifications.delete')) {
            return response()->json(['message' => 'Sem permissão para excluir notificações'], 403);
        }
        
        // Ensure user can only delete their own notifications
        if ($notification->user_id !== $user->id) {
            return response()->json(['message' => 'Não autorizado'], 403);
        }

        $notification->delete();

        return response()->noContent();
    }

    #[OA\Post(
        path: "/api/v1/notifications/delete-multiple",
        summary: "Excluir múltiplas notificações",
        tags: ["Notificações"],
        security: [["sanctum" => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ["ids"],
                properties: [
                    new OA\Property(property: "ids", type: "array", items: new OA\Items(type: "integer"), example: [1, 2, 3]),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: "Notificações excluídas"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Não autorizado"),
        ]
    )]
    public function deleteMultiple(Request $request)
    {
        $user = auth()->user();
        
        if (!$user || !$user->can('notifications.delete')) {
            return response()->json(['message' => 'Sem permissão para excluir notificações'], 403);
        }

        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'required|integer|exists:notifications,id',
        ]);

        // Only delete notifications that belong to the authenticated user
        $deleted = $user->notifications()
            ->whereIn('id', $validated['ids'])
            ->delete();

        return response()->json([
            'message' => "{$deleted} notificações excluídas",
            'count' => $deleted,
        ]);
    }

    #[OA\Post(
        path: "/api/v1/notifications/delete-all",
        summary: "Excluir todas as notificações do usuário",
        tags: ["Notificações"],
        security: [["sanctum" => []]],
        responses: [
            new OA\Response(response: 200, description: "Todas as notificações excluídas"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 403, description: "Não autorizado"),
        ]
    )]
    public function deleteAll()
    {
        $user = auth()->user();
        
        if (!$user || !$user->can('notifications.delete')) {
            return response()->json(['message' => 'Sem permissão para excluir notificações'], 403);
        }

        $count = $user->notifications()->count();
        $user->notifications()->delete();

        return response()->json([
            'message' => "{$count} notificações excluídas",
            'count' => $count,
        ]);
    }
}
