<?php

namespace App\Services;

class LaravelLogParser
{
    /** @var string Regex for Laravel log line: [YYYY-MM-DD HH:MM:SS] env.LEVEL: message */
    private const LINE_PATTERN = '/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+([^\s.]+)\.(\w+):\s*(.*)$/s';

    /**
     * Parse raw log content into structured entries (timestamp, env, level, message, lineNumber).
     * Lines that don't match the pattern are appended to the previous entry's message.
     *
     * @return array<int, array{timestamp: string, env: string|null, level: string|null, message: string, lineNumber: int}>
     */
    public function parse(string $content): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $content);
        $entries = [];
        $current = null;

        foreach ($lines as $index => $line) {
            $lineNumber = $index + 1;

            if (preg_match(self::LINE_PATTERN, $line, $m)) {
                if ($current !== null) {
                    $entries[] = $current;
                }
                $current = [
                    'timestamp' => $m[1],
                    'env' => $m[2],
                    'level' => strtoupper($m[3]),
                    'message' => trim($m[4]),
                    'lineNumber' => $lineNumber,
                ];
            } else {
                if ($current !== null) {
                    $current['message'] .= "\n".$line;
                } else {
                    $current = [
                        'timestamp' => null,
                        'env' => null,
                        'level' => null,
                        'message' => $line,
                        'lineNumber' => $lineNumber,
                    ];
                }
            }
        }

        if ($current !== null) {
            $entries[] = $current;
        }

        return $entries;
    }

    /**
     * Count entries per level from parsed entries.
     *
     * @param array<int, array{level: string|null}> $entries
     * @return array<string, int>
     */
    public function countByLevel(array $entries): array
    {
        $counts = [
            'ERROR' => 0,
            'WARNING' => 0,
            'INFO' => 0,
            'DEBUG' => 0,
            'NOTICE' => 0,
            'CRITICAL' => 0,
            'ALERT' => 0,
            'EMERGENCY' => 0,
            'OTHER' => 0,
        ];

        foreach ($entries as $entry) {
            $level = $entry['level'] ?? null;
            if ($level !== null && isset($counts[$level])) {
                $counts[$level]++;
            } else {
                $counts['OTHER']++;
            }
        }

        return $counts;
    }
}
