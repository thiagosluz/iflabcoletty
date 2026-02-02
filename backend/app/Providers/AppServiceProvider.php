<?php

namespace App\Providers;

use App\Events\ComputerStatusChanged;
use App\Events\HardwareAlert;
use App\Events\SoftwareInstalled;
use App\Listeners\CreateHardwareAlertListener;
use App\Listeners\CreateNotificationListener;
use App\Listeners\CreateSoftwareNotificationListener;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            $key = $request->user()?->getKey() ?? $request->ip();

            return Limit::perMinute(config('app.api_rate_limit_per_minute', 5000))
                ->by((string) $key);
        });

        // Register event listeners
        Event::listen(
            ComputerStatusChanged::class,
            CreateNotificationListener::class
        );

        Event::listen(
            SoftwareInstalled::class,
            CreateSoftwareNotificationListener::class
        );

        Event::listen(
            HardwareAlert::class,
            CreateHardwareAlertListener::class
        );
    }
}
