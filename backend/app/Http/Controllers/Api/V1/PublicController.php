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
            ->with('lab:id,name')
            ->first();

        if (! $computer) {
            return response()->json([
                'message' => 'Computador não encontrado',
            ], 404);
        }

        // Refresh to get latest updated_at from database
        $computer->refresh();

        // Only return non-sensitive public information
        return response()->json([
            'hostname' => $computer->hostname,
            'lab' => [
                'name' => $computer->lab->name ?? 'Desconhecido',
            ],
            'hardware_info' => $computer->hardware_info,
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

        $query = $computer->softwares();

        // Search
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('version', 'like', "%{$search}%")
                    ->orWhere('vendor', 'like', "%{$search}%");
            });
        }

        // Pagination
        $perPage = $request->query('per_page', 50);
        $perPage = min(max((int) $perPage, 5), 100); // Limit between 5 and 100

        // Get paginated results with pivot data
        $softwares = $query->orderBy('name')->paginate($perPage);

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
