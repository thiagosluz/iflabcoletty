<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;

class BackupDatabase extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'backup:database {--clean : Clean old backups after creating new one}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a backup of the database';

    /**
     * Execute the console command.
     */
    public function handle(BackupService $backupService): int
    {
        $this->info('Creating database backup...');

        try {
            $backup = $backupService->createDatabaseBackup();

            $this->info('Backup created successfully!');
            $this->info("Filename: {$backup->filename}");
            $this->info("Size: {$backup->human_readable_size}");
            $this->info("Path: {$backup->file_path}");

            // Clean old backups if requested
            if ($this->option('clean')) {
                $this->info('Cleaning old backups...');
                $retentionDays = (int) config('backup.retention_days', 30);
                $deletedCount = $backupService->cleanOldBackups($retentionDays);
                $this->info("Deleted {$deletedCount} old backup(s)");
            }

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Backup failed: '.$e->getMessage());

            return Command::FAILURE;
        }
    }
}
