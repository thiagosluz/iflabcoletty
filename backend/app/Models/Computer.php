<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Computer extends Model
{
    use HasFactory;

    protected $fillable = [
        'lab_id',
        'machine_id',
        'public_hash',
        'hostname',
        'hostname',
        'hardware_info',
        'position_x',
        'position_y',
    ];

    protected $casts = [
        'hardware_info' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($computer) {
            if (empty($computer->public_hash)) {
                $computer->public_hash = $computer->generatePublicHash();
            }
        });
    }

    public function generatePublicHash(): string
    {
        return bin2hex(random_bytes(32));
    }

    public function lab()
    {
        return $this->belongsTo(Lab::class);
    }

    public function softwares()
    {
        return $this->belongsToMany(Software::class, 'computer_software')
            ->withTimestamps()
            ->withPivot('installed_at');
    }

    public function activities()
    {
        return $this->hasMany(ComputerActivity::class);
    }

    public function metrics()
    {
        return $this->hasMany(ComputerMetric::class);
    }

    public function commands()
    {
        return $this->hasMany(ComputerCommand::class);
    }
}
