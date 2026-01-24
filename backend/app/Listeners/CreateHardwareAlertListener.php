<?php

namespace App\Listeners;

use App\Events\HardwareAlert;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class CreateHardwareAlertListener
{
    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * Handle HardwareAlert event.
     */
    public function handle(HardwareAlert $event): void
    {
        $computer = $event->computer;
        
        $this->notificationService->notifyResourceViewers(
            'computers',
            $computer->id,
            "hardware.{$event->alertType}",
            'Alerta de Hardware',
            $event->message,
            array_merge([
                'computer_id' => $computer->id,
                'lab_id' => $computer->lab_id,
            ], $event->data)
        );
    }
}
