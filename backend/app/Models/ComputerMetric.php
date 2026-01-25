<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ComputerMetric extends Model
{
    use HasFactory;

    protected $fillable = [
        'computer_id',
        'cpu_usage_percent',
        'memory_usage_percent',
        'memory_total_gb',
        'memory_free_gb',
        'disk_usage',
        'network_stats',
        'uptime_seconds',
        'processes_count',
        'recorded_at',
    ];

    protected $casts = [
        'disk_usage' => 'array',
        'network_stats' => 'array',
        'recorded_at' => 'datetime',
        'cpu_usage_percent' => 'float',
        'memory_usage_percent' => 'float',
    ];

    public function computer(): BelongsTo
    {
        return $this->belongsTo(Computer::class);
    }
}
