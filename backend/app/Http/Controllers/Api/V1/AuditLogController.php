<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class AuditLogController extends Controller
{
    #[OA\Get(
        path: "/api/v1/audit-logs",
        summary: "Listar logs de auditoria",
        tags: ["Auditoria"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "per_page", in: "query", required: false, schema: new OA\Schema(type: "integer", example: 20)),
            new OA\Parameter(name: "user_id", in: "query", required: false, schema: new OA\Schema(type: "integer")),
            new OA\Parameter(name: "action", in: "query", required: false, schema: new OA\Schema(type: "string", enum: ["create", "update", "delete", "view"])),
            new OA\Parameter(name: "resource_type", in: "query", required: false, schema: new OA\Schema(type: "string", example: "Lab")),
            new OA\Parameter(name: "resource_id", in: "query", required: false, schema: new OA\Schema(type: "integer")),
            new OA\Parameter(name: "date_from", in: "query", required: false, schema: new OA\Schema(type: "string", format: "date")),
            new OA\Parameter(name: "date_to", in: "query", required: false, schema: new OA\Schema(type: "string", format: "date")),
            new OA\Parameter(name: "search", in: "query", required: false, schema: new OA\Schema(type: "string")),
        ],
        responses: [
            new OA\Response(response: 200, description: "Lista de logs de auditoria"),
            new OA\Response(response: 401, description: "Não autenticado"),
        ]
    )]
    public function index(Request $request)
    {
        $this->authorize('audit-logs.view');

        $query = AuditLog::with('user:id,name,email');

        // Filter by user
        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        // Filter by action
        if ($request->has('action')) {
            $query->where('action', $request->action);
        }

        // Filter by resource type
        if ($request->has('resource_type')) {
            $query->where('resource_type', $request->resource_type);
        }

        // Filter by resource ID
        if ($request->has('resource_id')) {
            $query->where('resource_id', $request->resource_id);
        }

        // Filter by date range
        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Search in description
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('action', 'like', "%{$search}%")
                  ->orWhere('resource_type', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($userQuery) use ($search) {
                      $userQuery->where('name', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

        // Pagination
        $perPage = $request->query('per_page', 20);
        $perPage = min(max((int)$perPage, 5), 100); // Limit between 5 and 100

        // Order by most recent first
        $logs = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return $logs;
    }

    #[OA\Get(
        path: "/api/v1/audit-logs/{id}",
        summary: "Obter detalhes de um log de auditoria",
        tags: ["Auditoria"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        responses: [
            new OA\Response(response: 200, description: "Detalhes do log de auditoria"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 404, description: "Log não encontrado"),
        ]
    )]
    public function show(string $id)
    {
        $this->authorize('audit-logs.view');

        $log = AuditLog::with('user:id,name,email')->findOrFail($id);

        return response()->json($log);
    }

    #[OA\Get(
        path: "/api/v1/audit-logs/stats",
        summary: "Obter estatísticas dos logs de auditoria",
        tags: ["Auditoria"],
        security: [["sanctum" => []]],
        responses: [
            new OA\Response(response: 200, description: "Estatísticas dos logs"),
            new OA\Response(response: 401, description: "Não autenticado"),
        ]
    )]
    public function stats()
    {
        $this->authorize('audit-logs.view');

        $stats = [
            'total_logs' => AuditLog::count(),
            'logs_today' => AuditLog::whereDate('created_at', today())->count(),
            'logs_this_week' => AuditLog::whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])->count(),
            'logs_this_month' => AuditLog::whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count(),
            'actions_count' => AuditLog::selectRaw('action, COUNT(*) as count')
                ->groupBy('action')
                ->pluck('count', 'action'),
            'resource_types_count' => AuditLog::selectRaw('resource_type, COUNT(*) as count')
                ->groupBy('resource_type')
                ->pluck('count', 'resource_type'),
            'most_active_users' => AuditLog::selectRaw('user_id, COUNT(*) as count')
                ->with('user:id,name,email')
                ->groupBy('user_id')
                ->orderBy('count', 'desc')
                ->limit(10)
                ->get()
                ->map(function ($log) {
                    return [
                        'user' => $log->user,
                        'count' => $log->count,
                    ];
                }),
        ];

        return response()->json($stats);
    }
}
