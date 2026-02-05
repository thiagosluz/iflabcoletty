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
            'command_validity_minutes' => 'nullable|integer|in:5,10,15,30,60',
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
            'command_validity_minutes' => 'nullable|integer|in:5,10,15,30,60',
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

        // Execute the task immediately using the same logic as the scheduled command
        $result = $this->executeTask($scheduledTask);

        $scheduledTask->update([
            'last_run_at' => now(),
            'last_run_status' => $result['success'] ? 'success' : 'failed',
            'last_run_output' => $result['output'],
        ]);

        return response()->json([
            'message' => $result['success'] ? 'Tarefa executada com sucesso' : 'Falha ao executar tarefa',
            'task' => $scheduledTask->fresh(),
        ]);
    }

    /**
     * Execute a scheduled task (shared logic between command and controller)
     */
    private function executeTask(ScheduledTask $task): array
    {
        $computers = collect();
        if ($task->target_type === 'App\Models\Lab') {
            $lab = \App\Models\Lab::find($task->target_id);
            if ($lab) {
                $computers = $lab->computers;
            } else {
                return [
                    'success' => false,
                    'output' => "Laboratório #{$task->target_id} não encontrado",
                ];
            }
        } elseif ($task->target_type === 'App\Models\Computer') {
            $computer = \App\Models\Computer::find($task->target_id);
            if ($computer) {
                $computers = collect([$computer]);
            } else {
                return [
                    'success' => false,
                    'output' => "Computador #{$task->target_id} não encontrado",
                ];
            }
        } else {
            return [
                'success' => false,
                'output' => "Tipo de alvo inválido: {$task->target_type}",
            ];
        }

        if ($computers->isEmpty()) {
            return [
                'success' => false,
                'output' => 'Nenhum computador encontrado para executar a tarefa',
            ];
        }

        $successCount = 0;
        $errorCount = 0;
        $errors = [];

        foreach ($computers as $computer) {
            try {
                if ($task->command === 'wol') {
                    // WOL Logic - find proxy computer
                    $proxy = \App\Models\Computer::where('lab_id', $computer->lab_id)
                        ->where('id', '!=', $computer->id)
                        ->where('updated_at', '>=', now()->subMinutes(5))
                        ->first();

                    if (! $proxy) {
                        throw new \Exception('Nenhum computador online no laboratório para servir de proxy WoL');
                    }

                    // Get MAC from hardware_info
                    $mac = null;
                    if (! empty($computer->hardware_info['network'])) {
                        foreach ($computer->hardware_info['network'] as $iface) {
                            if (! empty($iface['mac'])) {
                                $mac = $iface['mac'];
                                break;
                            }
                        }
                    }

                    if (! $mac) {
                        throw new \Exception('Computador alvo não possui endereço MAC registrado');
                    }

                    // Create command for the PROXY
                    $proxy->commands()->create([
                        'user_id' => $task->user_id,
                        'command' => 'wol',
                        'parameters' => [
                            'target_mac' => $mac,
                            'target_hostname' => $computer->hostname,
                        ],
                        'status' => 'pending',
                    ]);
                    $successCount++;
                } else {
                    $computer->commands()->create([
                        'user_id' => $task->user_id,
                        'command' => $task->command,
                        'parameters' => $task->command === 'message' ? ['message' => 'Tarefa agendada executada'] : [],
                        'status' => 'pending',
                    ]);
                    $successCount++;
                }
            } catch (\Exception $e) {
                $errorCount++;
                $errorMsg = "Falha em {$computer->hostname}: ".$e->getMessage();
                $errors[] = $errorMsg;
            }
        }

        $total = $computers->count();
        $output = "Executado em {$successCount}/{$total} computador(es)";

        if ($errorCount > 0) {
            $output .= '. Erros: '.implode('; ', $errors);
        }

        return [
            'success' => $successCount > 0,
            'output' => $output,
        ];
    }
}
