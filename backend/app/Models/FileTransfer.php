<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FileTransfer extends Model
{
    //
    protected $fillable = [
        'filename',
        'source_type',
        'file_path',
        'created_by',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
