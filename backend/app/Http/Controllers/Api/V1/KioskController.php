<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Computer;
use App\Models\ComputerCommand;
use App\Models\Lab;
use Illuminate\Http\Request;

class KioskController extends Controller
{
    /**
     * Obter apenas computadores online (vistos nos últimos 5 minutos).
     */
    private function getOnlineComputers($query)
    {
        return $query->where('updated_at', '>=', now()->subMinutes(5))->get();
    }

    /**
     * Envia um comando em massa para os computadores
     */
    private function dispatchKioskCommand($computers, string $commandType, bool $newLockedStatus)
    {
        $payloads = [];
        $now = now();
        $userId = auth()->id();

        foreach ($computers as $computer) {
            $payloads[] = [
                'computer_id' => $computer->id,
                'user_id' => $userId,
                'command_type' => $commandType,
                'parameters' => json_encode(['expires_at' => $now->copy()->addMinutes(5)->toIso8601String()]),
                'status' => 'pending',
                'created_at' => $now,
                'updated_at' => $now,
            ];

            // Pre-emptive visual update
            $computer->is_locked = $newLockedStatus;
            $computer->saveQuietly();
        }

        if (! empty($payloads)) {
            ComputerCommand::insert($payloads);
        }

        return count($payloads);
    }

    public function lockLab(Request $request, Lab $lab)
    {
        $this->authorize('remote-control.execute');

        $onlineComputers = $this->getOnlineComputers($lab->computers());

        if ($onlineComputers->isEmpty()) {
            return response()->json(['message' => 'Nenhum computador online para bloquear.'], 404);
        }

        $count = $this->dispatchKioskCommand($onlineComputers, 'kiosk_lock', true);

        return response()->json([
            'message' => "Comando de bloqueio enviado para {$count} computador(es).",
        ]);
    }

    public function unlockLab(Request $request, Lab $lab)
    {
        $this->authorize('remote-control.execute');

        // Unlock is sent to all computers regardless of online status to clear the flag
        $computers = $lab->computers()->get();

        if ($computers->isEmpty()) {
            return response()->json(['message' => 'Nenhum computador encontrado.'], 404);
        }

        $count = $this->dispatchKioskCommand($computers, 'kiosk_unlock', false);

        return response()->json([
            'message' => "Comando de desbloqueio enviado para {$count} computador(es).",
        ]);
    }

    public function lockComputer(Request $request, Computer $computer)
    {
        $this->authorize('remote-control.execute');

        if ($computer->updated_at < now()->subMinutes(5)) {
            return response()->json(['message' => 'Este computador está offline.'], 422);
        }

        $this->dispatchKioskCommand([$computer], 'kiosk_lock', true);

        return response()->json([
            'message' => 'Comando de bloqueio enviado com sucesso.',
        ]);
    }

    public function unlockComputer(Request $request, Computer $computer)
    {
        $this->authorize('remote-control.execute');

        $this->dispatchKioskCommand([$computer], 'kiosk_unlock', false);

        return response()->json([
            'message' => 'Comando de desbloqueio enviado com sucesso.',
        ]);
    }
}
