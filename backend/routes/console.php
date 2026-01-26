<?php

use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Log;

// Log when console routes are loaded (for debugging scheduler)
Log::info('Console routes loaded', ['timestamp' => now()->toIso8601String()]);

// Schedule daily database backup at 2 AM
Schedule::command('backup:database --clean')
    ->dailyAt('02:00')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping()
    ->runInBackground();

// Clean old backups weekly (on Sundays at 3 AM)
Schedule::call(function () {
    $retentionDays = (int) config('backup.retention_days', 30);
    \App\Services\BackupService::cleanOldBackups($retentionDays);
})->weeklyOn(0, '03:00')
    ->timezone('America/Sao_Paulo');

// Check computer status every 5 minutes
Schedule::command('computers:check-status')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->runInBackground();

// Check alert rules every minute
Schedule::command('alerts:check')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground();

// Run scheduled tasks every minute
// Note: Removed withoutOverlapping temporarily to avoid lock issues
Schedule::command('app:run-scheduled-tasks')
    ->everyMinute()
    ->timezone('America/Sao_Paulo')
    ->runInBackground()
    ->appendOutputTo(storage_path('logs/scheduled-tasks.log'))
    ->before(function () {
        Log::info('About to run app:run-scheduled-tasks', ['time' => now()->toIso8601String()]);
    })
    ->onSuccess(function () {
        Log::info('Scheduled task command executed successfully');
    })
    ->onFailure(function () {
        Log::error('Scheduled task command failed');
    });
