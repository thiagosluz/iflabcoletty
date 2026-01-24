<?php

namespace App\Console\Commands;

use App\Models\Computer;
use App\Services\AlertService;
use Illuminate\Console\Command;

class CheckAlerts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'alerts:check';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check all computers against alert rules';

    /**
     * Execute the console command.
     */
    public function handle(AlertService $alertService)
    {
        $this->info('Starting alert check...');
        
        // Chunk to avoid memory issues
        Computer::chunk(100, function ($computers) use ($alertService) {
            foreach ($computers as $computer) {
                $alertService->processComputer($computer);
            }
        });

        $this->info('Alert check completed.');
    }
}
