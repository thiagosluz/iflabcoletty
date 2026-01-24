<?php

namespace App\Services;

use App\Models\Backup;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class BackupService
{
    /**
     * Create a database backup
     */
    public function createDatabaseBackup(?int $userId = null): Backup
    {
        $backup = Backup::create([
            'filename' => $this->generateFilename('database'),
            'file_path' => '', // Will be set after backup is created
            'type' => 'database',
            'status' => 'pending',
            'user_id' => $userId,
        ]);

        try {
            $filePath = $this->performDatabaseBackup($backup->filename);

            // Get file size from filesystem
            $fullPath = storage_path('app/'.$filePath);
            $fileSize = file_exists($fullPath) ? filesize($fullPath) : 0;

            $backup->update([
                'file_path' => $filePath,
                'file_size' => (string) $fileSize,
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            Log::info("Database backup created successfully: {$backup->filename}");

            return $backup;
        } catch (\Exception $e) {
            $backup->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);

            Log::error('Database backup failed: '.$e->getMessage());

            throw $e;
        }
    }

    /**
     * Perform the actual database backup
     */
    private function performDatabaseBackup(string $filename): string
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();
        $config = $connection->getConfig();

        $backupDir = 'backups';
        Storage::makeDirectory($backupDir);
        $filePath = $backupDir.'/'.$filename;

        switch ($driver) {
            case 'pgsql':
                return $this->backupPostgreSQL($config, $filePath);
            case 'mysql':
            case 'mariadb':
                return $this->backupMySQL($config, $filePath);
            case 'sqlite':
                return $this->backupSQLite($config, $filePath);
            default:
                throw new \Exception("Database driver '{$driver}' is not supported for backups");
        }
    }

    /**
     * Backup PostgreSQL database
     */
    private function backupPostgreSQL(array $config, string $filePath): string
    {
        $host = $config['host'];
        $port = $config['port'] ?? 5432;
        $database = $config['database'];
        $username = $config['username'];
        $password = $config['password'];

        // Set PGPASSWORD environment variable
        putenv("PGPASSWORD={$password}");

        $tempFile = storage_path('app/'.$filePath);
        $tempDir = dirname($tempFile);
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // Use pg_dump to create backup
        $command = sprintf(
            'pg_dump -h %s -p %d -U %s -F c -f %s %s 2>&1',
            escapeshellarg($host),
            $port,
            escapeshellarg($username),
            escapeshellarg($tempFile),
            escapeshellarg($database)
        );

        $output = [];
        $returnVar = 0;
        exec($command, $output, $returnVar);

        // Clear password from environment
        putenv('PGPASSWORD');

        if ($returnVar !== 0) {
            throw new \Exception('PostgreSQL backup failed: '.implode("\n", $output));
        }

        if (! file_exists($tempFile)) {
            throw new \Exception('Backup file was not created');
        }

        return $filePath;
    }

    /**
     * Find pg_dump executable
     */
    private function findPgDump(): ?string
    {
        $paths = [
            '/usr/bin/pg_dump',
            '/usr/local/bin/pg_dump',
            'pg_dump', // Try in PATH
        ];

        foreach ($paths as $path) {
            if ($path === 'pg_dump') {
                // Check if it's in PATH
                $which = shell_exec('which pg_dump 2>/dev/null');
                if ($which) {
                    return trim($which);
                }
            } else {
                if (file_exists($path) && is_executable($path)) {
                    return $path;
                }
            }
        }

        return null;
    }

    /**
     * Backup MySQL/MariaDB database
     */
    private function backupMySQL(array $config, string $filePath): string
    {
        $host = $config['host'];
        $port = $config['port'] ?? 3306;
        $database = $config['database'];
        $username = $config['username'];
        $password = $config['password'];

        $tempFile = storage_path('app/'.$filePath);
        $tempDir = dirname($tempFile);
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // Use mysqldump to create backup
        $command = sprintf(
            'mysqldump -h %s -P %d -u %s -p%s %s > %s 2>&1',
            escapeshellarg($host),
            $port,
            escapeshellarg($username),
            escapeshellarg($password),
            escapeshellarg($database),
            escapeshellarg($tempFile)
        );

        $output = [];
        $returnVar = 0;
        exec($command, $output, $returnVar);

        if ($returnVar !== 0) {
            throw new \Exception('MySQL backup failed: '.implode("\n", $output));
        }

        if (! file_exists($tempFile)) {
            throw new \Exception('Backup file was not created');
        }

        return $filePath;
    }

    /**
     * Backup SQLite database
     */
    private function backupSQLite(array $config, string $filePath): string
    {
        $database = $config['database'];

        if (! file_exists($database)) {
            throw new \Exception("SQLite database file not found: {$database}");
        }

        $tempFile = storage_path('app/'.$filePath);
        $tempDir = dirname($tempFile);
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // Copy SQLite file
        if (! copy($database, $tempFile)) {
            throw new \Exception('Failed to copy SQLite database file');
        }

        return $filePath;
    }

    /**
     * Generate filename for backup
     */
    private function generateFilename(string $type): string
    {
        $timestamp = now()->format('Y-m-d_His');
        $extension = config('database.default') === 'pgsql' ? 'dump' : 'sql';

        return "backup_{$type}_{$timestamp}.{$extension}";
    }

    /**
     * Clean old backups based on retention policy
     */
    public static function cleanOldBackups(?int $retentionDays = null): int
    {
        if ($retentionDays === null) {
            $retentionDays = (int) config('backup.retention_days', 30);
        }

        $cutoffDate = Carbon::now()->subDays($retentionDays);

        $oldBackups = Backup::where('created_at', '<', $cutoffDate)
            ->where('status', 'completed')
            ->get();

        $deletedCount = 0;

        foreach ($oldBackups as $backup) {
            try {
                // Delete file
                if ($backup->fileExists()) {
                    Storage::delete($backup->file_path);
                }

                // Delete record
                $backup->delete();
                $deletedCount++;

                Log::info("Deleted old backup: {$backup->filename}");
            } catch (\Exception $e) {
                Log::error("Failed to delete backup {$backup->id}: ".$e->getMessage());
            }
        }

        return $deletedCount;
    }

    /**
     * Get total size of all backups
     */
    public function getTotalBackupSize(): int
    {
        return Backup::where('status', 'completed')
            ->sum(DB::raw('CAST(file_size AS BIGINT)'));
    }

    /**
     * Get count of backups by status
     */
    public function getBackupStats(): array
    {
        return [
            'total' => Backup::count(),
            'completed' => Backup::where('status', 'completed')->count(),
            'pending' => Backup::where('status', 'pending')->count(),
            'failed' => Backup::where('status', 'failed')->count(),
            'total_size' => $this->getTotalBackupSize(),
        ];
    }

    /**
     * Restore a database backup
     */
    public function restoreDatabaseBackup(Backup $backup): void
    {
        if (! $backup->isCompleted()) {
            throw new \Exception('Backup is not completed');
        }

        if (! $backup->fileExists()) {
            throw new \Exception('Backup file not found');
        }

        $connection = DB::connection();
        $driver = $connection->getDriverName();
        $config = $connection->getConfig();

        $filePath = storage_path('app/'.$backup->file_path);

        switch ($driver) {
            case 'pgsql':
                $this->restorePostgreSQL($config, $filePath);
                break;
            case 'mysql':
            case 'mariadb':
                $this->restoreMySQL($config, $filePath);
                break;
            case 'sqlite':
                $this->restoreSQLite($config, $filePath);
                break;
            default:
                throw new \Exception("Database driver '{$driver}' is not supported for restore");
        }
    }

    /**
     * Restore PostgreSQL database
     */
    private function restorePostgreSQL(array $config, string $filePath): void
    {
        $host = $config['host'];
        $port = $config['port'] ?? 5432;
        $database = $config['database'];
        $username = $config['username'];
        $password = $config['password'];

        $pgRestorePath = $this->findPgRestore();

        if (! $pgRestorePath) {
            throw new \Exception('pg_restore command not found. Please install postgresql-client package.');
        }

        // Set PGPASSWORD environment variable
        putenv("PGPASSWORD={$password}");

        // Use pg_restore to restore backup
        // -c: clean (drop) database objects before recreating
        // -v: verbose mode
        // --no-owner: skip restoration of object ownership
        // --no-acl: skip restoration of access privileges
        // --if-exists: use IF EXISTS when dropping objects
        $command = sprintf(
            '%s -h %s -p %d -U %s -d %s -c --if-exists --no-owner --no-acl %s 2>&1',
            escapeshellarg($pgRestorePath),
            escapeshellarg($host),
            $port,
            escapeshellarg($username),
            escapeshellarg($database),
            escapeshellarg($filePath)
        );

        $output = [];
        $returnVar = 0;
        exec($command, $output, $returnVar);

        // Clear password from environment
        putenv('PGPASSWORD');

        // Filter out non-critical warnings/errors
        $criticalErrors = array_filter($output, function ($line) {
            // Ignore warnings about unrecognized configuration parameters
            // and other non-critical messages
            $ignoredPatterns = [
                'unrecognized configuration parameter',
                'errors ignored on restore',
                'WARNING:',
                'warning:',
            ];

            foreach ($ignoredPatterns as $pattern) {
                if (stripos($line, $pattern) !== false) {
                    return false; // Not a critical error
                }
            }

            // Check for actual ERROR messages (not warnings)
            if (stripos($line, 'ERROR:') !== false &&
                stripos($line, 'unrecognized configuration parameter') === false) {
                return true; // Critical error
            }

            return false;
        });

        // Only fail if there are critical errors or return code indicates failure
        // Note: pg_restore may return non-zero even on success if there are warnings
        if ($returnVar !== 0 && ! empty($criticalErrors)) {
            $error = implode("\n", $output);
            throw new \Exception("PostgreSQL restore failed: {$error}");
        }

        // Log warnings but don't fail
        if (! empty($output)) {
            $warnings = array_filter($output, function ($line) {
                return stripos($line, 'warning') !== false ||
                       stripos($line, 'WARNING') !== false;
            });
            if (! empty($warnings)) {
                Log::warning('PostgreSQL restore warnings: '.implode("\n", $warnings));
            }
        }
    }

    /**
     * Restore MySQL/MariaDB database
     */
    private function restoreMySQL(array $config, string $filePath): void
    {
        $host = $config['host'];
        $port = $config['port'] ?? 3306;
        $database = $config['database'];
        $username = $config['username'];
        $password = $config['password'];

        // Use mysql to restore backup
        $command = sprintf(
            'mysql -h %s -P %d -u %s -p%s %s < %s 2>&1',
            escapeshellarg($host),
            $port,
            escapeshellarg($username),
            escapeshellarg($password),
            escapeshellarg($database),
            escapeshellarg($filePath)
        );

        $output = [];
        $returnVar = 0;
        exec($command, $output, $returnVar);

        if ($returnVar !== 0) {
            throw new \Exception('MySQL restore failed: '.implode("\n", $output));
        }
    }

    /**
     * Restore SQLite database
     */
    private function restoreSQLite(array $config, string $filePath): void
    {
        $database = $config['database'];
        $databaseDir = dirname($database);

        if (! is_dir($databaseDir)) {
            mkdir($databaseDir, 0755, true);
        }

        // Copy backup file to database location
        if (! copy($filePath, $database)) {
            throw new \Exception('Failed to restore SQLite database file');
        }
    }

    /**
     * Find pg_restore executable
     */
    private function findPgRestore(): ?string
    {
        $paths = [
            '/usr/bin/pg_restore',
            '/usr/local/bin/pg_restore',
            'pg_restore', // Try in PATH
        ];

        foreach ($paths as $path) {
            if ($path === 'pg_restore') {
                // Check if it's in PATH
                $which = shell_exec('which pg_restore 2>/dev/null');
                if ($which) {
                    return trim($which);
                }
            } else {
                if (file_exists($path) && is_executable($path)) {
                    return $path;
                }
            }
        }

        return null;
    }
}
