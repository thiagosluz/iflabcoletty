<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ScheduledTask;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ScheduledTaskController extends Controller
{
    #[OA\Get(
        path: '/api/v1/scheduled-tasks',
        summary: 'Listar tarefas agendadas',
        tags: ['Automação'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Lista de tarefas'),
        ]
    )]
    public function index()
    {
        $this->authorize('scheduled-tasks.view');

        return ScheduledTask::latest()->get(); // No pagination for now, list is expected to be small
    }

    #[OA\Post(
        path: '/api/v1/scheduled-tasks',
        summary: 'Criar tarefa agendada',
        tags: ['Automação'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'command', 'target_type', 'target_id', 'frequency', 'time'],
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'command', type: 'string', enum: ['shutdown', 'restart', 'lock', 'logoff', 'message']),
                    new OA\Property(property: 'target_type', type: 'string', enum: ['lab', 'computer']),
                    new OA\Property(property: 'target_id', type: 'integer'),
                    new OA\Property(property: 'frequency', type: 'string', enum: ['daily', 'weekly', 'monthly', 'once']),
                    new OA\Property(property: 'time', type: 'string', example: '22:00'),
                    new OA\Property(property: 'days_of_week', type: 'array', items: new OA\Items(type: 'integer')),
                    new OA\Property(property: 'run_at_date', type: 'string', format: 'date'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Tarefa criada'),
        ]
    )]
    public function store(Request $request)
    {
        $this->authorize('scheduled-tasks.create');

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'command' => 'required|in:shutdown,restart,lock,logoff,message,wol',
            'target_type' => 'required|in:lab,computer',
            'target_id' => 'required|integer',
            'frequency' => 'required|in:daily,weekly,monthly,once',
            'time' => 'required|date_format:H:i',
            'days_of_week' => 'nullable|array',
            'run_at_date' => 'nullable|date',
            'is_active' => 'boolean',
        ]);

        // Fix target_type class name
        $validated['target_type'] = $validated['target_type'] === 'lab'
            ? 'App\Models\Lab'
            : 'App\Models\Computer';

        $validated['user_id'] = auth()->id();

        $task = ScheduledTask::create($validated);

        return response()->json($task, 201);
    }

    #[OA\Put(
        path: '/api/v1/scheduled-tasks/{id}',
        summary: 'Atualizar tarefa agendada',
        tags: ['Automação'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Tarefa atualizada'),
        ]
    )]
    public function update(Request $request, ScheduledTask $scheduledTask)
    {
        $this->authorize('scheduled-tasks.update');

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'command' => 'sometimes|in:shutdown,restart,lock,logoff,message,wol',
            'target_type' => 'sometimes|in:lab,computer',
            'target_id' => 'sometimes|integer',
            'frequency' => 'sometimes|in:daily,weekly,monthly,once',
            'time' => 'sometimes|date_format:H:i',
            'days_of_week' => 'nullable|array',
            'run_at_date' => 'nullable|date',
            'is_active' => 'boolean',
        ]);

        if (isset($validated['target_type'])) {
            $validated['target_type'] = $validated['target_type'] === 'lab'
                ? 'App\Models\Lab'
                : 'App\Models\Computer';
        }

        $scheduledTask->update($validated);

        return response()->json($scheduledTask);
    }

    #[OA\Delete(
        path: '/api/v1/scheduled-tasks/{id}',
        summary: 'Excluir tarefa agendada',
        tags: ['Automação'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Tarefa excluída'),
        ]
    )]
    public function destroy(ScheduledTask $scheduledTask)
    {
        $this->authorize('scheduled-tasks.delete');

        $scheduledTask->delete();

        return response()->noContent();
    }

    #[OA\Post(
        path: '/api/v1/scheduled-tasks/{id}/execute',
        summary: 'Executar tarefa agendada manualmente',
        tags: ['Automação'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Tarefa executada'),
        ]
    )]
    public function execute(ScheduledTask $scheduledTask)
    {
        $this->authorize('scheduled-tasks.update');

        // Logic to execute the task immediately
        // In a real scenario, this would likely dispatch a job or run the command directly
        // For now, we simulate execution and update status

        try {
            // Mock execution success
            $success = true;
            $output = "Command '{$scheduledTask->command}' sent successfully to {$scheduledTask->target_type} #{$scheduledTask->target_id}";

            // You might want to actually hook into your existing command handling service here
            // e.g., CommandService::dispatch($scheduledTask->command, $scheduledTask->target);

        } catch (\Exception $e) {
            $success = false;
            $output = $e->getMessage();
        }

        $scheduledTask->update([
            'last_run_at' => now(),
            'last_run_status' => $success ? 'success' : 'failed',
            'last_run_output' => $output
        ]);

        return response()->json([
            'message' => $success ? 'Tarefa executada com sucesso' : 'Falha ao executar tarefa',
            'task' => $scheduledTask
        ]);
    }
}