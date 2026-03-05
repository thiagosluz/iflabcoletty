<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\LaravelLogParser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

class LogViewerController extends Controller
{
    private const MAX_TAIL_LINES = 50000;

    private const DEFAULT_TAIL_LINES = 20000;

    private const MAX_READ_BYTES = 2 * 1024 * 1024; // 2MB

    private const MAX_ENTRIES_PER_PAGE = 100;

    public function __construct(
        private LaravelLogParser $logParser
    ) {}

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
     * Get structured log entries (paginated, filterable)
     */
    public function entries(Request $request, string $filename)
    {
        $this->authorize('system.logs');

        if (strpos($filename, '/') !== false || strpos($filename, '\\') !== false) {
            return response()->json(['message' => 'Invalid filename'], 400);
        }

        $path = storage_path('logs/'.$filename);
        if (! File::exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        $validated = $request->validate([
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:'.self::MAX_ENTRIES_PER_PAGE,
            'level' => 'sometimes|nullable|string|in:ERROR,WARNING,INFO,DEBUG,NOTICE,CRITICAL,ALERT,EMERGENCY,OTHER',
            'search' => 'sometimes|nullable|string|max:500',
            'order' => 'sometimes|string|in:newest,oldest',
        ]);

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 25);
        $levelFilter = isset($validated['level']) ? (string) $validated['level'] : null;
        $search = isset($validated['search']) ? trim((string) $validated['search']) : null;
        $order = $validated['order'] ?? 'newest';

        $raw = $this->readLogContent($path);
        $entries = $this->logParser->parse($raw);

        if ($levelFilter !== null) {
            $entries = array_values(array_filter($entries, function ($e) use ($levelFilter) {
                return ($e['level'] ?? 'OTHER') === $levelFilter;
            }));
        }

        if ($search !== null && $search !== '') {
            $searchLower = mb_strtolower($search);
            $entries = array_values(array_filter($entries, function ($e) use ($searchLower) {
                return mb_strpos(mb_strtolower($e['message']), $searchLower) !== false;
            }));
        }

        if ($order === 'newest') {
            $entries = array_reverse($entries);
        }

        $total = count($entries);
        $totalPages = $perPage > 0 ? (int) ceil($total / $perPage) : 0;
        $offset = ($page - 1) * $perPage;
        $slice = array_slice($entries, $offset, $perPage);

        $data = [];
        foreach ($slice as $i => $e) {
            $data[] = [
                'id' => $offset + $i + 1,
                'timestamp' => $e['timestamp'],
                'env' => $e['env'],
                'level' => $e['level'],
                'message' => $e['message'],
                'lineNumber' => $e['lineNumber'],
            ];
        }

        return response()->json([
            'data' => $data,
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ]);
    }

    /**
     * Get log level statistics for a file
     */
    public function stats(string $filename)
    {
        $this->authorize('system.logs');

        if (strpos($filename, '/') !== false || strpos($filename, '\\') !== false) {
            return response()->json(['message' => 'Invalid filename'], 400);
        }

        $path = storage_path('logs/'.$filename);
        if (! File::exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        $raw = $this->readLogContent($path);
        $entries = $this->logParser->parse($raw);
        $counts = $this->logParser->countByLevel($entries);

        return response()->json(['levels' => $counts]);
    }

    /**
     * Read log file content (full if small, else last MAX_READ_BYTES)
     */
    private function readLogContent(string $path): string
    {
        $fileSize = File::size($path);
        if ($fileSize <= self::MAX_READ_BYTES) {
            return File::get($path);
        }

        return $this->readLastBytes($path, $fileSize, self::MAX_READ_BYTES);
    }

    /**
     * Show specific log content (with optional tail and truncation)
     */
    public function show(Request $request, $filename)
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

        $fileSize = File::size($path);
        $requestedTail = $request->integer('tail', self::DEFAULT_TAIL_LINES);
        $tail = min(max(1, $requestedTail), self::MAX_TAIL_LINES);

        $readFromStart = $fileSize <= self::MAX_READ_BYTES;
        $raw = $readFromStart
            ? File::get($path)
            : $this->readLastBytes($path, $fileSize, self::MAX_READ_BYTES);

        $lines = preg_split('/\r\n|\r|\n/', $raw);
        // Remove trailing empty line if file ends with newline
        if ($lines !== [] && $lines[array_key_last($lines)] === '') {
            array_pop($lines);
        }
        $totalLines = count($lines);
        $take = min($tail, $totalLines);
        $chunk = array_slice($lines, -$take);
        $content = implode("\n", $chunk);
        $truncated = ! $readFromStart || $take < $totalLines;
        $fromLine = $totalLines > 0 ? $totalLines - $take + 1 : 1;
        if (! $readFromStart) {
            $fromLine = 1; // unknown real offset when we only read last bytes
        }

        $payload = [
            'filename' => $filename,
            'content' => $content,
            'size' => $fileSize,
            'truncated' => $truncated,
            'from_line' => $fromLine,
            'total_lines' => $readFromStart ? $totalLines : null,
        ];

        return response()->json($payload);
    }

    /**
     * Download full log file (streamed)
     */
    public function download($filename)
    {
        $this->authorize('system.logs');

        if (strpos($filename, '/') !== false || strpos($filename, '\\') !== false) {
            return response()->json(['message' => 'Invalid filename'], 400);
        }

        $path = storage_path('logs/'.$filename);

        if (! File::exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return response()->streamDownload(function () use ($path) {
            $handle = fopen($path, 'rb');
            if ($handle) {
                while (! feof($handle)) {
                    echo fread($handle, 8192);
                    flush();
                }
                fclose($handle);
            }
        }, $filename, [
            'Content-Type' => 'text/plain',
        ]);
    }

    /**
     * Read last N bytes from file (for large files)
     */
    private function readLastBytes(string $path, int $fileSize, int $maxBytes): string
    {
        $length = min($maxBytes, $fileSize);
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return '';
        }
        fseek($handle, -$length, SEEK_END);
        $content = fread($handle, $length);
        fclose($handle);

        return $content ?: '';
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
