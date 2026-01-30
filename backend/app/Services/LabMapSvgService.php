<?php

namespace App\Services;

use Carbon\Carbon;

class LabMapSvgService
{
    private const WIDTH = 560;

    private const HEIGHT = 420;

    private const MARGIN = 10;

    private const BOX_SIZE = 24;

    private const ONLINE_MINUTES = 5;

    /**
     * Generate SVG string for the lab map (computers at position_x/position_y).
     * No XML declaration for safe embedding.
     *
     * @param  \Illuminate\Support\Collection|\Illuminate\Database\Eloquent\Collection  $computers
     */
    public static function generate($computers): string
    {
        $computers = collect($computers);
        $timezone = 'America/Sao_Paulo';
        $threshold = Carbon::now($timezone)->subMinutes(self::ONLINE_MINUTES);

        $innerWidth = self::WIDTH - 2 * self::MARGIN;
        $innerHeight = self::HEIGHT - 2 * self::MARGIN;

        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'.self::WIDTH.'" height="'.self::HEIGHT.'" viewBox="0 0 '.self::WIDTH.' '.self::HEIGHT.'">';
        $svg .= '<rect width="'.self::WIDTH.'" height="'.self::HEIGHT.'" fill="#f3f4f6"/>';

        /** @var \App\Models\Computer $computer */
        foreach ($computers as $computer) {
            $px = (int) ($computer->position_x ?? 0);
            $py = (int) ($computer->position_y ?? 0);
            $px = max(0, min(100, $px));
            $py = max(0, min(100, $py));

            $x = self::MARGIN + ($px / 100) * $innerWidth - self::BOX_SIZE / 2;
            $y = self::MARGIN + ($py / 100) * $innerHeight - self::BOX_SIZE / 2;
            $x = max(0, min(self::WIDTH - self::BOX_SIZE, $x));
            $y = max(0, min(self::HEIGHT - self::BOX_SIZE - 14, $y));

            $isOnline = self::isOnline($computer, $threshold, $timezone);
            $fill = $isOnline ? '#10b981' : '#9ca3af';
            $stroke = $isOnline ? '#059669' : '#6b7280';

            $svg .= '<rect x="'.round($x).'" y="'.round($y).'" width="'.self::BOX_SIZE.'" height="'.self::BOX_SIZE.'" rx="4" fill="'.$fill.'" stroke="'.$stroke.'" stroke-width="2"/>';

            $label = $computer->hostname
                ? mb_substr($computer->hostname, 0, 12)
                : mb_substr($computer->machine_id ?? '', 0, 8);
            $label = htmlspecialchars($label, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $textY = round($y) + self::BOX_SIZE + 10;
            $textX = round($x) + self::BOX_SIZE / 2;

            $svg .= '<text x="'.$textX.'" y="'.$textY.'" font-size="8" font-family="sans-serif" fill="#374151" text-anchor="middle">'.$label.'</text>';
        }

        $svg .= '</svg>';

        return $svg;
    }

    /**
     * Generate SVG and return as data URI for embedding in img src.
     *
     * @param  \Illuminate\Support\Collection|\Illuminate\Database\Eloquent\Collection  $computers
     */
    public static function generateDataUri($computers): string
    {
        $svg = self::generate($computers);

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }

    private static function isOnline($computer, Carbon $threshold, string $timezone): bool
    {
        if (! $computer->updated_at) {
            return false;
        }
        $updatedAt = $computer->updated_at instanceof Carbon
            ? $computer->updated_at->setTimezone($timezone)
            : Carbon::parse($computer->updated_at, $timezone);

        return $updatedAt->gte($threshold);
    }
}
