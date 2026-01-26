<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Computer;
use App\Models\Lab;
use App\Models\Software;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SearchController extends Controller
{
    public function globalSearch(Request $request)
    {
        // Requer permissão de dashboard para usar busca global
        $this->authorize('dashboard.view');

        $query = $request->query('q');

        if (! $query || strlen($query) < 2) {
            return response()->json([
                'computers' => [],
                'softwares' => [],
                'labs' => [],
                'users' => [],
            ]);
        }

        $searchTerm = '%'.strtolower($query).'%';
        $isPostgres = DB::getDriverName() === 'pgsql';
        $operator = $isPostgres ? 'ILIKE' : 'LIKE';

        // Computers
        $computers = Computer::query()
            ->where('hostname', $operator, $searchTerm)
            ->orWhere('machine_id', $operator, $searchTerm)
            ->with('lab:id,name')
            ->limit(5)
            ->get(['id', 'hostname', 'machine_id', 'lab_id']);

        // Labs
        $labs = Lab::query()
            ->where('name', $operator, $searchTerm)
            ->limit(5)
            ->get(['id', 'name']);

        // Softwares
        $softwares = Software::query()
            ->where('name', $operator, $searchTerm)
            ->limit(5)
            ->get(['id', 'name', 'version', 'vendor']);

        // Users (only if admin)
        $users = [];
        if ($request->user() && $request->user()->can('users.view')) {
            $users = User::query()
                ->where('name', $operator, $searchTerm)
                ->orWhere('email', $operator, $searchTerm)
                ->limit(5)
                ->get(['id', 'name', 'email']);
        }

        return response()->json([
            'computers' => $computers,
            'labs' => $labs,
            'softwares' => $softwares,
            'users' => $users,
        ]);
    }
}
