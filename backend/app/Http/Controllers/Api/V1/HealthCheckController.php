<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\BackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;

class HealthCheckController extends Controller
{
    /**
     * Get system health metrics
     */
    public function health(Request $request)
    {
        $this->authorize('dashboard.view'); // Require admin access

        $metrics = [
            'database' => $this->getDatabaseMetrics(),
            'storage' => $this->getStorageMetrics(),
            'queue' => $this->getQueueMetrics(),
            'cache' => $this->getCacheMetrics(),
            'system' => $this->getSystemMetrics(),
            'alerts' => $this->getSystemAlerts(),
            'timestamp' => now()->toIso8601String(),
        ];

        return response()->json($metrics);
    }

    /**
     * Get database metrics
     */
    private function getDatabaseMetrics(): array
    {
        try {
            $connection = DB::connection();
            $driver = $connection->getDriverName();

            $metrics = [
                'driver' => $driver,
                'connected' => true,
            ];

            if ($driver === 'pgsql') {
                // PostgreSQL
                $dbName = $connection->getDatabaseName();
                
                // Get database size
                $sizeQuery = "SELECT pg_size_pretty(pg_database_size('{$dbName}')) as size, 
                             pg_database_size('{$dbName}') as size_bytes";
                $sizeResult = DB::selectOne($sizeQuery);
                
                $metrics['size'] = $sizeResult->size ?? 'Unknown';
                $metrics['size_bytes'] = (int) ($sizeResult->size_bytes ?? 0);
                
                // Get table counts
                $tables = DB::select("SELECT 
                    schemaname,
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
                    FROM pg_tables
                    WHERE schemaname = 'public'
                    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                    LIMIT 10");
                
                $metrics['top_tables'] = array_map(function ($table) {
                    return [
                        'name' => $table->tablename,
                        'size' => $table->size,
                        'size_bytes' => (int) $table->size_bytes,
                    ];
                }, $tables);
                
            } elseif ($driver === 'mysql') {
                // MySQL
                $dbName = $connection->getDatabaseName();
                
                // Get database size
                $sizeQuery = "SELECT 
                    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb,
                    ROUND(SUM(data_length + index_length) / 1024 / 1024 / 1024, 2) AS size_gb
                    FROM information_schema.tables 
                    WHERE table_schema = '{$dbName}'";
                $sizeResult = DB::selectOne($sizeQuery);
                
                $sizeBytes = (int) (($sizeResult->size_mb ?? 0) * 1024 * 1024);
                $metrics['size'] = ($sizeResult->size_gb ?? 0) . ' GB';
                $metrics['size_bytes'] = $sizeBytes;
                
                // Get table sizes
                $tables = DB::select("SELECT 
                    table_name AS name,
                    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
                    (data_length + index_length) AS size_bytes
                    FROM information_schema.TABLES
                    WHERE table_schema = '{$dbName}'
                    ORDER BY (data_length + index_length) DESC
                    LIMIT 10");
                
                $metrics['top_tables'] = array_map(function ($table) {
                    return [
                        'name' => $table->name,
                        'size' => $table->size_mb . ' MB',
                        'size_bytes' => (int) $table->size_bytes,
                    ];
                }, $tables);
            } else {
                $metrics['size'] = 'N/A';
                $metrics['size_bytes'] = 0;
                $metrics['top_tables'] = [];
            }

            // Get connection info
            $metrics['connection'] = [
                'host' => $connection->getConfig('host'),
                'port' => $connection->getConfig('port'),
                'database' => $connection->getDatabaseName(),
            ];

            return $metrics;
        } catch (\Exception $e) {
            return [
                'connected' => false,
                'error' => $e->getMessage(),
                'size' => 'Unknown',
                'size_bytes' => 0,
            ];
        }
    }

    /**
     * Get storage metrics (backups, logs)
     */
    private function getStorageMetrics(): array
    {
        $metrics = [
            'backups' => $this->getBackupStorageMetrics(),
            'logs' => $this->getLogStorageMetrics(),
            'storage' => $this->getStorageDiskMetrics(),
        ];

        return $metrics;
    }

    /**
     * Get backup storage metrics
     */
    private function getBackupStorageMetrics(): array
    {
        try {
            $backupService = app(BackupService::class);
            $stats = $backupService->getBackupStats();
            
            // Calculate actual disk usage for backup directory
            $backupPath = storage_path('app/backups');
            $backupSize = 0;
            
            if (is_dir($backupPath)) {
                $backupSize = $this->getDirectorySize($backupPath);
            }

            return [
                'total_backups' => $stats['total'],
                'completed' => $stats['completed'],
                'pending' => $stats['pending'],
                'failed' => $stats['failed'],
                'total_size_bytes' => $stats['total_size'],
                'total_size' => $this->formatBytes($stats['total_size']),
                'disk_usage_bytes' => $backupSize,
                'disk_usage' => $this->formatBytes($backupSize),
            ];
        } catch (\Exception $e) {
            return [
                'error' => $e->getMessage(),
                'total_backups' => 0,
                'total_size_bytes' => 0,
                'total_size' => '0 B',
            ];
        }
    }

    /**
     * Get log storage metrics
     */
    private function getLogStorageMetrics(): array
    {
        try {
            $logPath = storage_path('logs');
            $logSize = 0;
            $logFiles = [];

            if (is_dir($logPath)) {
                $logSize = $this->getDirectorySize($logPath);
                
                // Get recent log files
                $files = glob($logPath . '/*.log');
                usort($files, function ($a, $b) {
                    return filemtime($b) - filemtime($a);
                });
                
                $logFiles = array_slice($files, 0, 10);
                $logFiles = array_map(function ($file) {
                    return [
                        'name' => basename($file),
                        'size' => $this->formatBytes(filesize($file)),
                        'size_bytes' => filesize($file),
                        'modified' => date('Y-m-d H:i:s', filemtime($file)),
                    ];
                }, $logFiles);
            }

            return [
                'total_size_bytes' => $logSize,
                'total_size' => $this->formatBytes($logSize),
                'recent_files' => $logFiles,
            ];
        } catch (\Exception $e) {
            return [
                'error' => $e->getMessage(),
                'total_size_bytes' => 0,
                'total_size' => '0 B',
            ];
        }
    }

    /**
     * Get storage disk metrics
     */
    private function getStorageDiskMetrics(): array
    {
        try {
            $storagePath = storage_path();
            $totalSpace = disk_total_space($storagePath);
            $freeSpace = disk_free_space($storagePath);
            $usedSpace = $totalSpace - $freeSpace;
            $usagePercent = $totalSpace > 0 ? ($usedSpace / $totalSpace) * 100 : 0;

            return [
                'total_bytes' => $totalSpace,
                'total' => $this->formatBytes($totalSpace),
                'free_bytes' => $freeSpace,
                'free' => $this->formatBytes($freeSpace),
                'used_bytes' => $usedSpace,
                'used' => $this->formatBytes($usedSpace),
                'usage_percent' => round($usagePercent, 2),
            ];
        } catch (\Exception $e) {
            return [
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get queue metrics
     */
    private function getQueueMetrics(): array
    {
        try {
            $connection = config('queue.default', 'sync');
            $metrics = [
                'driver' => $connection,
                'connected' => false,
            ];

            if ($connection === 'redis') {
                try {
                    $redis = app('redis');
                    $redis->ping();
                    $metrics['connected'] = true;

                    // Get queue sizes (if using Redis)
                    $queues = ['default', 'high', 'low'];
                    $queueSizes = [];
                    
                    foreach ($queues as $queue) {
                        try {
                            $size = $redis->llen("queues:{$queue}");
                            $queueSizes[$queue] = $size;
                        } catch (\Exception $e) {
                            $queueSizes[$queue] = 0;
                        }
                    }
                    
                    $metrics['queue_sizes'] = $queueSizes;
                    $metrics['total_pending'] = array_sum($queueSizes);
                } catch (\Exception $e) {
                    $metrics['error'] = $e->getMessage();
                }
            } elseif ($connection === 'database') {
                $metrics['connected'] = true;
                $metrics['total_pending'] = DB::table('jobs')->whereNull('reserved_at')->count();
                $metrics['total_failed'] = DB::table('failed_jobs')->count();
            } else {
                $metrics['connected'] = true;
                $metrics['note'] = 'Sync driver - no queue metrics available';
            }

            // Get failed jobs count
            try {
                $failedCount = DB::table('failed_jobs')->count();
                $metrics['failed_jobs'] = $failedCount;
            } catch (\Exception $e) {
                $metrics['failed_jobs'] = 0;
            }

            return $metrics;
        } catch (\Exception $e) {
            return [
                'connected' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get cache metrics
     */
    private function getCacheMetrics(): array
    {
        try {
            $driver = config('cache.default', 'file');
            $metrics = [
                'driver' => $driver,
                'connected' => false,
            ];

            if ($driver === 'redis') {
                try {
                    $redis = app('redis');
                    $redis->ping();
                    $metrics['connected'] = true;
                    
                    // Get Redis info
                    $info = $redis->info('memory');
                    $metrics['memory_used'] = $info['used_memory_human'] ?? 'Unknown';
                    $metrics['memory_used_bytes'] = (int) ($info['used_memory'] ?? 0);
                } catch (\Exception $e) {
                    $metrics['error'] = $e->getMessage();
                }
            } else {
                $metrics['connected'] = true;
                $metrics['note'] = 'File cache - no detailed metrics';
            }

            // Test cache
            try {
                $testKey = 'health_check_' . time();
                Cache::put($testKey, 'test', 60);
                $metrics['working'] = Cache::get($testKey) === 'test';
                Cache::forget($testKey);
            } catch (\Exception $e) {
                $metrics['working'] = false;
                $metrics['test_error'] = $e->getMessage();
            }

            return $metrics;
        } catch (\Exception $e) {
            return [
                'connected' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get system metrics (CPU, RAM)
     */
    private function getSystemMetrics(): array
    {
        $metrics = [
            'available' => false,
        ];

        // Try to get system metrics (requires exec permissions)
        try {
            if (function_exists('sys_getloadavg')) {
                $load = sys_getloadavg();
                $metrics['load_average'] = [
                    '1min' => round($load[0], 2),
                    '5min' => round($load[1], 2),
                    '15min' => round($load[2], 2),
                ];
                $metrics['available'] = true;
            }

            // Memory info (Linux)
            if (is_readable('/proc/meminfo')) {
                $meminfo = file_get_contents('/proc/meminfo');
                preg_match('/MemTotal:\s+(\d+)\s+kB/', $meminfo, $total);
                preg_match('/MemAvailable:\s+(\d+)\s+kB/', $meminfo, $available);
                
                if (isset($total[1]) && isset($available[1])) {
                    $totalBytes = (int) $total[1] * 1024;
                    $availableBytes = (int) $available[1] * 1024;
                    $usedBytes = $totalBytes - $availableBytes;
                    $usagePercent = ($usedBytes / $totalBytes) * 100;

                    $metrics['memory'] = [
                        'total_bytes' => $totalBytes,
                        'total' => $this->formatBytes($totalBytes),
                        'available_bytes' => $availableBytes,
                        'available' => $this->formatBytes($availableBytes),
                        'used_bytes' => $usedBytes,
                        'used' => $this->formatBytes($usedBytes),
                        'usage_percent' => round($usagePercent, 2),
                    ];
                    $metrics['available'] = true;
                }
            }
        } catch (\Exception $e) {
            $metrics['error'] = $e->getMessage();
        }

        return $metrics;
    }

    /**
     * Get system alerts (critical issues)
     */
    private function getSystemAlerts(): array
    {
        $alerts = [];

        // Check database connection
        try {
            DB::connection()->getPdo();
        } catch (\Exception $e) {
            $alerts[] = [
                'level' => 'critical',
                'type' => 'database',
                'message' => 'Database connection failed',
                'details' => $e->getMessage(),
            ];
        }

        // Check queue connection
        $queueMetrics = $this->getQueueMetrics();
        if (!$queueMetrics['connected']) {
            $alerts[] = [
                'level' => 'warning',
                'type' => 'queue',
                'message' => 'Queue connection failed',
                'details' => $queueMetrics['error'] ?? 'Unknown error',
            ];
        }

        // Check for too many failed jobs
        if (isset($queueMetrics['failed_jobs']) && $queueMetrics['failed_jobs'] > 100) {
            $alerts[] = [
                'level' => 'warning',
                'type' => 'queue',
                'message' => "High number of failed jobs: {$queueMetrics['failed_jobs']}",
            ];
        }

        // Check disk space
        $storageMetrics = $this->getStorageDiskMetrics();
        if (isset($storageMetrics['usage_percent']) && $storageMetrics['usage_percent'] > 90) {
            $alerts[] = [
                'level' => 'critical',
                'type' => 'storage',
                'message' => 'Disk space critically low',
                'details' => "Usage: {$storageMetrics['usage_percent']}%",
            ];
        } elseif (isset($storageMetrics['usage_percent']) && $storageMetrics['usage_percent'] > 80) {
            $alerts[] = [
                'level' => 'warning',
                'type' => 'storage',
                'message' => 'Disk space running low',
                'details' => "Usage: {$storageMetrics['usage_percent']}%",
            ];
        }

        // Check memory usage
        $systemMetrics = $this->getSystemMetrics();
        if (isset($systemMetrics['memory']['usage_percent']) && $systemMetrics['memory']['usage_percent'] > 90) {
            $alerts[] = [
                'level' => 'warning',
                'type' => 'system',
                'message' => 'High memory usage',
                'details' => "Usage: {$systemMetrics['memory']['usage_percent']}%",
            ];
        }

        return $alerts;
    }

    /**
     * Calculate directory size recursively
     */
    private function getDirectorySize(string $directory): int
    {
        $size = 0;
        
        if (!is_dir($directory)) {
            return 0;
        }

        try {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS)
            );

            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $size += $file->getSize();
                }
            }
        } catch (\Exception $e) {
            // If we can't read the directory, return 0
            return 0;
        }

        return $size;
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, $precision) . ' ' . $units[$i];
    }
}
