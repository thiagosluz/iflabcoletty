<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /**
     * Creates the application.
     * Force SQLite in-memory database for all tests to avoid affecting development database.
     */
    public function createApplication()
    {
        // Force SQLite before creating application
        putenv('DB_CONNECTION=sqlite');
        putenv('DB_DATABASE=:memory:');
        
        $app = require __DIR__.'/../bootstrap/app.php';
        
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
        
        // Ensure SQLite is used
        config(['database.default' => 'sqlite']);
        config(['database.connections.sqlite.database' => ':memory:']);
        
        return $app;
    }

    /**
     * Create and authenticate a user for testing
     */
    protected function actingAsUser(): User
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'sanctum');
        return $user;
    }

    /**
     * Get authentication headers for API requests
     */
    protected function getAuthHeaders(?User $user = null): array
    {
        if (!$user) {
            $user = User::factory()->create();
        }
        
        $token = $user->createToken('test-token')->plainTextToken;
        
        return [
            'Authorization' => 'Bearer ' . $token,
            'Accept' => 'application/json',
        ];
    }
}
