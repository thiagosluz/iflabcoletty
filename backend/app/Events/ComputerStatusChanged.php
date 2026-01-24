<?php

namespace App\Events;

use App\Models\Computer;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ComputerStatusChanged
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Computer $computer,
        public string $status, // 'online', 'offline'
        public ?string $reason = null
    ) {
    }
}
