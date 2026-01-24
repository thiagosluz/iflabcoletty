<?php

namespace App\Events;

use App\Models\Computer;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class HardwareAlert implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Computer $computer,
        public string $alertType, // 'cpu_high', 'memory_high', 'disk_full', etc.
        public string $message,
        public array $data = []
    ) {}

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('computers'),
            new PrivateChannel('dashboard'),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'hardware.alert';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'computer_id' => $this->computer->id,
            'hostname' => $this->computer->hostname,
            'alert_type' => $this->alertType,
            'message' => $this->message,
            'data' => $this->data,
            'lab_id' => $this->computer->lab_id,
        ];
    }
}
