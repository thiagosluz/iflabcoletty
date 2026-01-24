<?php

namespace App\Listeners;

use App\Events\ComputerStatusChanged;
use App\Services\NotificationService;

class CreateNotificationListener
{
    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * Handle ComputerStatusChanged event.
     */
    public function handle(ComputerStatusChanged $event): void
    {
        $computer = $event->computer;
        $status = $event->status;

        if ($status === 'offline') {
            $this->notificationService->notifyResourceViewers(
                'computers',
                $computer->id,
                'computer.offline',
                'Computador Offline',
                "O computador {$computer->hostname} ({$computer->machine_id}) está offline.",
                [
                    'computer_id' => $computer->id,
                    'lab_id' => $computer->lab_id,
                    'reason' => $event->reason,
                ]
            );
        } elseif ($status === 'online') {
            $this->notificationService->notifyResourceViewers(
                'computers',
                $computer->id,
                'computer.online',
                'Computador Online',
                "O computador {$computer->hostname} ({$computer->machine_id}) voltou a ficar online.",
                [
                    'computer_id' => $computer->id,
                    'lab_id' => $computer->lab_id,
                ]
            );
        }
    }
}
