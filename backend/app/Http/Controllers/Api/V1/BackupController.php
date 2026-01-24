<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Backup;
use App\Services\BackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class BackupController extends Controller
{
    /**
     * List all backups
     */
    public function index(Request $request)
    {
        $this->authorize('backups.view');

        $query = Backup::with('user:id,name,email')
            ->orderBy('created_at', 'desc');

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->query('status'));
        }

        // Filter by type
        if ($request->has('type')) {
            $query->where('type', $request->query('type'));
        }

        // Search by filename
        if ($search = $request->query('search')) {
            $query->where('filename', 'like', "%{$search}%");
        }

        // Pagination
        $perPage = min(max((int) $request->query('per_page', 20), 5), 100);
        $backups = $query->paginate($perPage);

        // Add file_exists and file_size_human to each backup
        $backups->getCollection()->transform(function ($backup) {
            $backup->file_exists = $backup->fileExists();
            $backup->file_size_human = $backup->human_readable_size;

            return $backup;
        });

        return response()->json($backups);
    }

    /**
     * Get backup statistics
     */
    public function stats(BackupService $backupService)
    {
        $this->authorize('backups.view');

        $stats = $backupService->getBackupStats();

        return response()->json([
            'total' => $stats['total'],
            'completed' => $stats['completed'],
            'pending' => $stats['pending'],
            'failed' => $stats['failed'],
            'total_size' => $stats['total_size'],
            'total_size_human' => $this->formatBytes($stats['total_size']),
        ]);
    }

    /**
     * Show a specific backup
     */
    public function show(Backup $backup)
    {
        $this->authorize('backups.view');

        $backup->load('user:id,name,email');

        // Add computed attributes
        $backup->file_exists = $backup->fileExists();
        $backup->file_size_human = $backup->human_readable_size;

        return response()->json($backup);
    }

    /**
     * Create a new backup
     */
    public function store(Request $request, BackupService $backupService)
    {
        $this->authorize('backups.create');

        $validated = $request->validate([
            'type' => 'nullable|in:database,full',
        ]);

        $type = $validated['type'] ?? 'database';

        if ($type !== 'database') {
            return response()->json([
                'message' => 'Only database backups are currently supported',
            ], 400);
        }

        try {
            $backup = $backupService->createDatabaseBackup(auth()->id());

            return response()->json([
                'message' => 'Backup created successfully',
                'backup' => [
                    'id' => $backup->id,
                    'filename' => $backup->filename,
                    'file_size' => $backup->file_size,
                    'file_size_human' => $backup->human_readable_size,
                    'status' => $backup->status,
                    'created_at' => $backup->created_at,
                ],
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create backup: '.$e->getMessage());

            return response()->json([
                'message' => 'Failed to create backup',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download a backup file
     */
    public function download(Backup $backup)
    {
        $this->authorize('backups.view');

        if (! $backup->isCompleted()) {
            return response()->json([
                'message' => 'Backup is not completed',
            ], 400);
        }

        if (! $backup->fileExists()) {
            return response()->json([
                'message' => 'Backup file not found',
            ], 404);
        }

        // Get full path to the file
        $filePath = storage_path('app/'.$backup->file_path);

        if (! file_exists($filePath)) {
            return response()->json([
                'message' => 'Backup file not found on disk',
            ], 404);
        }

        // Return file download response
        return response()->download($filePath, $backup->filename, [
            'Content-Type' => 'application/octet-stream',
        ]);
    }

    /**
     * Delete a backup
     */
    public function destroy(Backup $backup)
    {
        $this->authorize('backups.delete');

        try {
            // Delete file if exists
            if ($backup->fileExists()) {
                Storage::delete($backup->file_path);
            }

            // Delete record
            $backup->delete();

            return response()->json([
                'message' => 'Backup deleted successfully',
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to delete backup {$backup->id}: ".$e->getMessage());

            return response()->json([
                'message' => 'Failed to delete backup',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Clean old backups
     */
    public function clean(Request $request, BackupService $backupService)
    {
        $this->authorize('backups.delete');

        $validated = $request->validate([
            'retention_days' => 'nullable|integer|min:1|max:365',
        ]);

        $retentionDays = $validated['retention_days'] ?? config('backup.retention_days', 30);

        try {
            $deletedCount = BackupService::cleanOldBackups($retentionDays);

            return response()->json([
                'message' => 'Old backups cleaned successfully',
                'deleted_count' => $deletedCount,
                'retention_days' => $retentionDays,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to clean old backups: '.$e->getMessage());

            return response()->json([
                'message' => 'Failed to clean old backups',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Restore a backup
     */
    public function restore(Backup $backup, BackupService $backupService)
    {
        $this->authorize('backups.restore');

        // Refresh backup to get latest status
        $backup->refresh();

        if (! $backup->isCompleted()) {
            return response()->json([
                'message' => 'Backup is not completed. Only completed backups can be restored.',
            ], 400);
        }

        if (! $backup->file_path) {
            return response()->json([
                'message' => 'Backup file path is missing',
            ], 400);
        }

        if (! $backup->fileExists()) {
            return response()->json([
                'message' => 'Backup file not found on disk',
            ], 404);
        }

        try {
            $backupService->restoreDatabaseBackup($backup);

            Log::info("Database restored from backup: {$backup->filename} by user ".auth()->id());

            return response()->json([
                'message' => 'Backup restored successfully',
                'backup' => [
                    'id' => $backup->id,
                    'filename' => $backup->filename,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to restore backup {$backup->id}: ".$e->getMessage());

            return response()->json([
                'message' => 'Failed to restore backup',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Format bytes to human-readable format
     */
    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, 2).' '.$units[$i];
    }
}
