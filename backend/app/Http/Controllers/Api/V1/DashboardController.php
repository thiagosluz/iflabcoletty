<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Computer;
use App\Models\Lab;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use OpenApi\Attributes as OA;

class DashboardController extends Controller
{
    #[OA\Get(
        path: "/api/v1/dashboard/stats",
        summary: "Obter estatísticas do dashboard",
        tags: ["Dashboard"],
        security: [["sanctum" => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: "Estatísticas do dashboard",
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: "total_labs", type: "integer"),
                        new OA\Property(property: "total_computers", type: "integer"),
                        new OA\Property(property: "online_computers", type: "integer"),
                        new OA\Property(property: "offline_computers", type: "integer"),
                        new OA\Property(property: "total_softwares", type: "integer"),
                        new OA\Property(property: "hardware_averages", type: "object", nullable: true),
                        new OA\Property(
                            property: "os_distribution",
                            type: "array",
                            items: new OA\Items(type: "object")
                        ),
                    ]
                )
            ),
            new OA\Response(response: 401, description: "Não autenticado"),
        ]
    )]
    public function stats()
    {
        $this->authorize('dashboard.view');

        // "Online" threshold: updated in the last 5 minutes
        $threshold = Carbon::now()->subMinutes(5);

        // Use query builder instead of loading all models into memory
        // Only load computers with hardware_info for calculations
        // Filter in PHP after loading to handle JSON properly
        $allComputers = Computer::get(['id', 'hardware_info']);
        $computersWithHardware = $allComputers->filter(function ($computer) {
            return !empty($computer->hardware_info) && 
                   is_array($computer->hardware_info) && 
                   !empty($computer->hardware_info);
        });
        
        $hardwareAverages = $this->calculateHardwareAverages($computersWithHardware);
        $osDistribution = $this->getOSDistribution($allComputers);
        $totalSoftwares = $this->getTotalUniqueSoftwares();

        return [
            'total_labs' => Lab::count(),
            'total_computers' => Computer::count(),
            'online_computers' => Computer::where('updated_at', '>=', $threshold)->count(),
            'offline_computers' => Computer::where('updated_at', '<', $threshold)->count(),
            'total_softwares' => $totalSoftwares,
            'hardware_averages' => $hardwareAverages,
            'os_distribution' => $osDistribution,
        ];
    }

    /**
     * Calculate average hardware specifications across all computers
     */
    private function calculateHardwareAverages($computers)
    {
        $computersWithHardware = $computers->filter(function ($computer) {
            return !empty($computer->hardware_info);
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
     * Get operating system distribution across all computers
     */
    private function getOSDistribution($computers)
    {
        $osCounts = [];
        
        foreach ($computers as $computer) {
            if (!empty($computer->hardware_info['os']['system'])) {
                $osName = $computer->hardware_info['os']['system'];
                $osRelease = $computer->hardware_info['os']['release'] ?? 'Desconhecido';
                $osKey = $osName . ' ' . $osRelease;
                
                if (!isset($osCounts[$osKey])) {
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

    /**
     * Get total unique softwares across all computers
     * Optimized: Use direct query instead of loading all relationships
     */
    private function getTotalUniqueSoftwares()
    {
        // Use distinct count from pivot table instead of loading all relationships
        // PostgreSQL uses DISTINCT ON, MySQL uses DISTINCT differently
        $driver = DB::getDriverName();
        
        if ($driver === 'pgsql') {
            return DB::table('computer_software')
                ->distinct('software_id')
                ->count('software_id');
        } else {
            // MySQL/MariaDB
            return DB::table('computer_software')
                ->select(DB::raw('COUNT(DISTINCT software_id) as count'))
                ->value('count') ?? 0;
        }
    }
}
