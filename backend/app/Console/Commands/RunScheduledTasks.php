<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

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
        $now = now();
        $currentTime = $now->format('H:i');
        $currentDay = $now->dayOfWeek; // 0=Sunday, 6=Saturday
        $currentDate = $now->toDateString();

        $this->info("Checking tasks for {$currentTime} (Day: {$currentDay}, Date: {$currentDate})");

        $tasks = \App\Models\ScheduledTask::where('is_active', true)->get();

        foreach ($tasks as $task) {
            // Check if it already ran today/now (avoid double execution if cron runs often)
            // Ideally we check last_run_at within the last minute.
            if ($task->last_run_at && $task->last_run_at->format('Y-m-d H:i') === $now->format('Y-m-d H:i')) {
                continue;
            }

            // Check Time
            // Scheduled time e.g. "22:00:00" matched against "22:00"
            if (substr($task->time, 0, 5) !== $currentTime) {
                continue;
            }

            // Check Frequency
            $shouldRun = false;
            if ($task->frequency === 'daily') {
                $shouldRun = true;
            } elseif ($task->frequency === 'weekly') {
                if (in_array($currentDay, $task->days_of_week ?? [])) {
                    $shouldRun = true;
                }
            } elseif ($task->frequency === 'once') {
                if ($task->run_at_date && $task->run_at_date->format('Y-m-d') === $currentDate) {
                    $shouldRun = true;
                    // Deactivate after run
                    $task->is_active = false;
                }
            }

            if ($shouldRun) {
                $this->executeTask($task);
                $task->last_run_at = now();
                $task->save();
            }
        }
    }

    private function executeTask($task)
    {
        $this->info("Executing task: {$task->name}");

        $computers = collect();
        if ($task->target_type === 'App\Models\Lab') {
            $lab = \App\Models\Lab::find($task->target_id);
            if ($lab) {
                $computers = $lab->computers;
            }
        } elseif ($task->target_type === 'App\Models\Computer') {
            $computer = \App\Models\Computer::find($task->target_id);
            if ($computer) {
                $computers = collect([$computer]);
            }
        }

        foreach ($computers as $computer) {
            try {
                // Logic based on RemoteControlController
                if ($task->command === 'wol') {
                    // WOL Logic is complex, requires proxy. Skipping for simplicity in MVP or calling Controller method?
                    // Ideally extract Service. For now, log warning.
                    $this->warn("WoL via Schedule not fully implemented yet.");
                } else {
                    $computer->commands()->create([
                        'user_id' => $task->user_id,
                        'command' => $task->command,
                        'parameters' => [],
                        'status' => 'pending',
                    ]);
                }
            } catch (\Exception $e) {
                $this->error("Failed to execute on {$computer->hostname}: " . $e->getMessage());
            }
        }
    }
}
