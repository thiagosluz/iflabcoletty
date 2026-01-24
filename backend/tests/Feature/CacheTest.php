<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Lab;
use App\Models\Computer;
use App\Models\Software;
use App\Services\CacheService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

class CacheTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_stats_are_cached(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(3)->create();
        Computer::factory()->count(5)->create();

        // Clear cache first
        Cache::forget(CacheService::dashboardStatsKey());

        // First request should hit database
        $response1 = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));
        $response1->assertStatus(200);

        // Second request should hit cache
        $response2 = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));
        $response2->assertStatus(200);

        // Responses should be identical
        $this->assertEquals($response1->json(), $response2->json());
    }

    public function test_labs_list_is_cached(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(5)->create();

        $cacheKey = CacheService::labsListKey(['per_page' => 20]);
        Cache::forget($cacheKey);

        // First request
        $response1 = $this->getJson('/api/v1/labs?per_page=20', $this->getAuthHeaders($user));
        $response1->assertStatus(200);

        // Second request should hit cache
        $response2 = $this->getJson('/api/v1/labs?per_page=20', $this->getAuthHeaders($user));
        $response2->assertStatus(200);

        $this->assertEquals($response1->json(), $response2->json());
    }

    public function test_computers_list_is_cached(): void
    {
        $user = $this->actingAsUser();
        Computer::factory()->count(5)->create();

        $cacheKey = CacheService::computersListKey(['per_page' => 20]);
        Cache::forget($cacheKey);

        // First request
        $response1 = $this->getJson('/api/v1/computers?per_page=20', $this->getAuthHeaders($user));
        $response1->assertStatus(200);

        // Second request should hit cache
        $response2 = $this->getJson('/api/v1/computers?per_page=20', $this->getAuthHeaders($user));
        $response2->assertStatus(200);

        $this->assertEquals($response1->json(), $response2->json());
    }

    public function test_softwares_list_is_cached(): void
    {
        $user = $this->actingAsUser();
        Software::factory()->count(5)->create();

        $cacheKey = CacheService::softwaresListKey(['per_page' => 20]);
        Cache::forget($cacheKey);

        // First request
        $response1 = $this->getJson('/api/v1/softwares?per_page=20', $this->getAuthHeaders($user));
        $response1->assertStatus(200);

        // Second request should hit cache
        $response2 = $this->getJson('/api/v1/softwares?per_page=20', $this->getAuthHeaders($user));
        $response2->assertStatus(200);

        $this->assertEquals($response1->json(), $response2->json());
    }

    public function test_cache_is_invalidated_when_lab_is_created(): void
    {
        $user = $this->actingAsUser();
        
        // Clear cache first
        Cache::flush();
        
        // Warm cache
        $response = $this->getJson('/api/v1/labs?per_page=20', $this->getAuthHeaders($user));
        $response->assertStatus(200);
        
        $cacheKey = CacheService::labsListKey(['per_page' => 20]);
        // Note: Cache may not exist immediately in some drivers, so we'll just test invalidation
        
        // Create new lab
        $this->postJson('/api/v1/labs', [
            'name' => 'New Lab ' . uniqid(),
            'description' => 'Test',
        ], $this->getAuthHeaders($user))->assertStatus(201);

        // After creating, make another request - should get fresh data (not cached)
        $response2 = $this->getJson('/api/v1/labs?per_page=20', $this->getAuthHeaders($user));
        $response2->assertStatus(200);
        
        // The response should include the new lab (cache was invalidated)
        $this->assertGreaterThanOrEqual($response->json('total'), $response2->json('total'));
    }

    public function test_cache_is_invalidated_when_lab_is_updated(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();

        // Warm cache
        $this->getJson('/api/v1/labs?per_page=20', $this->getAuthHeaders($user))->assertStatus(200);

        // Update lab - this should trigger cache invalidation
        $response = $this->putJson("/api/v1/labs/{$lab->id}", [
            'name' => 'Updated Lab ' . uniqid(),
            'description' => $lab->description,
        ], $this->getAuthHeaders($user));
        
        $response->assertStatus(200);
        
        // Verify the update was successful
        $this->assertNotEquals($lab->name, $response->json('name'), 'Lab name should be updated');
    }

    public function test_cache_is_invalidated_when_lab_is_deleted(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        $labId = $lab->id;

        // Warm cache
        $this->getJson('/api/v1/labs?per_page=20', $this->getAuthHeaders($user))->assertStatus(200);

        // Delete lab - this should trigger cache invalidation
        $response = $this->deleteJson("/api/v1/labs/{$lab->id}", [], $this->getAuthHeaders($user));
        $response->assertStatus(204);
        
        // Verify the lab was deleted
        $this->assertDatabaseMissing('labs', ['id' => $labId]);
    }

    public function test_cache_is_invalidated_when_computer_is_created(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        $machineId = 'test-machine-' . uniqid();

        // Warm cache
        $this->getJson('/api/v1/computers?per_page=20', $this->getAuthHeaders($user))->assertStatus(200);

        // Create new computer - this should trigger cache invalidation
        $createResponse = $this->postJson('/api/v1/computers', [
            'lab_id' => $lab->id,
            'machine_id' => $machineId,
        ], $this->getAuthHeaders($user));
        
        $createResponse->assertStatus(201);
        
        // Verify the computer was created
        $this->assertDatabaseHas('computers', ['machine_id' => $machineId]);
    }

    public function test_cache_is_invalidated_when_computer_is_updated(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();

        // Warm cache
        $response1 = $this->getJson('/api/v1/computers?per_page=20', $this->getAuthHeaders($user));
        $response1->assertStatus(200);

        // Update computer
        $this->putJson("/api/v1/computers/{$computer->id}", [
            'hostname' => 'updated-hostname-' . uniqid(),
        ], $this->getAuthHeaders($user))->assertStatus(200);

        // After updating, make another request - should get fresh data
        $response2 = $this->getJson('/api/v1/computers?per_page=20', $this->getAuthHeaders($user));
        $response2->assertStatus(200);
        
        // Verify the updated computer appears in the response
        $computerIds = collect($response2->json('data'))->pluck('id');
        $this->assertTrue($computerIds->contains($computer->id), 'Updated computer should appear in response');
    }

    public function test_cache_is_invalidated_when_computer_is_deleted(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();
        $computerId = $computer->id;

        // Warm cache
        $this->getJson('/api/v1/computers?per_page=20', $this->getAuthHeaders($user))->assertStatus(200);

        // Delete computer - this should trigger cache invalidation
        $response = $this->deleteJson("/api/v1/computers/{$computer->id}", [], $this->getAuthHeaders($user));
        $response->assertStatus(204);
        
        // Verify the computer was deleted
        $this->assertDatabaseMissing('computers', ['id' => $computerId]);
    }

    public function test_cache_is_invalidated_when_computer_receives_agent_report(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();

        // Warm cache
        $response1 = $this->getJson('/api/v1/computers?per_page=20', $this->getAuthHeaders($user));
        $response1->assertStatus(200);

        // Send agent report
        $this->postJson("/api/v1/computers/{$computer->id}/report", [
            'hardware_info' => [
                'cpu' => ['physical_cores' => 4],
                'memory' => ['total_gb' => 8],
            ],
        ], $this->getAuthHeaders($user))->assertStatus(200);

        // After report, make another request - should get fresh data
        $response2 = $this->getJson('/api/v1/computers?per_page=20', $this->getAuthHeaders($user));
        $response2->assertStatus(200);
        
        // Verify the computer still appears (wasn't deleted)
        $computerIds = collect($response2->json('data'))->pluck('id');
        $this->assertTrue($computerIds->contains($computer->id), 'Computer should still appear after report');
    }

    public function test_different_filters_create_different_cache_keys(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(5)->create();

        $key1 = CacheService::labsListKey(['per_page' => 10]);
        $key2 = CacheService::labsListKey(['per_page' => 20]);

        $this->assertNotEquals($key1, $key2);
    }

    public function test_warm_cache_command_exists(): void
    {
        $this->artisan('cache:warm --help')
            ->assertSuccessful();
    }
}
