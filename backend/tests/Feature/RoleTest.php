<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RoleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Create permissions for sanctum guard since API uses it
        Permission::firstOrCreate(['name' => 'roles.view', 'guard_name' => 'sanctum']);
        Permission::firstOrCreate(['name' => 'roles.create', 'guard_name' => 'sanctum']);
        Permission::firstOrCreate(['name' => 'roles.edit', 'guard_name' => 'sanctum']);
        Permission::firstOrCreate(['name' => 'roles.delete', 'guard_name' => 'sanctum']);

        // Also ensure web usage works if needed by internal logic
        Permission::firstOrCreate(['name' => 'roles.view', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'roles.create', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'roles.edit', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'roles.delete', 'guard_name' => 'web']);
    }

    public function test_authenticated_user_can_list_roles(): void
    {
        $user = $this->actingAsUser();
        // Assign permission to user
        $user->givePermissionTo('roles.view');

        Role::create(['name' => 'Test Role', 'guard_name' => 'web']);

        $response = $this->getJson('/api/v1/roles', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                '*' => ['id', 'name', 'permissions'],
            ]);
    }

    public function test_authenticated_user_can_create_role(): void
    {
        $user = $this->actingAsUser();
        $user->givePermissionTo('roles.create');

        $response = $this->postJson('/api/v1/roles', [
            'name' => 'New Role',
            'permissions' => ['roles.view'],
        ], $this->getAuthHeaders($user));

        $response->assertStatus(201)
            ->assertJson([
                'name' => 'New Role',
            ]);

        $this->assertDatabaseHas('roles', ['name' => 'New Role']);

        $role = Role::findByName('New Role', 'sanctum'); // API creates for sanctum guard
        $this->assertTrue($role->hasPermissionTo('roles.view'));
    }

    public function test_role_creation_requires_unique_name(): void
    {
        $user = $this->actingAsUser();
        $user->givePermissionTo('roles.create');
        Role::create(['name' => 'Existing Role', 'guard_name' => 'web']);

        $response = $this->postJson('/api/v1/roles', [
            'name' => 'Existing Role',
            'permissions' => [],
        ], $this->getAuthHeaders($user));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_authenticated_user_can_update_role(): void
    {
        $user = $this->actingAsUser();
        $user->givePermissionTo('roles.edit');
        $role = Role::create(['name' => 'Old Name', 'guard_name' => 'web']);

        $response = $this->putJson("/api/v1/roles/{$role->id}", [
            'name' => 'Updated Name',
            'permissions' => ['roles.delete'],
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJson([
                'name' => 'Updated Name',
            ]);

        $this->assertDatabaseHas('roles', ['name' => 'Updated Name']);

        $role->refresh();
        $this->assertTrue($role->hasPermissionTo('roles.delete'));
    }

    public function test_authenticated_user_can_delete_role(): void
    {
        $user = $this->actingAsUser();
        $user->givePermissionTo('roles.delete');
        $role = Role::create(['name' => 'To Delete', 'guard_name' => 'web']);

        $response = $this->deleteJson("/api/v1/roles/{$role->id}", [], $this->getAuthHeaders($user));

        $response->assertStatus(204);

        $this->assertDatabaseMissing('roles', ['id' => $role->id]);
    }

    public function test_user_without_permission_cannot_manage_roles(): void
    {
        // manually create user without roles
        $user = \App\Models\User::factory()->create();
        $token = $user->createToken('test-token')->plainTextToken;
        $headers = [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ];

        $this->getJson('/api/v1/roles', $headers)->assertStatus(403);
        $this->postJson('/api/v1/roles', ['name' => 'Fail'], $headers)->assertStatus(403);
    }
}
