<?php

namespace App\Events;

use App\Models\Computer;
use App\Models\Software;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SoftwareInstalled
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Computer $computer,
        public Software $software,
        public string $action // 'installed', 'removed'
    ) {
    }
}
