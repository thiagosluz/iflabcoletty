<?php

namespace App\Providers;

use App\Events\ComputerStatusChanged;
use App\Events\HardwareAlert;
use App\Events\SoftwareInstalled;
use App\Listeners\CreateHardwareAlertListener;
use App\Listeners\CreateNotificationListener;
use App\Listeners\CreateSoftwareNotificationListener;
use Illuminate\Support\Facades\Event;
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
