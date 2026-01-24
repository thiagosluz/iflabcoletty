<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Schedule;

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
