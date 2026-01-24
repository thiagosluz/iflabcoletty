<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Computer;
use App\Models\Lab;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_list_audit_logs(): void
    {
        $user = $this->actingAsUser();

        // Create some audit logs
        AuditLog::factory()->count(5)->create(['user_id' => $user->id]);

        $response = $this->getJson('/api/v1/audit-logs', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'user_id',
                        'action',
                        'resource_type',
                        'resource_id',
                        'description',
                        'created_at',
                    ],
                ],
                'current_page',
                'total',
            ]);
    }

    public function test_audit_logs_list_supports_pagination(): void
    {
        $user = $this->actingAsUser();
        AuditLog::factory()->count(25)->create(['user_id' => $user->id]);

        $response = $this->getJson('/api/v1/audit-logs?per_page=10', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertCount(10, $response->json('data'));
        $this->assertEquals(25, $response->json('total'));
    }

    public function test_audit_logs_list_supports_action_filter(): void
    {
        $user = $this->actingAsUser();
        AuditLog::factory()->create(['user_id' => $user->id, 'action' => 'create']);
        AuditLog::factory()->create(['user_id' => $user->id, 'action' => 'update']);
        AuditLog::factory()->create(['user_id' => $user->id, 'action' => 'delete']);

        $response = $this->getJson('/api/v1/audit-logs?action=create', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals('create', $response->json('data.0.action'));
    }

    public function test_audit_logs_list_supports_resource_type_filter(): void
    {
        $user = $this->actingAsUser();
        AuditLog::factory()->create(['user_id' => $user->id, 'resource_type' => 'Lab']);
        AuditLog::factory()->create(['user_id' => $user->id, 'resource_type' => 'Computer']);

        $response = $this->getJson('/api/v1/audit-logs?resource_type=Lab', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals('Lab', $response->json('data.0.resource_type'));
    }

    public function test_audit_logs_list_supports_user_filter(): void
    {
        $user1 = $this->actingAsUser();
        $user2 = User::factory()->create();

        AuditLog::factory()->create(['user_id' => $user1->id]);
        AuditLog::factory()->create(['user_id' => $user2->id]);

        $response = $this->getJson("/api/v1/audit-logs?user_id={$user1->id}", $this->getAuthHeaders($user1));

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals($user1->id, $response->json('data.0.user_id'));
    }

    public function test_audit_logs_list_supports_date_range_filter(): void
    {
        $user = $this->actingAsUser();
        AuditLog::factory()->create([
            'user_id' => $user->id,
            'created_at' => now()->subDays(5),
        ]);
        AuditLog::factory()->create([
            'user_id' => $user->id,
            'created_at' => now()->subDays(2),
        ]);
        AuditLog::factory()->create([
            'user_id' => $user->id,
            'created_at' => now(),
        ]);

        $dateFrom = now()->subDays(3)->format('Y-m-d');
        $dateTo = now()->format('Y-m-d');

        $response = $this->getJson(
            "/api/v1/audit-logs?date_from={$dateFrom}&date_to={$dateTo}",
            $this->getAuthHeaders($user)
        );

        $response->assertStatus(200);
        $this->assertGreaterThanOrEqual(2, count($response->json('data')));
    }

    public function test_audit_logs_list_supports_search(): void
    {
        $user = $this->actingAsUser();
        AuditLog::factory()->create([
            'user_id' => $user->id,
            'description' => 'Test description',
        ]);
        AuditLog::factory()->create([
            'user_id' => $user->id,
            'description' => 'Another description',
        ]);

        $response = $this->getJson('/api/v1/audit-logs?search=Test', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, count($response->json('data')));
    }

    public function test_authenticated_user_can_view_audit_log_details(): void
    {
        $user = $this->actingAsUser();
        $log = AuditLog::factory()->create(['user_id' => $user->id]);

        $response = $this->getJson("/api/v1/audit-logs/{$log->id}", $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJson([
                'id' => $log->id,
                'action' => $log->action,
                'resource_type' => $log->resource_type,
            ]);
    }

    public function test_authenticated_user_can_get_audit_log_stats(): void
    {
        $user = $this->actingAsUser();
        AuditLog::factory()->count(10)->create(['user_id' => $user->id]);

        $response = $this->getJson('/api/v1/audit-logs/stats', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'total_logs',
                'logs_today',
                'logs_this_week',
                'logs_this_month',
                'actions_count',
                'resource_types_count',
                'most_active_users',
            ]);
    }

    public function test_audit_log_is_created_when_lab_is_created(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/v1/labs', [
            'name' => 'Test Lab',
            'description' => 'Test Description',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(201);

        // Check if audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'create',
            'resource_type' => 'Lab',
        ]);
    }

    public function test_audit_log_is_created_when_lab_is_updated(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();

        $response = $this->putJson("/api/v1/labs/{$lab->id}", [
            'name' => 'Updated Lab Name',
            'description' => $lab->description,
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200);

        // Check if audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'update',
            'resource_type' => 'Lab',
            'resource_id' => $lab->id,
        ]);
    }

    public function test_audit_log_is_created_when_lab_is_deleted(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        $labId = $lab->id;

        $response = $this->deleteJson("/api/v1/labs/{$lab->id}", [], $this->getAuthHeaders($user));

        $response->assertStatus(204);

        // Check if audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'delete',
            'resource_type' => 'Lab',
            'resource_id' => $labId,
        ]);
    }

    public function test_audit_log_is_created_when_computer_is_created(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();

        $response = $this->postJson('/api/v1/computers', [
            'lab_id' => $lab->id,
            'machine_id' => 'test-machine-'.uniqid(),
            'hostname' => 'test-pc',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(201);

        // Check if audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'create',
            'resource_type' => 'Computer',
        ]);
    }

    public function test_audit_log_is_created_when_computer_is_updated(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();

        $response = $this->putJson("/api/v1/computers/{$computer->id}", [
            'hostname' => 'updated-hostname',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200);

        // Check if audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'update',
            'resource_type' => 'Computer',
            'resource_id' => $computer->id,
        ]);
    }

    public function test_audit_log_is_created_when_computer_is_deleted(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();
        $computerId = $computer->id;

        $response = $this->deleteJson("/api/v1/computers/{$computer->id}", [], $this->getAuthHeaders($user));

        $response->assertStatus(204);

        // Check if audit log was created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'delete',
            'resource_type' => 'Computer',
            'resource_id' => $computerId,
        ]);
    }

    public function test_unauthenticated_user_cannot_access_audit_logs(): void
    {
        $response = $this->getJson('/api/v1/audit-logs');

        $response->assertStatus(401);
    }
}
