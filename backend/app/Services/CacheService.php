<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class CacheService
{
    /**
     * Cache keys prefix
     */
    const PREFIX = 'iflab:';

    /**
     * Cache TTL in seconds
     */
    const TTL = 3600; // 1 hour

    /**
     * Get cache key for dashboard stats
     */
    public static function dashboardStatsKey(): string
    {
        return self::PREFIX.'dashboard:stats';
    }

    /**
     * Get cache key for labs listing
     */
    public static function labsListKey(array $filters = []): string
    {
        $key = self::PREFIX.'labs:list';
        if (! empty($filters)) {
            $key .= ':'.md5(json_encode($filters));
        }

        return $key;
    }

    /**
     * Get cache key for computers listing
     */
    public static function computersListKey(array $filters = []): string
    {
        $key = self::PREFIX.'computers:list';
        if (! empty($filters)) {
            $key .= ':'.md5(json_encode($filters));
        }

        return $key;
    }

    /**
     * Get cache key for softwares listing
     */
    public static function softwaresListKey(array $filters = []): string
    {
        $key = self::PREFIX.'softwares:list';
        if (! empty($filters)) {
            $key .= ':'.md5(json_encode($filters));
        }

        return $key;
    }

    /**
     * Get cache key for lab details
     */
    public static function labDetailsKey(int $labId): string
    {
        return self::PREFIX.'lab:'.$labId;
    }

    /**
     * Get cache key for computer details
     */
    public static function computerDetailsKey(int $computerId): string
    {
        return self::PREFIX.'computer:'.$computerId;
    }

    /**
     * Get cache key for software details
     */
    public static function softwareDetailsKey(int $softwareId): string
    {
        return self::PREFIX.'software:'.$softwareId;
    }

    /**
     * Invalidate all cache related to labs
     */
    public static function invalidateLabs(): void
    {
        try {
            // Invalidate dashboard stats (depends on labs)
            Cache::forget(self::dashboardStatsKey());

            // Invalidate all labs list caches (using tags if available, otherwise pattern matching)
            self::invalidateByPattern(self::PREFIX.'labs:*');
        } catch (\Exception $e) {
            Log::error('Failed to invalidate labs cache: '.$e->getMessage());
        }
    }

    /**
     * Invalidate all cache related to computers
     */
    public static function invalidateComputers(): void
    {
        try {
            // Invalidate dashboard stats (depends on computers)
            Cache::forget(self::dashboardStatsKey());

            // Invalidate all computers list caches
            self::invalidateByPattern(self::PREFIX.'computers:*');
        } catch (\Exception $e) {
            Log::error('Failed to invalidate computers cache: '.$e->getMessage());
        }
    }

    /**
     * Invalidate all cache related to softwares
     */
    public static function invalidateSoftwares(): void
    {
        try {
            // Invalidate dashboard stats (depends on softwares)
            Cache::forget(self::dashboardStatsKey());

            // Invalidate all softwares list caches
            self::invalidateByPattern(self::PREFIX.'softwares:*');
        } catch (\Exception $e) {
            Log::error('Failed to invalidate softwares cache: '.$e->getMessage());
        }
    }

    /**
     * Invalidate cache for a specific lab
     */
    public static function invalidateLab(int $labId): void
    {
        try {
            Cache::forget(self::labDetailsKey($labId));
            self::invalidateLabs(); // Also invalidate lists
        } catch (\Exception $e) {
            Log::error("Failed to invalidate lab {$labId} cache: ".$e->getMessage());
        }
    }

    /**
     * Invalidate cache for a specific computer
     */
    public static function invalidateComputer(int $computerId): void
    {
        try {
            Cache::forget(self::computerDetailsKey($computerId));
            self::invalidateComputers(); // Also invalidate lists
        } catch (\Exception $e) {
            Log::error("Failed to invalidate computer {$computerId} cache: ".$e->getMessage());
        }
    }

    /**
     * Invalidate cache for a specific software
     */
    public static function invalidateSoftware(int $softwareId): void
    {
        try {
            Cache::forget(self::softwareDetailsKey($softwareId));
            self::invalidateSoftwares(); // Also invalidate lists
        } catch (\Exception $e) {
            Log::error("Failed to invalidate software {$softwareId} cache: ".$e->getMessage());
        }
    }

    /**
     * Invalidate all cache
     */
    public static function invalidateAll(): void
    {
        try {
            Cache::flush();
        } catch (\Exception $e) {
            Log::error('Failed to flush cache: '.$e->getMessage());
        }
    }

    /**
     * Invalidate cache by pattern (works with Redis)
     */
    private static function invalidateByPattern(string $pattern): void
    {
        try {
            $driver = config('cache.default');

            if ($driver === 'redis') {
                $redis = Cache::getStore()->getRedis();
                $keys = $redis->keys($pattern);

                if (! empty($keys)) {
                    $redis->del($keys);
                }
            } else {
                // For other drivers, we can't easily match patterns
                // So we'll just invalidate the dashboard which is the most important
                Cache::forget(self::dashboardStatsKey());
            }
        } catch (\Exception $e) {
            Log::warning('Failed to invalidate cache by pattern: '.$e->getMessage());
        }
    }

    /**
     * Remember with automatic TTL
     */
    public static function remember(string $key, callable $callback, ?int $ttl = null): mixed
    {
        return Cache::remember($key, $ttl ?? self::TTL, $callback);
    }

    /**
     * Get cache statistics
     */
    public static function getStats(): array
    {
        try {
            $driver = config('cache.default');

            if ($driver === 'redis') {
                $redis = Cache::getStore()->getRedis();
                $info = $redis->info('stats');

                return [
                    'driver' => $driver,
                    'keys' => $redis->dbSize(),
                    'hits' => $info['keyspace_hits'] ?? 0,
                    'misses' => $info['keyspace_misses'] ?? 0,
                ];
            }

            return [
                'driver' => $driver,
                'keys' => 0,
                'hits' => 0,
                'misses' => 0,
            ];
        } catch (\Exception $e) {
            Log::error('Failed to get cache stats: '.$e->getMessage());

            return [
                'driver' => config('cache.default'),
                'error' => $e->getMessage(),
            ];
        }
    }
}
