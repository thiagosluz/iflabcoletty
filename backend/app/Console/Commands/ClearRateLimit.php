<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class ClearRateLimit extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'rate-limit:clear {--ip= : Clear rate limit for specific IP}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clear rate limiting cache';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $ip = $this->option('ip');

        if ($ip) {
            // Clear rate limit for specific IP
            $this->clearIpRateLimit($ip);
            $this->info("Rate limit cleared for IP: {$ip}");
        } else {
            // Clear all rate limiting cache
            Cache::flush();
            $this->info('All rate limiting cache cleared');
        }

        return Command::SUCCESS;
    }

    /**
     * Clear rate limit for a specific IP
     */
    private function clearIpRateLimit(string $ip): void
    {
        // Laravel rate limiting uses keys in cache
        // For Redis, we can try to clear specific patterns
        try {
            $store = Cache::getStore();

            // If using Redis store
            if (method_exists($store, 'getRedis')) {
                $redis = $store->getRedis();
                $pattern = "*throttle*{$ip}*";
                $keys = $redis->keys($pattern);

                foreach ($keys as $key) {
                    $redis->del($key);
                }
            } else {
                // For other stores, just flush all cache
                Cache::flush();
            }
        } catch (\Exception $e) {
            // If there's any error, just flush all cache
            Cache::flush();
        }
    }
}
