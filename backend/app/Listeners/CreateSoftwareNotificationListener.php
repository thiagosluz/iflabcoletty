<?php

namespace App\Listeners;

use App\Events\SoftwareInstalled;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class CreateSoftwareNotificationListener
{
    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * Handle SoftwareInstalled event.
     */
    public function handle(SoftwareInstalled $event): void
    {
        $computer = $event->computer;
        $software = $event->software;
        $action = $event->action;
        
        $actionText = $action === 'installed' ? 'instalado' : 'removido';
        
        $this->notificationService->notifyResourceViewers(
            'computers',
            $computer->id,
            "software.{$action}",
            "Software {$actionText}",
            "O software {$software->name} foi {$actionText} no computador {$computer->hostname}.",
            [
                'computer_id' => $computer->id,
                'software_id' => $software->id,
                'lab_id' => $computer->lab_id,
            ]
        );
    }
}
