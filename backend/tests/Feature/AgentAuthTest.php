<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AgentAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_agent_can_register_with_valid_token(): void
    {
        $lab = \App\Models\Lab::factory()->create([
            'installation_token' => 'test_token_123',
        ]);

        $payload = [
            'installation_token' => 'test_token_123',
            'hardware_info' => ['mac' => '00:11:22:33'],
            'hostname' => 'Test-PC',
            'agent_version' => '1.0.0',
        ];

        $response = $this->postJson('/api/v1/agents/register', $payload);

        $response->assertStatus(200)
            ->assertJsonStructure(['message', 'api_key', 'computer_id']);

        $this->assertDatabaseHas('computers', [
            'hostname' => 'Test-PC',
            'lab_id' => $lab->id,
        ]);

        $computer = \App\Models\Computer::where('hostname', 'Test-PC')->first();
        $this->assertNotNull($computer->agent_api_key);
    }

    public function test_agent_can_migrate_with_legacy_credentials(): void
    {
        $lab = \App\Models\Lab::factory()->create();

        // Criar usuário admin
        $user = \App\Models\User::factory()->create([
            'email' => 'admin@test.com',
            'password' => bcrypt('password123'),
        ]);

        $role = \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'admin']);
        $permission = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'manage-agents']);
        $role->givePermissionTo($permission);
        $user->assignRole($role);

        $payload = [
            'email' => 'admin@test.com',
            'password' => 'password123',
            'lab_id' => $lab->id,
            'hardware_info' => ['mac' => 'AA:BB:CC'],
            'hostname' => 'Migrate-PC',
            'agent_version' => '0.9.0',
        ];

        $response = $this->postJson('/api/v1/agents/migrate', $payload);

        $response->assertStatus(200)
            ->assertJsonStructure(['message', 'api_key', 'computer_id']);

        $computer = \App\Models\Computer::where('hostname', 'Migrate-PC')->first();
        $this->assertNotNull($computer->agent_api_key);
    }

    public function test_agent_cannot_access_protected_route_without_token(): void
    {
        $computer = \App\Models\Computer::factory()->create();

        $response = $this->postJson("/api/v1/computers/{$computer->id}/metrics", []);

        $response->assertStatus(401);
    }

    public function test_agent_can_access_protected_route_with_valid_token(): void
    {
        $plainToken = 'secret_token_abc';
        $hashedToken = hash('sha256', $plainToken);

        $lab = \App\Models\Lab::factory()->create();
        $computer = \App\Models\Computer::factory()->create([
            'lab_id' => $lab->id,
            'agent_api_key' => $hashedToken,
        ]);

        $payload = [
            'cpu_usage_percent' => 50,
            'memory_usage_percent' => 60,
        ];

        $response = $this->withHeader('Authorization', 'Bearer '.$plainToken)
            ->postJson("/api/v1/computers/{$computer->id}/metrics", $payload);

        $response->assertStatus(200);
    }
}
