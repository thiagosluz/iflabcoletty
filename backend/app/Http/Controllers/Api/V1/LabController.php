<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Lab;
use App\Models\Software;
use App\Traits\LogsActivity;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class LabController extends Controller
{
    use LogsActivity;

    #[OA\Get(
        path: '/api/v1/labs',
        summary: 'Listar laboratórios',
        tags: ['Laboratórios'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', example: 20)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de laboratórios'),
            new OA\Response(response: 401, description: 'Não autenticado'),
        ]
    )]
    public function index(Request $request)
    {
        $this->authorize('labs.view');

        // Optimized: Select only necessary fields
        $query = Lab::select('id', 'name', 'description', 'created_at', 'updated_at')
            ->withCount('computers');

        // Pagination
        $perPage = $request->query('per_page', 20);
        $perPage = min(max((int) $perPage, 5), 100); // Limit between 5 and 100

        return $query->orderBy('name')->paginate($perPage);
    }

    #[OA\Post(
        path: '/api/v1/labs',
        summary: 'Criar laboratório',
        tags: ['Laboratórios'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Laboratório de Informática'),
                    new OA\Property(property: 'description', type: 'string', nullable: true, example: 'Descrição do laboratório'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Laboratório criado com sucesso'),
            new OA\Response(response: 401, description: 'Não autenticado'),
            new OA\Response(response: 422, description: 'Erro de validação'),
        ]
    )]
    public function store(Request $request)
    {
        $this->authorize('labs.create');

        $validated = $request->validate([
            'name' => 'required|string|unique:labs,name|max:255',
            'description' => 'nullable|string',
        ]);

        $lab = Lab::create($validated);

        // Log activity
        $this->logActivity('create', $lab);

        return response()->json($lab, 201);
    }

    #[OA\Get(
        path: '/api/v1/labs/{id}',
        summary: 'Obter detalhes do laboratório',
        tags: ['Laboratórios'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Detalhes do laboratório'),
            new OA\Response(response: 401, description: 'Não autenticado'),
            new OA\Response(response: 404, description: 'Laboratório não encontrado'),
        ]
    )]
    public function show(Lab $lab)
    {
        $this->authorize('labs.view');

        // Load all computers for stats calculation
        // Don't use select() to ensure Carbon casts are applied correctly
        $lab->load('computers');

        $computers = $lab->computers;
        $stats = $this->calculateLabStats($computers);

        return response()->json([
            'lab' => [
                'id' => $lab->id,
                'name' => $lab->name,
                'description' => $lab->description,
                'created_at' => $lab->created_at,
            ],
            'stats' => $stats,
        ]);
    }

    /**
     * Get paginated computers for a lab
     */
    #[OA\Get(
        path: '/api/v1/labs/{id}/computers',
        summary: 'Listar computadores do laboratório',
        tags: ['Laboratórios'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'search', in: 'query', required: false, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'status', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['online', 'offline'])),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', example: 20)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de computadores'),
            new OA\Response(response: 401, description: 'Não autenticado'),
        ]
    )]
    public function getComputers(Request $request, Lab $lab)
    {
        $this->authorize('labs.view');

        $query = $lab->computers()->with('lab');

        // Search
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('hostname', 'like', "%{$search}%")
                    ->orWhere('machine_id', 'like', "%{$search}%");
            });
        }

        // Filter by status
        if ($status = $request->query('status')) {
            if ($status === 'online') {
                $query->where('updated_at', '>=', now()->subMinutes(5));
            } elseif ($status === 'offline') {
                $query->where('updated_at', '<', now()->subMinutes(5));
            }
        }

        // Pagination
        $perPage = $request->query('per_page', 20);
        $perPage = min(max((int) $perPage, 5), 100);

        return $query->orderBy('created_at', 'desc')->paginate($perPage);
    }

    /**
     * Get paginated unique softwares for a lab
     */
    #[OA\Get(
        path: '/api/v1/labs/{id}/softwares',
        summary: 'Listar softwares do laboratório',
        tags: ['Laboratórios'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'search', in: 'query', required: false, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', example: 20)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de softwares'),
            new OA\Response(response: 401, description: 'Não autenticado'),
        ]
    )]
    public function getSoftwares(Request $request, Lab $lab)
    {
        $this->authorize('labs.view');

        // Optimized: Use whereHas with lab_id directly instead of loading all computer IDs
        // Get unique softwares from all computers in the lab
        $query = Software::whereHas('computers', function ($q) use ($lab) {
            $q->where('lab_id', $lab->id);
        })->withCount([
            'computers' => function ($q) use ($lab) {
                $q->where('lab_id', $lab->id);
            },
        ]);

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
        $perPage = min(max((int) $perPage, 5), 100);

        return $query->orderBy('name')->paginate($perPage);
    }

    /**
     * Calculate aggregated statistics for a lab
     */
    private function calculateLabStats($computers)
    {
        $totalComputers = $computers->count();

        if ($totalComputers === 0) {
            return [
                'total_computers' => 0,
                'online_computers' => 0,
                'offline_computers' => 0,
                'total_softwares' => 0,
                'hardware_averages' => null,
                'os_distribution' => [],
            ];
        }

        // Count online/offline
        // Use threshold approach for consistency with DashboardController
        // Always use Brazil/Brasilia timezone
        $timezone = 'America/Sao_Paulo';
        $threshold = Carbon::now($timezone)->subMinutes(5);

        $onlineCount = $computers->filter(function ($computer) use ($threshold, $timezone) {
            // Check if updated_at exists
            if (! $computer->updated_at) {
                return false;
            }

            // Ensure updated_at is treated as Carbon instance with correct timezone
            // When using select(), Laravel may not apply casts automatically
            $updatedAt = $computer->updated_at instanceof Carbon
                ? $computer->updated_at->setTimezone($timezone)
                : Carbon::parse($computer->updated_at, $timezone);

            // Computer is online if updated_at is greater than or equal to threshold (last 5 minutes)
            return $updatedAt->gte($threshold);
        })->count();
        $offlineCount = $totalComputers - $onlineCount;

        // Calculate hardware averages
        $hardwareAverages = $this->calculateHardwareAverages($computers);

        // Get OS distribution
        $osDistribution = $this->getOSDistribution($computers);

        // Count unique softwares
        $uniqueSoftwares = $computers->flatMap(function ($computer) {
            return $computer->softwares;
        })->unique('id')->count();

        return [
            'total_computers' => $totalComputers,
            'online_computers' => $onlineCount,
            'offline_computers' => $offlineCount,
            'total_softwares' => $uniqueSoftwares,
            'hardware_averages' => $hardwareAverages,
            'os_distribution' => $osDistribution,
        ];
    }

    /**
     * Calculate average hardware specifications
     */
    private function calculateHardwareAverages($computers)
    {
        $computersWithHardware = $computers->filter(function ($computer) {
            return ! empty($computer->hardware_info);
        });

        if ($computersWithHardware->isEmpty()) {
            return null;
        }

        $count = $computersWithHardware->count();

        // CPU averages
        $avgPhysicalCores = $computersWithHardware->avg(function ($computer) {
            return $computer->hardware_info['cpu']['physical_cores'] ?? 0;
        });
        $avgLogicalCores = $computersWithHardware->avg(function ($computer) {
            return $computer->hardware_info['cpu']['logical_cores'] ?? 0;
        });

        // Memory average
        $avgMemory = $computersWithHardware->avg(function ($computer) {
            return $computer->hardware_info['memory']['total_gb'] ?? 0;
        });

        // Disk averages
        $avgDiskTotal = $computersWithHardware->avg(function ($computer) {
            return $computer->hardware_info['disk']['total_gb'] ?? 0;
        });
        $avgDiskUsed = $computersWithHardware->avg(function ($computer) {
            return $computer->hardware_info['disk']['used_gb'] ?? 0;
        });
        $avgDiskFree = $computersWithHardware->avg(function ($computer) {
            return $computer->hardware_info['disk']['free_gb'] ?? 0;
        });

        // Calculate average disk usage percentage
        $avgDiskUsagePercent = $avgDiskTotal > 0
            ? round(($avgDiskUsed / $avgDiskTotal) * 100, 2)
            : 0;

        return [
            'cpu' => [
                'avg_physical_cores' => round($avgPhysicalCores, 2),
                'avg_logical_cores' => round($avgLogicalCores, 2),
            ],
            'memory' => [
                'avg_total_gb' => round($avgMemory, 2),
            ],
            'disk' => [
                'avg_total_gb' => round($avgDiskTotal, 2),
                'avg_used_gb' => round($avgDiskUsed, 2),
                'avg_free_gb' => round($avgDiskFree, 2),
                'avg_usage_percent' => $avgDiskUsagePercent,
            ],
            'computers_with_hardware_info' => $count,
        ];
    }

    /**
     * Get operating system distribution
     */
    private function getOSDistribution($computers)
    {
        $osCounts = [];

        foreach ($computers as $computer) {
            if (! empty($computer->hardware_info['os']['system'])) {
                $osName = $computer->hardware_info['os']['system'];
                $osRelease = $computer->hardware_info['os']['release'] ?? 'Desconhecido';
                $osKey = $osName.' '.$osRelease;

                if (! isset($osCounts[$osKey])) {
                    $osCounts[$osKey] = [
                        'system' => $osName,
                        'release' => $osRelease,
                        'count' => 0,
                    ];
                }
                $osCounts[$osKey]['count']++;
            }
        }

        return array_values($osCounts);
    }

    public function update(Request $request, Lab $lab)
    {
        $this->authorize('labs.update');

        $oldValues = $lab->toArray();

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255|unique:labs,name,'.$lab->id,
            'description' => 'nullable|string',
        ]);

        $lab->update($validated);

        // Log activity
        $this->logActivity('update', $lab, $oldValues, $lab->toArray());

        return response()->json($lab);
    }

    public function destroy(Lab $lab)
    {
        $this->authorize('labs.delete');

        $oldValues = $lab->toArray();
        $resourceId = $lab->id;
        $resourceName = $lab->name;

        // Log activity before deleting (so we have the model reference)
        $this->logActivity('delete', $lab, $oldValues);

        $lab->delete();

        return response()->noContent();
    }

    #[OA\Post(
        path: '/api/v1/labs/{id}/positions',
        summary: 'Atualizar posições dos computadores no mapa',
        tags: ['Laboratórios'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['positions'],
                properties: [
                    new OA\Property(property: 'positions', type: 'object', example: ['1' => ['x' => 10, 'y' => 20], '2' => ['x' => 50, 'y' => 50]]),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Posições atualizadas'),
            new OA\Response(response: 401, description: 'Não autenticado'),
        ]
    )]
    public function updatePositions(Request $request, Lab $lab)
    {
        $this->authorize('labs.update');

        $validated = $request->validate([
            'positions' => 'required|array',
            'positions.*.x' => 'required|integer|min:0|max:100',
            'positions.*.y' => 'required|integer|min:0|max:100',
        ]);

        // Get valid computer IDs for this lab to prevent updating computers from other labs
        $validComputerIds = $lab->computers()->pluck('id')->toArray();

        $updatedCount = 0;
        foreach ($validated['positions'] as $computerId => $pos) {
            // Validate that the computer belongs to this lab
            if (! in_array($computerId, $validComputerIds)) {
                continue; // Skip invalid computer IDs
            }

            // Use DB::table() to update without touching updated_at timestamp
            DB::table('computers')
                ->where('id', $computerId)
                ->where('lab_id', $lab->id)
                ->update([
                    'position_x' => $pos['x'],
                    'position_y' => $pos['y'],
                ]);

            $updatedCount++;
        }

        return response()->json([
            'message' => "Posições atualizadas com sucesso para {$updatedCount} computador(es)",
            'updated_count' => $updatedCount,
        ]);
    }
}
