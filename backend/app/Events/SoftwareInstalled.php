<?php

namespace App\Events;

use App\Models\Computer;
use App\Models\Software;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SoftwareInstalled implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Computer $computer,
        public Software $software,
        public string $action // 'installed', 'removed'
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
        return 'software.installed';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'computer_id' => $this->computer->id,
            'computer_hostname' => $this->computer->hostname,
            'software_id' => $this->software->id,
            'software_name' => $this->software->name,
            'software_version' => $this->software->version,
            'action' => $this->action,
            'lab_id' => $this->computer->lab_id,
        ];
    }
}
