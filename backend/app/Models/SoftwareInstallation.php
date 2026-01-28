<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SoftwareInstallation extends Model
{
    use HasFactory;

    protected $fillable = [
        'computer_id',
        'command_id',
        'user_id',
        'software_name',
        'installer_type',
        'installer_path',
        'installer_url',
        'network_path',
        'file_id',
        'install_args',
        'silent_mode',
        'reboot_after',
        'status',
        'output',
        'error_message',
        'executed_at',
    ];

    protected $casts = [
        'silent_mode' => 'boolean',
        'reboot_after' => 'boolean',
        'executed_at' => 'datetime',
    ];

    public function computer(): BelongsTo
    {
        return $this->belongsTo(Computer::class);
    }

    public function command(): BelongsTo
    {
        return $this->belongsTo(ComputerCommand::class, 'command_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isProcessing(): bool
    {
        return $this->status === 'processing';
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }
}
