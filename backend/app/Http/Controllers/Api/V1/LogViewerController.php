<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\File;

class LogViewerController extends Controller
{
    /**
     * List all log files
     */
    public function index()
    {
        $this->authorize('system.logs');

        $logPath = storage_path('logs');
        $files = File::glob("$logPath/*.log");

        $logs = collect($files)->map(function ($path) {
            return [
                'filename' => basename($path),
                'size' => File::size($path),
                'last_modified' => File::lastModified($path),
                'formatted_size' => $this->formatBytes(File::size($path)),
                'formatted_last_modified' => date('Y-m-d H:i:s', File::lastModified($path)),
            ];
        })->sortByDesc('last_modified')->values();

        return response()->json($logs);
    }

    /**
     * Show specific log content
     */
    public function show($filename)
    {
        $this->authorize('system.logs');

        // Basic directory traversal protection
        if (strpos($filename, '/') !== false || strpos($filename, '\\') !== false) {
            return response()->json(['message' => 'Invalid filename'], 400);
        }

        $path = storage_path('logs/'.$filename);

        if (! File::exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        // For very large files, we might want to limit this, but for now we return full content
        // The frontend will handle displaying it.
        $content = File::get($path);

        return response()->json([
            'filename' => $filename,
            'content' => $content,
            'size' => File::size($path),
        ]);
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
