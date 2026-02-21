<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ComputerCommand extends Model
{
    use HasFactory;

    protected $fillable = [
        'computer_id',
        'user_id',
        'command',
        'parameters',
        'status',
        'output',
        'executed_at',
        'expires_at',
    ];

    protected $casts = [
        'parameters' => 'array',
        'executed_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function computer(): BelongsTo
    {
        return $this->belongsTo(Computer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
