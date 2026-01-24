<?php

namespace Tests\Feature;

use App\Models\Computer;
use App\Models\Lab;
use App\Models\Software;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PerformanceTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that computers listing with pagination is performant
     */
    public function test_computers_listing_is_performant(): void
    {
        $user = $this->actingAsUser();
        $labs = Lab::factory()->count(5)->create();

        // Create computers with lab_id to avoid creating duplicate labs
        foreach ($labs as $lab) {
            Computer::factory()->count(20)->create(['lab_id' => $lab->id]);
        }

        $startTime = microtime(true);

        $response = $this->getJson('/api/v1/computers?per_page=20', $this->getAuthHeaders($user));

        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000; // Convert to milliseconds

        $response->assertStatus(200);

        // Should complete in less than 500ms (reasonable for 100 records with pagination)
        $this->assertLessThan(500, $executionTime, "Computers listing took {$executionTime}ms, expected less than 500ms");
    }

    /**
     * Test that labs listing with count is performant
     */
    public function test_labs_listing_with_count_is_performant(): void
    {
        $user = $this->actingAsUser();
        $labs = Lab::factory()->count(20)->create();

        // Create computers for each lab (using existing labs to avoid creating duplicate labs)
        foreach ($labs as $lab) {
            Computer::factory()->count(10)->create(['lab_id' => $lab->id]);
        }

        $startTime = microtime(true);

        $response = $this->getJson('/api/v1/labs?per_page=20', $this->getAuthHeaders($user));

        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000;

        $response->assertStatus(200);

        // Should complete in less than 300ms
        $this->assertLessThan(300, $executionTime, "Labs listing took {$executionTime}ms, expected less than 300ms");
    }

    /**
     * Test that dashboard stats query is performant
     */
    public function test_dashboard_stats_is_performant(): void
    {
        $user = $this->actingAsUser();
        $labs = Lab::factory()->count(10)->create();

        // Create computers with lab_id to avoid creating duplicate labs
        foreach ($labs as $lab) {
            Computer::factory()->count(5)->create(['lab_id' => $lab->id]);
            Computer::factory()->withHardwareInfo()->count(3)->create(['lab_id' => $lab->id]);
        }

        $startTime = microtime(true);

        $response = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));

        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000;

        $response->assertStatus(200);

        // Dashboard stats should complete in less than 1000ms even with calculations
        $this->assertLessThan(1000, $executionTime, "Dashboard stats took {$executionTime}ms, expected less than 1000ms");
    }

    /**
     * Test that lab computers listing is performant
     */
    public function test_lab_computers_listing_is_performant(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        Computer::factory()->count(50)->create(['lab_id' => $lab->id]);

        $startTime = microtime(true);

        $response = $this->getJson("/api/v1/labs/{$lab->id}/computers?per_page=20", $this->getAuthHeaders($user));

        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000;

        $response->assertStatus(200);

        // Should complete in less than 300ms
        $this->assertLessThan(300, $executionTime, "Lab computers listing took {$executionTime}ms, expected less than 300ms");
    }

    /**
     * Test that software listing is performant
     */
    public function test_software_listing_is_performant(): void
    {
        $user = $this->actingAsUser();
        Software::factory()->count(100)->create();

        $startTime = microtime(true);

        $response = $this->getJson('/api/v1/softwares?per_page=20', $this->getAuthHeaders($user));

        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000;

        $response->assertStatus(200);

        // Should complete in less than 300ms
        $this->assertLessThan(300, $executionTime, "Software listing took {$executionTime}ms, expected less than 300ms");
    }

    /**
     * Test that queries use indexes (indirectly by checking performance)
     */
    public function test_indexes_are_being_used(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        Computer::factory()->count(100)->create(['lab_id' => $lab->id]);

        // Query with lab_id filter (should use index)
        $startTime = microtime(true);

        $response = $this->getJson("/api/v1/computers?lab_id={$lab->id}&per_page=20", $this->getAuthHeaders($user));

        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000;

        $response->assertStatus(200);

        // With index, should be very fast even with 100 records
        $this->assertLessThan(200, $executionTime, "Filtered query took {$executionTime}ms, expected less than 200ms with index");
    }
}
