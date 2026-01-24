<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

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
     * Setup the test environment.
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Seed roles and permissions for tests
        // This ensures permissions exist before tests run
        $seeder = new \Database\Seeders\RolePermissionSeeder;
        $seeder->run();

        // Reset cache again after seeding
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    /**
     * Create and authenticate a user for testing
     */
    protected function actingAsUser(): User
    {
        $user = User::factory()->create();

        // Get or create admin role
        $adminRole = \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'admin']);

        // Ensure admin role has all permissions
        if ($adminRole->permissions()->count() === 0) {
            $allPermissions = \Spatie\Permission\Models\Permission::all();
            if ($allPermissions->count() > 0) {
                $adminRole->givePermissionTo($allPermissions);
            }
        }

        // Assign admin role to user
        if (! $user->hasRole('admin')) {
            $user->assignRole('admin');
        }

        // Clear permission cache for this user
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        $user->refresh();

        $this->actingAs($user, 'sanctum');

        return $user;
    }

    /**
     * Get authentication headers for API requests
     */
    protected function getAuthHeaders(?User $user = null): array
    {
        if (! $user) {
            $user = User::factory()->create();
        }

        // Get or create admin role
        $adminRole = \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'admin']);

        // Ensure admin role has all permissions
        if ($adminRole->permissions()->count() === 0) {
            $allPermissions = \Spatie\Permission\Models\Permission::all();
            if ($allPermissions->count() > 0) {
                $adminRole->givePermissionTo($allPermissions);
            }
        }

        // Assign admin role to user if not already assigned
        if (! $user->hasRole('admin')) {
            $user->assignRole('admin');
        }

        // Clear permission cache and reload user
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        $user = $user->fresh(['roles', 'permissions']);

        $token = $user->createToken('test-token')->plainTextToken;

        return [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ];
    }
}
