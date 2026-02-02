<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Computer;
use App\Models\ComputerCommand;
use App\Models\Lab;
use App\Models\SoftwareInstallation;
use Carbon\Carbon;
use Illuminate\Http\Request;

class RemoteControlController extends Controller
{
    public function index(Computer $computer)
    {
        $this->authorize('remote-control.view');

        return $computer->commands()
            ->with('user:id,name')
            ->latest()
            ->paginate(20);
    }

    public function store(Request $request, Computer $computer)
    {
        $validated = $request->validate([
            'command' => 'required|string|in:shutdown,restart,lock,logoff,message,wol,screenshot,ps_list,ps_kill,terminal,install_software,update_agent,set_hostname',
            'parameters' => 'nullable|array',
            'parameters.new_hostname' => 'required_if:command,set_hostname|string|max:63|regex:/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/',
        ]);

        if ($validated['command'] === 'wol') {
            try {
                $command = $this->handleWol($computer, auth()->id());

                return response()->json($command, 201);
            } catch (\Exception $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        $command = $computer->commands()->create([
            'user_id' => auth()->id(),
            'command' => $validated['command'],
            'parameters' => $validated['parameters'] ?? [],
            'status' => 'pending',
        ]);

        return response()->json($command, 201);
    }

    public function storeBulk(Request $request)
    {
        $this->authorize('remote-control.execute');

        $validated = $request->validate([
            'computer_ids' => 'required|array',
            'computer_ids.*' => 'exists:computers,id',
            'command' => 'required|string|in:shutdown,restart,lock,logoff,message,wol,screenshot,ps_list,ps_kill,terminal,install_software,set_hostname',
            'parameters' => 'nullable|array',
            'parameters.new_hostname' => 'required_if:command,set_hostname|string|max:63|regex:/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/',
        ]);

        $computers = Computer::whereIn('id', $validated['computer_ids'])->get();
        $count = 0;
        $errors = [];

        foreach ($computers as $computer) {
            try {
                if ($validated['command'] === 'wol') {
                    $this->handleWol($computer, auth()->id());
                } else {
                    $computer->commands()->create([
                        'user_id' => auth()->id(),
                        'command' => $validated['command'],
                        'parameters' => $validated['parameters'] ?? [],
                        'status' => 'pending',
                    ]);
                }
                $count++;
            } catch (\Exception $e) {
                $errors[] = "Falha em {$computer->hostname}: ".$e->getMessage();
            }
        }

        return response()->json([
            'message' => "Comando enviado para {$count} computadores.",
            'errors' => $errors,
        ]);
    }

    public function storeLab(Request $request, Lab $lab)
    {
        $this->authorize('remote-control.execute');

        $validated = $request->validate([
            'command' => 'required|string|in:shutdown,restart,lock,logoff,message,wol,screenshot,ps_list,ps_kill,terminal,install_software,update_agent,set_hostname',
            'parameters' => 'nullable|array',
            'parameters.new_hostname' => 'required_if:command,set_hostname|string|max:63|regex:/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/',
        ]);

        $computers = $lab->computers;
        $count = 0;
        $errors = [];

        foreach ($computers as $computer) {
            try {
                if ($validated['command'] === 'wol') {
                    $this->handleWol($computer, auth()->id());
                } else {
                    $computer->commands()->create([
                        'user_id' => auth()->id(),
                        'command' => $validated['command'],
                        'parameters' => $validated['parameters'] ?? [],
                        'status' => 'pending',
                    ]);
                }
                $count++;
            } catch (\Exception $e) {
                // Ignore errors for individual computers in bulk lab action, just log?
                // Or maybe the computer doesn't have a MAC for WOL
            }
        }

        return response()->json([
            'message' => "Comando enviado para {$count} computadores do laboratório.",
        ]);
    }

    private function handleWol(Computer $target, $user_id)
    {
        // Find a proxy agent in the same lab that is online (updated in last 5 mins)
        // Exclude the target itself (it's offline presumably)
        $proxy = Computer::where('lab_id', $target->lab_id)
            ->where('id', '!=', $target->id)
            ->where('updated_at', '>=', Carbon::now()->subMinutes(5))
            ->first();

        if (! $proxy) {
            throw new \Exception('Nenhum computador online no laboratório para servir de proxy WoL.');
        }

        // Get Target MAC from hardware_info
        $mac = null;
        if (! empty($target->hardware_info['network'])) {
            foreach ($target->hardware_info['network'] as $iface) {
                if (! empty($iface['mac'])) {
                    $mac = $iface['mac'];
                    break; // Use the first MAC found
                }
            }
        }

        if (! $mac) {
            throw new \Exception('Computador alvo não possui endereço MAC registrado.');
        }

        // Create command for the PROXY
        // The command type is 'wol' but executed by the proxy
        return $proxy->commands()->create([
            'user_id' => $user_id,
            'command' => 'wol',
            'parameters' => [
                'target_mac' => $mac,
                'target_hostname' => $target->hostname,
            ],
            'status' => 'pending',
        ]);
    }

    public function pending(Computer $computer)
    {
        $commands = $computer->commands()
            ->where('status', 'pending')
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json($commands);
    }

    public function updateStatus(Request $request, ComputerCommand $command)
    {
        // Este método é chamado pelo agente para atualizar o status do comando
        // Não requer permissão específica, mas requer autenticação
        // O agente usa o token de autenticação do computador
        if (! auth()->check()) {
            return response()->json(['message' => 'Não autenticado'], 401);
        }

        $validated = $request->validate([
            'status' => 'required|in:processing,completed,failed',
            'output' => 'nullable|string',
        ]);

        $data = [
            'status' => $validated['status'],
            'output' => $validated['output'] ?? $command->output,
        ];

        if (in_array($validated['status'], ['completed', 'failed'])) {
            $data['executed_at'] = now();
        }

        $command->update($data);

        // Sync SoftwareInstallation when this command is install_software
        if ($command->command === 'install_software') {
            $installation = SoftwareInstallation::where('command_id', $command->id)->first();
            if ($installation) {
                $installation->update([
                    'status' => $validated['status'],
                    'output' => $data['output'],
                    'error_message' => $validated['status'] === 'failed' ? ($data['output'] ?? null) : null,
                    'executed_at' => $data['executed_at'] ?? $installation->executed_at,
                ]);
            }
        }

        return response()->json($command);
    }
}
