<?php

namespace App\Events;

use App\Models\Computer;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class HardwareAlert
{
    public function __construct(
        public Computer $computer,
        public string $alertType, // 'cpu_high', 'memory_high', 'disk_full', etc.
        public string $message,
        public array $data = []
    ) {
    }
}
