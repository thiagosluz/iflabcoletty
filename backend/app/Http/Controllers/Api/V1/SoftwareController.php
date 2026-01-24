<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Software;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class SoftwareController extends Controller
{
    #[OA\Get(
        path: "/api/v1/softwares",
        summary: "Listar softwares",
        tags: ["Softwares"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "search", in: "query", required: false, schema: new OA\Schema(type: "string")),
            new OA\Parameter(name: "per_page", in: "query", required: false, schema: new OA\Schema(type: "integer", example: 20)),
        ],
        responses: [
            new OA\Response(response: 200, description: "Lista de softwares"),
            new OA\Response(response: 401, description: "Não autenticado"),
        ]
    )]
    public function index(Request $request)
    {
        $this->authorize('softwares.view');

        $query = Software::withCount('computers');

        // Search
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('version', 'like', "%{$search}%")
                    ->orWhere('vendor', 'like', "%{$search}%");
            });
        }

        // Pagination
        $perPage = $request->query('per_page', 20);
        $perPage = min(max((int)$perPage, 5), 100); // Limit between 5 and 100

        return $query->orderBy('name')->paginate($perPage);
    }

    #[OA\Get(
        path: "/api/v1/softwares/{id}",
        summary: "Obter detalhes do software",
        tags: ["Softwares"],
        security: [["sanctum" => []]],
        parameters: [
            new OA\Parameter(name: "id", in: "path", required: true, schema: new OA\Schema(type: "integer")),
        ],
        responses: [
            new OA\Response(response: 200, description: "Detalhes do software"),
            new OA\Response(response: 401, description: "Não autenticado"),
            new OA\Response(response: 404, description: "Software não encontrado"),
        ]
    )]
    public function show(Software $software)
    {
        $this->authorize('softwares.view');

        // Optimized: Eager load computers with lab to avoid N+1 queries
        return $software->load(['computers.lab:id,name']);
    }
}
