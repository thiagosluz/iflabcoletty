<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Computer;
use App\Models\ComputerCommand;
use App\Models\Lab;
use App\Models\SoftwareInstallation;
use App\Services\WolService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

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
            'parameters.message' => 'required_if:command,message|nullable|string|max:1000',
            'parameters.cmd_line' => 'nullable|string|max:10000',
            'parameters.command' => 'nullable|string|max:10000',
            'expires_in_minutes' => 'nullable|integer|min:1',
        ]);

        if ($validated['command'] === 'terminal') {
            $p = $validated['parameters'] ?? [];
            $text = $p['cmd_line'] ?? $p['command'] ?? '';
            if (trim((string) $text) === '') {
                return response()->json(['message' => 'Comando terminal: informe o texto em parameters.cmd_line ou parameters.command.'], 422);
            }
            $validated['parameters'] = array_merge($p, ['cmd_line' => $text]);
        }

        if ($validated['command'] === 'wol') {
            try {
                $mac = $this->getTargetMacForWol($computer);
                if (! $mac) {
                    return response()->json(['message' => 'Computador alvo não possui endereço MAC registrado.'], 422);
                }
                if (config('wol.send_from_server')) {
                    if (WolService::send($mac)) {
                        Log::info('WoL sent from server to MAC', ['computer_id' => $computer->id, 'hostname' => $computer->hostname]);

                        return response()->json([
                            'sent_from_server' => true,
                            'message' => 'WoL enviado pelo servidor.',
                        ], 201);
                    }
                }
                $command = $this->handleWol($computer, auth()->id());
                $command->load('computer');

                return response()->json([
                    'command' => $command,
                    'proxy_computer_id' => $command->computer_id,
                    'proxy_hostname' => $command->computer->hostname ?? null,
                ], 201);
            } catch (\Exception $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        $command = $computer->commands()->create([
            'user_id' => auth()->id(),
            'command' => $validated['command'],
            'parameters' => $validated['parameters'] ?? [],
            'status' => 'pending',
            'expires_at' => isset($validated['expires_in_minutes']) ? now()->addMinutes($validated['expires_in_minutes']) : now()->addMinutes(60),
        ]);

        return response()->json($command, 201);
    }

    public function storeBulk(Request $request)
    {
        $this->authorize('remote-control.execute');

        $validated = $request->validate([
            'computer_ids' => 'required|array',
            'computer_ids.*' => 'exists:computers,id',
            'command' => 'required|string|in:shutdown,restart,lock,logoff,message,wol,screenshot,ps_list,ps_kill,terminal,install_software,update_agent,set_hostname',
            'parameters' => 'nullable|array',
            'parameters.new_hostname' => 'required_if:command,set_hostname|string|max:63|regex:/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/',
            'parameters.message' => 'required_if:command,message|nullable|string|max:1000',
            'parameters.cmd_line' => 'nullable|string|max:10000',
            'parameters.command' => 'nullable|string|max:10000',
            'expires_in_minutes' => 'nullable|integer|min:1',
        ]);

        if ($validated['command'] === 'terminal') {
            $p = $validated['parameters'] ?? [];
            $text = $p['cmd_line'] ?? $p['command'] ?? '';
            if (trim((string) $text) === '') {
                return response()->json(['message' => 'Comando terminal: informe o texto em parameters.cmd_line ou parameters.command.'], 422);
            }
            $validated['parameters'] = array_merge($p, ['cmd_line' => $text]);
        }

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
                        'expires_at' => isset($validated['expires_in_minutes']) ? now()->addMinutes($validated['expires_in_minutes']) : now()->addMinutes(60),
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
            'parameters.message' => 'required_if:command,message|nullable|string|max:1000',
            'parameters.cmd_line' => 'nullable|string|max:10000',
            'parameters.command' => 'nullable|string|max:10000',
            'expires_in_minutes' => 'nullable|integer|min:1',
        ]);

        if ($validated['command'] === 'terminal') {
            $p = $validated['parameters'] ?? [];
            $text = $p['cmd_line'] ?? $p['command'] ?? '';
            if (trim((string) $text) === '') {
                return response()->json(['message' => 'Comando terminal: informe o texto em parameters.cmd_line ou parameters.command.'], 422);
            }
            $validated['parameters'] = array_merge($p, ['cmd_line' => $text]);
        }

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
                        'expires_at' => isset($validated['expires_in_minutes']) ? now()->addMinutes($validated['expires_in_minutes']) : now()->addMinutes(60),
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

    /**
     * Virtual/loopback interface name patterns to exclude when choosing MAC for WoL.
     */
    private static function getVirtualInterfacePatterns(): array
    {
        return ['lo', 'loopback', 'vboxnet', 'vmnet', 'virbr', 'docker', 'wsl', 'vethernet', 'veth', 'br-'];
    }

    private function getTargetMacForWol(Computer $target): ?string
    {
        if (! empty($target->wol_mac)) {
            return preg_replace('/[^0-9A-Fa-f]/', '', $target->wol_mac);
        }
        if (empty($target->hardware_info['network']) || ! is_array($target->hardware_info['network'])) {
            return null;
        }
        $virtualPatterns = self::getVirtualInterfacePatterns();
        $physicalMac = null;
        $firstMac = null;
        foreach ($target->hardware_info['network'] as $iface) {
            if (empty($iface['mac'])) {
                continue;
            }
            if ($firstMac === null) {
                $firstMac = $iface['mac'];
            }
            $name = isset($iface['name']) ? strtolower((string) $iface['name']) : '';
            $isVirtual = false;
            foreach ($virtualPatterns as $pattern) {
                if ($name === $pattern || str_starts_with($name, $pattern)) {
                    $isVirtual = true;
                    break;
                }
            }
            if (! $isVirtual) {
                $physicalMac = $iface['mac'];
                break;
            }
        }
        $mac = $physicalMac ?? $firstMac;

        return $mac ? preg_replace('/[^0-9A-Fa-f]/', '', $mac) : null;
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

        Log::info('WoL: target computer_id='.$target->id.', hostname='.($target->hostname ?? '').'; proxy computer_id='.$proxy->id.', hostname='.($proxy->hostname ?? ''));

        $mac = $this->getTargetMacForWol($target);
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
        $now = now();

        // Mark expired commands as failed
        $computer->commands()
            ->where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', $now)
            ->update([
                'status' => 'failed',
                'output' => 'Comando expirado: o computador não ficou online a tempo.',
                'executed_at' => $now,
            ]);

        $commands = $computer->commands()
            ->where('status', 'pending')
            ->where(function ($query) use ($now) {
                $query->whereNull('expires_at')
                    ->orWhere('expires_at', '>=', $now);
            })
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
