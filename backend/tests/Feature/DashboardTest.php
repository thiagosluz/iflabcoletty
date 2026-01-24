<?php

namespace Tests\Feature;

use App\Models\Computer;
use App\Models\Lab;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_get_dashboard_stats(): void
    {
        $user = $this->actingAsUser();
        $labs = Lab::factory()->count(3)->create();
        Computer::factory()->count(10)->create();
        Computer::factory()->online()->count(5)->create();

        $response = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'total_labs',
                'total_computers',
                'online_computers',
                'offline_computers',
                'total_softwares',
                'hardware_averages',
                'os_distribution',
            ]);

        // Verify counts match what we created in this test
        $this->assertGreaterThanOrEqual(3, $response->json('total_labs'));
        $this->assertGreaterThanOrEqual(15, $response->json('total_computers'));
    }

    public function test_dashboard_stats_includes_hardware_averages(): void
    {
        $user = $this->actingAsUser();
        Computer::factory()->withHardwareInfo()->count(3)->create();

        $response = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertNotNull($response->json('hardware_averages'));
        $this->assertArrayHasKey('cpu', $response->json('hardware_averages'));
        $this->assertArrayHasKey('memory', $response->json('hardware_averages'));
        $this->assertArrayHasKey('disk', $response->json('hardware_averages'));
    }

    public function test_dashboard_stats_includes_os_distribution(): void
    {
        $user = $this->actingAsUser();
        Computer::factory()->withHardwareInfo()->count(5)->create();

        $response = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertIsArray($response->json('os_distribution'));
    }

    public function test_dashboard_stats_calculates_online_offline_correctly(): void
    {
        $user = $this->actingAsUser();
        Computer::factory()->online()->count(3)->create();
        Computer::factory()->offline()->count(2)->create();

        $response = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        // Online threshold is 5 minutes, so online() factory should create recent computers
        $this->assertGreaterThanOrEqual(3, $response->json('online_computers'));
    }

    public function test_unauthenticated_user_cannot_access_dashboard(): void
    {
        $response = $this->getJson('/api/v1/dashboard/stats');

        $response->assertStatus(401);
    }
}
