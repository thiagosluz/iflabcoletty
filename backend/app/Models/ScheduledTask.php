<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduledTask extends Model
{
    protected $fillable = [
        'name',
        'command',
        'target_type',
        'target_id',
        'frequency',
        'time',
        'command_validity_minutes',
        'days_of_week',
        'run_at_date',
        'is_active',
        'last_run_at',
        'last_run_status',
        'last_run_output',
        'user_id',
    ];

    protected $casts = [
        'days_of_week' => 'array',
        'is_active' => 'boolean',
        'last_run_at' => 'datetime',
        'run_at_date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
