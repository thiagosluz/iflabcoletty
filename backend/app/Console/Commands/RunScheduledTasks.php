<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class RunScheduledTasks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:run-scheduled-tasks';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Executa tarefas agendadas pendentes';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        // Force timezone to America/Sao_Paulo to ensure correct time comparison
        $timezone = config('app.timezone', 'America/Sao_Paulo');
        date_default_timezone_set($timezone);
        
        // Log entry point to verify scheduler is calling this command
        $logNow = Carbon::now($timezone);
        Log::info('RunScheduledTasks command executed', [
            'timestamp' => $logNow->toIso8601String(),
            'timezone' => $timezone,
            'system_timezone' => date_default_timezone_get(),
        ]);

        // Use Carbon with explicit timezone
        $now = Carbon::now($timezone);
        $currentTime = $now->format('H:i');
        $currentDay = $now->dayOfWeek; // 0=Sunday, 6=Saturday
        $currentDate = $now->toDateString();

        $this->info("=== Checking scheduled tasks at {$currentTime} (Day: {$currentDay}, Date: {$currentDate}, Timezone: " . config('app.timezone') . ") ===");

        $tasks = \App\Models\ScheduledTask::where('is_active', true)->get();

        if ($tasks->isEmpty()) {
            $this->info("No active tasks found.");
            return;
        }

        $this->info("Found {$tasks->count()} active task(s)");

        foreach ($tasks as $task) {
            $this->info("--- Checking task: {$task->name} (ID: {$task->id}) ---");
            $this->info("  Frequency: {$task->frequency}, Time: {$task->time}, Active: " . ($task->is_active ? 'Yes' : 'No'));
            $this->info("  App Timezone: " . config('app.timezone') . ", Current DateTime: " . $now->toIso8601String());

            // Normalize scheduled time first (needed for comparisons)
            $scheduledTime = $this->normalizeTime($task->time);

            // Check if it already ran today at the same scheduled time (avoid double execution)
            if ($task->last_run_at) {
                $lastRunDate = $task->last_run_at->format('Y-m-d');
                $lastRunTime = $task->last_run_at->format('H:i');
                
                // If it ran today at the same scheduled time, skip
                if ($lastRunDate === $currentDate && $lastRunTime === $scheduledTime) {
                    $this->warn("  ⏭ Skipping: Already ran today at {$lastRunTime}");
                    continue;
                }
                
                $lastRunDiff = $now->diffInMinutes($task->last_run_at);
                $this->info("  Last run: {$task->last_run_at->format('Y-m-d H:i:s')} ({$lastRunDiff} minutes ago)");
            }

            // Check Time - compare normalized times
            
            $this->info("  Scheduled time: {$scheduledTime}, Current time: {$currentTime}");

            if ($scheduledTime !== $currentTime) {
                $this->warn("  ⏭ Skipping: Time mismatch (scheduled: {$scheduledTime}, current: {$currentTime})");
                continue;
            }

            // Check Frequency
            $shouldRun = false;
            $skipReason = '';

            if ($task->frequency === 'daily') {
                $shouldRun = true;
                $this->info("  ✓ Daily task - should run");
            } elseif ($task->frequency === 'weekly') {
                $daysOfWeek = $task->days_of_week ?? [];
                $this->info("  Weekly task - Days: " . json_encode($daysOfWeek) . ", Current day: {$currentDay}");
                if (in_array($currentDay, $daysOfWeek)) {
                    $shouldRun = true;
                    $this->info("  ✓ Current day matches - should run");
                } else {
                    $skipReason = "Current day ({$currentDay}) not in days_of_week";
                }
            } elseif ($task->frequency === 'monthly') {
                $createdDay = $task->created_at->day;
                $this->info("  Monthly task - Created on day {$createdDay}, Current day: {$now->day}");
                if ($now->day === $createdDay) {
                    $shouldRun = true;
                    $this->info("  ✓ Current day matches created day - should run");
                } else {
                    $skipReason = "Current day ({$now->day}) doesn't match created day ({$createdDay})";
                }
            } elseif ($task->frequency === 'once') {
                if ($task->run_at_date) {
                    /** @var \Carbon\Carbon $runDate */
                    $runDate = $task->run_at_date;
                    $runDateStr = $runDate->format('Y-m-d');
                    $this->info("  Once task - Run date: {$runDateStr}, Current date: {$currentDate}");
                    if ($runDateStr === $currentDate) {
                        $shouldRun = true;
                        $this->info("  ✓ Current date matches run date - should run");
                        // Deactivate after run
                        $task->is_active = false;
                    } else {
                        $skipReason = "Current date ({$currentDate}) doesn't match run date ({$runDateStr})";
                    }
                } else {
                    $skipReason = "run_at_date is not set";
                }
            }

            if (!$shouldRun) {
                $this->warn("  ⏭ Skipping: {$skipReason}");
                continue;
            }

            // All checks passed - execute the task
            $this->info("  ▶ Executing task...");
            $result = $this->executeTask($task, $timezone);
            
            $task->last_run_at = Carbon::now($timezone);
            $task->last_run_status = $result['success'] ? 'success' : 'failed';
            $task->last_run_output = $result['output'];
            $task->save();

            if ($result['success']) {
                $this->info("  ✓ Task executed successfully: {$result['output']}");
            } else {
                $this->error("  ✗ Task execution failed: {$result['output']}");
            }
        }

        $this->info("=== Finished checking tasks ===");
    }

    /**
     * Normalize time to H:i format
     * Handles both string ("22:00:00" or "22:00") and Carbon instances
     */
    private function normalizeTime($time): string
    {
        if (is_string($time)) {
            // Handle "22:00:00" or "22:00" format
            return substr($time, 0, 5);
        }
        
        if ($time instanceof \Carbon\Carbon || $time instanceof \DateTime) {
            return $time->format('H:i');
        }

        // Fallback: try to parse as string
        return substr((string) $time, 0, 5);
    }

    private function executeTask($task, string $timezone = 'America/Sao_Paulo'): array
    {
        $this->info("Executing task: {$task->name}");

        $computers = collect();
        if ($task->target_type === 'App\Models\Lab') {
            $lab = \App\Models\Lab::find($task->target_id);
            if ($lab) {
                $computers = $lab->computers;
            } else {
                return [
                    'success' => false,
                    'output' => "Laboratório #{$task->target_id} não encontrado"
                ];
            }
        } elseif ($task->target_type === 'App\Models\Computer') {
            $computer = \App\Models\Computer::find($task->target_id);
            if ($computer) {
                $computers = collect([$computer]);
            } else {
                return [
                    'success' => false,
                    'output' => "Computador #{$task->target_id} não encontrado"
                ];
            }
        } else {
            return [
                'success' => false,
                'output' => "Tipo de alvo inválido: {$task->target_type}"
            ];
        }

        if ($computers->isEmpty()) {
            return [
                'success' => false,
                'output' => "Nenhum computador encontrado para executar a tarefa"
            ];
        }

        $successCount = 0;
        $errorCount = 0;
        $errors = [];

        foreach ($computers as $computer) {
            try {
                // Logic based on RemoteControlController
                if ($task->command === 'wol') {
                    // WOL Logic is complex, requires proxy. For now, we'll try to use the same logic
                    $this->warn("WoL via Schedule - usando lógica simplificada");
                    
                    // Try to find a proxy computer in the same lab
                    $proxy = \App\Models\Computer::where('lab_id', $computer->lab_id)
                        ->where('id', '!=', $computer->id)
                        ->where('updated_at', '>=', Carbon::now($timezone)->subMinutes(5))
                        ->first();

                    if (!$proxy) {
                        throw new \Exception('Nenhum computador online no laboratório para servir de proxy WoL');
                    }

                    // Get MAC from hardware_info
                    $mac = null;
                    if (!empty($computer->hardware_info['network'])) {
                        foreach ($computer->hardware_info['network'] as $iface) {
                            if (!empty($iface['mac'])) {
                                $mac = $iface['mac'];
                                break;
                            }
                        }
                    }

                    if (!$mac) {
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
                $errorMsg = "Falha em {$computer->hostname}: " . $e->getMessage();
                $errors[] = $errorMsg;
                $this->error($errorMsg);
            }
        }

        $total = $computers->count();
        $output = "Executado em {$successCount}/{$total} computador(es)";
        
        if ($errorCount > 0) {
            $output .= ". Erros: " . implode('; ', $errors);
        }

        return [
            'success' => $successCount > 0,
            'output' => $output
        ];
    }
}
