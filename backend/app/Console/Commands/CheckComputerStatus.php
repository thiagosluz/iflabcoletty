<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Computer;
use App\Events\ComputerStatusChanged;
use Carbon\Carbon;

class CheckComputerStatus extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'computers:check-status';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Verifica o status dos computadores e dispara notificações para mudanças de status';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Verificando status dos computadores...');

        $offlineThreshold = now()->subMinutes(5);
        $onlineThreshold = now()->subMinutes(1);

        // Find computers that went offline (not updated in last 5 minutes, but were online before)
        $offlineComputers = Computer::where('updated_at', '<', $offlineThreshold)
            ->where('updated_at', '>=', now()->subHours(1)) // Only check computers that were active in last hour
            ->get();

        foreach ($offlineComputers as $computer) {
            // Check if we already notified about this computer being offline
            // by checking if it was offline in the last check (5-10 minutes ago)
            $wasRecentlyOffline = $computer->updated_at->lt(now()->subMinutes(5)) 
                && $computer->updated_at->gte(now()->subMinutes(10));
            
            if (!$wasRecentlyOffline) {
                event(new ComputerStatusChanged($computer, 'offline', 'Computador não reportou há mais de 5 minutos'));
                $this->info("Computador {$computer->hostname} ({$computer->machine_id}) está offline");
            }
        }

        // Find computers that came back online (updated in last minute, but were offline before)
        $onlineComputers = Computer::where('updated_at', '>=', $onlineThreshold)
            ->where('updated_at', '<', now()->subMinutes(4)) // Was offline but now online
            ->get();

        foreach ($onlineComputers as $computer) {
            // Only notify if computer was offline for at least 5 minutes
            $wasOfflineForAWhile = $computer->updated_at->lt(now()->subMinutes(5));
            
            if ($wasOfflineForAWhile) {
                event(new ComputerStatusChanged($computer, 'online', 'Computador voltou a reportar'));
                $this->info("Computador {$computer->hostname} ({$computer->machine_id}) voltou online");
            }
        }

        $this->info('Verificação concluída.');

        return Command::SUCCESS;
    }
}
