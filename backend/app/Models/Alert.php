<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Alert extends Model
{
    use HasFactory;

    protected $fillable = [
        'alert_rule_id',
        'computer_id',
        'title',
        'description',
        'severity',
        'status', // active, resolved, acknowledged
        'resolved_at',
        'trigger_value',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
        'trigger_value' => 'float',
    ];

    /**
     * Get the rule that triggered the alert.
     */
    public function rule(): BelongsTo
    {
        return $this->belongsTo(AlertRule::class, 'alert_rule_id');
    }

    /**
     * Get the computer related to the alert.
     */
    public function computer(): BelongsTo
    {
        return $this->belongsTo(Computer::class);
    }

    /**
     * Scope a query to only include active alerts.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope a query to only include resolved alerts.
     */
    public function scopeResolved($query)
    {
        return $query->where('status', 'resolved');
    }
}
