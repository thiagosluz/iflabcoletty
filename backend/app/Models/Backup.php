<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Backup extends Model
{
    use HasFactory;

    protected $fillable = [
        'filename',
        'file_path',
        'file_size',
        'type',
        'status',
        'error_message',
        'user_id',
        'completed_at',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array
     */
    protected $appends = ['download_url', 'human_readable_size'];

    /**
     * Get the user that created the backup
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Check if backup is pending
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Check if backup is completed
     */
    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    /**
     * Check if backup failed
     */
    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    /**
     * Get human-readable file size
     */
    public function getHumanReadableSizeAttribute(): string
    {
        if (!$this->file_size) {
            return '0 B';
        }

        $bytes = (int) $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }

    /**
     * Check if backup file exists
     */
    public function fileExists(): bool
    {
        if (!$this->file_path) {
            return false;
        }
        
        // Try Storage first, then filesystem
        if (Storage::exists($this->file_path)) {
            return true;
        }
        
        $fullPath = storage_path('app/' . $this->file_path);
        return file_exists($fullPath);
    }

    /**
     * Get download URL for the backup file
     */
    public function getDownloadUrlAttribute(): ?string
    {
        if (!$this->isCompleted() || !$this->fileExists()) {
            return null;
        }

        return route('api.v1.backups.download', ['backup' => $this->id]);
    }
}
