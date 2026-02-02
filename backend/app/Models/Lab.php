<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lab extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'description', 'default_wallpaper_url', 'default_wallpaper_enabled'];

    protected $casts = [
        'default_wallpaper_enabled' => 'boolean',
    ];

    public function computers()
    {
        return $this->hasMany(Computer::class);
    }
}
