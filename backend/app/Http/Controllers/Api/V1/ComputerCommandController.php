<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ComputerCommand;
use Illuminate\Http\Request;

class ComputerCommandController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('remote-control.view');

        $query = ComputerCommand::with(['computer:id,hostname', 'user:id,name']);

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->whereHas('computer', function ($q) use ($search) {
                $q->where('hostname', 'like', "%{$search}%");
            });
        }

        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        $perPage = $request->input('per_page', 20);

        return $query->orderByDesc('created_at')->paginate($perPage);
    }

    public function destroy(ComputerCommand $command)
    {
        $this->authorize('remote-control.execute');

        $command->delete();

        return response()->noContent();
    }

    public function bulkDestroy(Request $request)
    {
        $this->authorize('remote-control.execute');

        $validated = $request->validate([
            'command_ids' => 'required|array',
            'command_ids.*' => 'exists:computer_commands,id',
        ]);

        ComputerCommand::whereIn('id', $validated['command_ids'])->delete();

        return response()->json(['message' => 'Comandos excluídos com sucesso.']);
    }
}
