<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ComputerActivity extends Model
{
    use HasFactory;

    protected $fillable = ['computer_id', 'type', 'description', 'payload'];

    protected $casts = [
        'payload' => 'array',
    ];

    public function computer()
    {
        return $this->belongsTo(Computer::class);
    }
}
