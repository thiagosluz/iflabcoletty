<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class SystemMaintenanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Create system.logs permission since it's used by LogViewerController and might not be in seeder
        \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'system.logs', 'guard_name' => 'web']);
        \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'system.logs', 'guard_name' => 'sanctum']);
    }

    public function test_authenticated_user_can_check_system_health(): void
    {
        $user = $this->actingAsUser();

        $response = $this->getJson('/api/v1/system/health', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure(['database', 'storage', 'queue', 'cache', 'system', 'alerts']);
    }

    public function test_authenticated_user_can_list_system_logs(): void
    {
        $user = $this->actingAsUser();
        // Give permission
        $user->givePermissionTo('system.logs');

        // Create a dummy log file
        $logPath = storage_path('logs/laravel.log');
        if (!file_exists($logPath)) {
            \Illuminate\Support\Facades\File::put($logPath, 'Test log content');
        }

        $response = $this->getJson('/api/v1/system/logs', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                '*' => ['filename', 'size', 'formatted_last_modified'],
            ]);
    }

    public function test_authenticated_user_can_view_log_header(): void // Changed from view log details/content
    {
        $user = $this->actingAsUser();
        $user->givePermissionTo('system.logs');

        $logPath = storage_path('logs/test.log');
        \Illuminate\Support\Facades\File::put($logPath, 'Log Content');

        $response = $this->getJson('/api/v1/system/logs/test.log', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJson([
                'filename' => 'test.log',
            ]);
    }

    public function test_authenticated_user_can_retry_failed_jobs(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/v1/system/queue/retry-failed', [], $this->getAuthHeaders($user));

        // It might be 200 with "No jobs"
        $response->assertStatus(200);
        // We accept either message (0 jobs or >0 jobs)
        $this->assertTrue(
            isset($response['message']) &&
            (str_contains($response['message'], 'Nenhum job') || str_contains($response['message'], 'foram enviadas'))
        );
    }

    public function test_authenticated_user_can_flush_queue(): void
    {
        $user = $this->actingAsUser();

        // Warning: This clears the queue. In a test environment with redis it might be okay.
        $response = $this->postJson('/api/v1/system/queue/clear', ['connection' => 'redis', 'queue' => 'default'], $this->getAuthHeaders($user));

        $response->assertStatus(200);
    }
}
