<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Computer;
use Illuminate\Http\Request;

class PublicController extends Controller
{
    /**
     * Get computer information by public hash (no authentication required)
     */
    public function show(string $hash)
    {
        $computer = Computer::where('public_hash', $hash)
            ->with('lab:id,name,description')
            ->first();

        if (! $computer) {
            return response()->json([
                'message' => 'Computador não encontrado',
            ], 404);
        }

        // Check link expiration (if configured)
        if ($computer->public_hash_expires_at && $computer->public_hash_expires_at->isPast()) {
            return response()->json([
                'message' => 'Este link público expirou. Solicite um novo link ao administrador do sistema.',
            ], 410);
        }

        // Refresh to get latest updated_at from database
        $computer->refresh();

        // Remove potencially sensitive hardware fields for public view
        $hardware = $computer->hardware_info;
        if (is_array($hardware) && array_key_exists('network', $hardware)) {
            unset($hardware['network']);
        }

        // Only return non-sensitive public information
        return response()->json([
            'hostname' => $computer->hostname,
            'lab' => [
                'name' => $computer->lab->name ?? 'Desconhecido',
                'description' => $computer->lab->description ?? null,
            ],
            'hardware_info' => $hardware,
            'status' => $this->getStatus($computer->updated_at),
            'last_seen' => $computer->updated_at->toISOString(),
        ]);
    }

    /**
     * Get paginated softwares for a computer by public hash (no authentication required)
     */
    public function getSoftwares(Request $request, string $hash)
    {
        $computer = Computer::where('public_hash', $hash)->first();

        if (! $computer) {
            return response()->json([
                'message' => 'Computador não encontrado',
            ], 404);
        }

        if ($computer->public_hash_expires_at && $computer->public_hash_expires_at->isPast()) {
            return response()->json([
                'message' => 'Este link público expirou. Solicite um novo link ao administrador do sistema.',
            ], 410);
        }

        $query = $computer->softwares();

        // Search
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('version', 'like', "%{$search}%")
                    ->orWhere('vendor', 'like', "%{$search}%");
            });
        }

        // Optional vendor filter
        if ($vendor = $request->query('vendor')) {
            $query->where('vendor', 'like', "%{$vendor}%");
        }

        // Sorting
        $sortBy = $request->query('sort_by', 'name');
        $sortDirection = strtolower($request->query('sort_direction', 'asc')) === 'desc' ? 'desc' : 'asc';

        $allowedSorts = [
            'name' => 'name',
            'vendor' => 'vendor',
            'installed_at' => 'computer_software.installed_at',
        ];
        $sortColumn = $allowedSorts[$sortBy] ?? 'name';

        // Pagination
        $perPage = $request->query('per_page', 50);
        $perPage = min(max((int) $perPage, 5), 100); // Limit between 5 and 100

        // Get paginated results with pivot data
        $softwares = $query->orderBy($sortColumn, $sortDirection)->paginate($perPage);

        return $softwares;
    }

    /**
     * Determine if computer is online based on last update
     */
    private function getStatus($updatedAt): string
    {
        // Calculate minutes since update (always positive)
        $minutesSinceUpdate = abs(now()->diffInMinutes($updatedAt));

        return $minutesSinceUpdate < 5 ? 'online' : 'offline';
    }
}
