<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Backup;
use App\Services\BackupService;
use Illuminate\Support\Facades\Storage;
use Illuminate\Foundation\Testing\RefreshDatabase;

class BackupTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_authenticated_user_can_list_backups(): void
    {
        $user = User::factory()->create();
        Backup::factory()->count(3)->create(['user_id' => $user->id]);

        $response = $this->withHeaders($this->getAuthHeaders($user))
            ->getJson('/api/v1/backups');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'filename',
                        'file_path',
                        'type',
                        'status',
                        'created_at',
                    ]
                ],
                'current_page',
                'total',
            ]);
    }

    public function test_authenticated_user_can_create_backup(): void
    {
        $user = User::factory()->create();

        // Mock the backup service to avoid actual database backup in tests
        $this->mock(BackupService::class, function ($mock) use ($user) {
            $backup = Backup::factory()->make([
                'user_id' => $user->id,
                'type' => 'database',
                'status' => 'completed',
            ]);
            $backup->save();
            
            $mock->shouldReceive('createDatabaseBackup')
                ->once()
                ->with($user->id)
                ->andReturn($backup);
        });

        $response = $this->withHeaders($this->getAuthHeaders($user))
            ->postJson('/api/v1/backups', [
                'type' => 'database',
            ]);

        // Since we're mocking, the response might be different
        // Let's just verify the endpoint is accessible
        $response->assertStatus(201);
    }

    public function test_authenticated_user_can_view_backup_stats(): void
    {
        $user = User::factory()->create();
        Backup::factory()->count(5)->create(['user_id' => $user->id, 'status' => 'completed']);
        Backup::factory()->count(2)->create(['user_id' => $user->id, 'status' => 'failed']);

        $response = $this->withHeaders($this->getAuthHeaders($user))
            ->getJson('/api/v1/backups/stats');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'total',
                'completed',
                'pending',
                'failed',
                'total_size',
                'total_size_human',
            ]);

        $data = $response->json();
        $this->assertEquals(7, $data['total']);
        $this->assertEquals(5, $data['completed']);
        $this->assertEquals(2, $data['failed']);
    }

    public function test_authenticated_user_can_view_specific_backup(): void
    {
        $user = User::factory()->create();
        $backup = Backup::factory()->create([
            'user_id' => $user->id,
            'status' => 'completed',
        ]);

        $response = $this->withHeaders($this->getAuthHeaders($user))
            ->getJson("/api/v1/backups/{$backup->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'id',
                'filename',
                'file_path',
                'type',
                'status',
                'file_exists',
                'file_size_human',
                'download_url',
            ]);
    }

    public function test_authenticated_user_can_delete_backup(): void
    {
        $user = User::factory()->create();
        $backup = Backup::factory()->create(['user_id' => $user->id]);

        $response = $this->withHeaders($this->getAuthHeaders($user))
            ->deleteJson("/api/v1/backups/{$backup->id}");

        $response->assertStatus(200)
            ->assertJson(['message' => 'Backup deleted successfully']);

        $this->assertDatabaseMissing('backups', ['id' => $backup->id]);
    }

    public function test_backup_list_can_be_filtered_by_status(): void
    {
        $user = User::factory()->create();
        Backup::factory()->count(3)->create(['user_id' => $user->id, 'status' => 'completed']);
        Backup::factory()->count(2)->create(['user_id' => $user->id, 'status' => 'failed']);

        $response = $this->withHeaders($this->getAuthHeaders($user))
            ->getJson('/api/v1/backups?status=completed');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(3, $data['data']);
        foreach ($data['data'] as $backup) {
            $this->assertEquals('completed', $backup['status']);
        }
    }

    public function test_backup_list_can_be_searched(): void
    {
        $user = User::factory()->create();
        Backup::factory()->create([
            'user_id' => $user->id,
            'filename' => 'backup_database_2026-01-01.dump',
        ]);
        Backup::factory()->create([
            'user_id' => $user->id,
            'filename' => 'backup_database_2026-01-02.dump',
        ]);

        $response = $this->withHeaders($this->getAuthHeaders($user))
            ->getJson('/api/v1/backups?search=2026-01-01');

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertCount(1, $data['data']);
        $this->assertStringContainsString('2026-01-01', $data['data'][0]['filename']);
    }

    public function test_backup_service_can_clean_old_backups(): void
    {
        $user = User::factory()->create();
        
        // Create old backup (31 days ago)
        $oldBackup = Backup::factory()->create([
            'user_id' => $user->id,
            'status' => 'completed',
            'created_at' => now()->subDays(31),
        ]);

        // Create recent backup (5 days ago)
        $recentBackup = Backup::factory()->create([
            'user_id' => $user->id,
            'status' => 'completed',
            'created_at' => now()->subDays(5),
        ]);

        $deletedCount = BackupService::cleanOldBackups(30);

        $this->assertEquals(1, $deletedCount);
        $this->assertDatabaseMissing('backups', ['id' => $oldBackup->id]);
        $this->assertDatabaseHas('backups', ['id' => $recentBackup->id]);
    }

    public function test_unauthenticated_user_cannot_access_backups(): void
    {
        $response = $this->getJson('/api/v1/backups');
        $response->assertStatus(401);
    }
}
