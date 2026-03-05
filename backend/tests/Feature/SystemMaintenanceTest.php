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
        if (! file_exists($logPath)) {
            \Illuminate\Support\Facades\File::put($logPath, 'Test log content');
        }

        $response = $this->getJson('/api/v1/system/logs', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                '*' => ['filename', 'size', 'formatted_last_modified'],
            ]);
    }

    public function test_authenticated_user_can_view_log_header(): void
    {
        $user = $this->actingAsUser();
        $user->givePermissionTo('system.logs');

        $logPath = storage_path('logs/test.log');
        \Illuminate\Support\Facades\File::put($logPath, 'Log Content');

        $response = $this->getJson('/api/v1/system/logs/test.log', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJson([
                'filename' => 'test.log',
                'content' => 'Log Content',
                'truncated' => false,
                'from_line' => 1,
            ])
            ->assertJsonStructure([
                'filename', 'content', 'size', 'truncated', 'from_line', 'total_lines',
            ]);
    }

    public function test_log_content_respects_tail_parameter(): void
    {
        $user = $this->actingAsUser();
        $user->givePermissionTo('system.logs');

        $logPath = storage_path('logs/test.log');
        $lines = implode("\n", array_map(fn ($i) => "line {$i}", range(1, 100)));
        \Illuminate\Support\Facades\File::put($logPath, $lines);

        $response = $this->getJson('/api/v1/system/logs/test.log?tail=10', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJson([
                'filename' => 'test.log',
                'truncated' => true,
                'from_line' => 91,
                'total_lines' => 100,
            ]);
        $content = $response->json('content');
        $this->assertSame(10, substr_count($content, "\n") + 1);
    }

    public function test_log_entries_returns_structured_data(): void
    {
        $user = $this->actingAsUser();
        $user->givePermissionTo('system.logs');

        $logPath = storage_path('logs/entries.log');
        $content = "[2026-02-06 12:00:00] production.ERROR: First error\n";
        $content .= "[2026-02-06 12:01:00] local.INFO: User login\n";
        $content .= "[2026-02-06 12:02:00] production.WARNING: Deprecated call\n";
        File::put($logPath, $content);

        $response = $this->getJson('/api/v1/system/logs/entries.log/entries?per_page=10&order=oldest', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'timestamp', 'env', 'level', 'message', 'lineNumber'],
                ],
                'meta' => ['page', 'per_page', 'total', 'total_pages'],
            ]);
        $this->assertSame(3, $response->json('meta.total'));
        $data = $response->json('data');
        $this->assertSame('2026-02-06 12:00:00', $data[0]['timestamp']);
        $this->assertSame('production', $data[0]['env']);
        $this->assertSame('ERROR', $data[0]['level']);
        $this->assertSame('First error', $data[0]['message']);
    }

    public function test_log_entries_respects_level_filter_and_pagination(): void
    {
        $user = $this->actingAsUser();
        $user->givePermissionTo('system.logs');

        $logPath = storage_path('logs/filter.log');
        $content = "[2026-02-06 12:00:00] production.ERROR: E1\n";
        $content .= "[2026-02-06 12:01:00] production.INFO: I1\n";
        $content .= "[2026-02-06 12:02:00] production.ERROR: E2\n";
        File::put($logPath, $content);

        $response = $this->getJson('/api/v1/system/logs/filter.log/entries?level=ERROR&page=1&per_page=1', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertSame(2, $response->json('meta.total'));
        $this->assertSame(1, count($response->json('data')));
        $this->assertSame('ERROR', $response->json('data.0.level'));
    }

    public function test_log_stats_returns_level_counts(): void
    {
        $user = $this->actingAsUser();
        $user->givePermissionTo('system.logs');

        $logPath = storage_path('logs/stats.log');
        $content = "[2026-02-06 12:00:00] production.ERROR: Err\n";
        $content .= "[2026-02-06 12:01:00] production.ERROR: Err2\n";
        $content .= "[2026-02-06 12:02:00] local.INFO: Info\n";
        File::put($logPath, $content);

        $response = $this->getJson('/api/v1/system/logs/stats.log/stats', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure(['levels']);
        $levels = $response->json('levels');
        $this->assertSame(2, $levels['ERROR']);
        $this->assertSame(1, $levels['INFO']);
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

        $response = $this->postJson('/api/v1/system/queue/clear', ['connection' => 'redis', 'queue' => 'default'], $this->getAuthHeaders($user));

        // Endpoint returns 400 when app queue driver is not Redis (e.g. sync in phpunit/CI)
        if (config('queue.default') !== 'redis') {
            $response->assertStatus(400)
                ->assertJsonFragment(['message' => 'Limpeza de fila só funciona com Redis. Conexão atual: '.config('queue.default')]);
        } else {
            $response->assertStatus(200);
        }
    }
}
