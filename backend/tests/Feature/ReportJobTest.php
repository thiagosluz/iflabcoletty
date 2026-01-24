<?php

namespace Tests\Feature;

use App\Jobs\GenerateReportJob;
use App\Models\Computer;
use App\Models\Lab;
use App\Models\ReportJob;
use App\Models\Software;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ReportJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_async_report_job_for_labs(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(3)->create();

        Queue::fake();

        $response = $this->postJson('/api/v1/reports/labs', [
            'format' => 'pdf',
            'async' => true,
        ], $this->getAuthHeaders($user));

        $response->assertStatus(202);
        $response->assertJsonStructure([
            'message',
            'job_id',
            'status',
        ]);

        // Verify job was dispatched
        Queue::assertPushed(GenerateReportJob::class, function ($job) {
            return $job->type === 'labs' && $job->format === 'pdf';
        });

        // Verify report job was created
        $this->assertDatabaseHas('report_jobs', [
            'user_id' => $user->id,
            'type' => 'labs',
            'format' => 'pdf',
            'status' => 'pending',
        ]);
    }

    public function test_user_can_create_async_report_job_for_computers(): void
    {
        $user = $this->actingAsUser();
        Computer::factory()->count(3)->create();

        Queue::fake();

        $response = $this->postJson('/api/v1/reports/computers', [
            'format' => 'csv',
            'async' => true,
        ], $this->getAuthHeaders($user));

        $response->assertStatus(202);
        $response->assertJsonStructure([
            'message',
            'job_id',
            'status',
        ]);

        Queue::assertPushed(GenerateReportJob::class);
    }

    public function test_user_can_create_async_report_job_for_softwares(): void
    {
        $user = $this->actingAsUser();
        Software::factory()->count(3)->create();

        Queue::fake();

        $response = $this->postJson('/api/v1/reports/softwares', [
            'format' => 'xlsx',
            'async' => true,
        ], $this->getAuthHeaders($user));

        $response->assertStatus(202);
        $response->assertJsonStructure([
            'message',
            'job_id',
            'status',
        ]);

        Queue::assertPushed(GenerateReportJob::class);
    }

    public function test_user_can_get_job_status(): void
    {
        $user = $this->actingAsUser();
        $job = ReportJob::factory()->create([
            'user_id' => $user->id,
            'type' => 'labs',
            'format' => 'pdf',
            'status' => 'processing',
        ]);

        $response = $this->getJson("/api/v1/reports/jobs/{$job->id}", $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'id',
            'type',
            'format',
            'status',
            'file_path',
            'download_url',
            'error_message',
            'started_at',
            'completed_at',
            'failed_at',
            'created_at',
        ]);
    }

    public function test_user_cannot_access_other_users_jobs(): void
    {
        $user1 = $this->actingAsUser();
        $user2 = User::factory()->create();

        $job = ReportJob::factory()->create([
            'user_id' => $user2->id,
        ]);

        $response = $this->getJson("/api/v1/reports/jobs/{$job->id}", $this->getAuthHeaders($user1));

        $response->assertStatus(403);
    }

    public function test_user_can_list_their_jobs(): void
    {
        $user = $this->actingAsUser();
        ReportJob::factory()->count(5)->create(['user_id' => $user->id]);
        ReportJob::factory()->count(3)->create(); // Other user's jobs

        $response = $this->getJson('/api/v1/reports/jobs', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data',
            'current_page',
            'total',
        ]);

        $this->assertCount(5, $response->json('data'));
    }

    public function test_user_can_download_completed_report(): void
    {
        Storage::fake('local');

        $user = $this->actingAsUser();
        $filePath = 'reports/test-report.pdf';
        Storage::put($filePath, 'fake pdf content');

        $job = ReportJob::factory()->create([
            'user_id' => $user->id,
            'status' => 'completed',
            'file_path' => $filePath,
        ]);

        $response = $this->getJson("/api/v1/reports/jobs/{$job->id}/download", $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_user_cannot_download_other_users_reports(): void
    {
        $user1 = $this->actingAsUser();
        $user2 = User::factory()->create();

        $job = ReportJob::factory()->create([
            'user_id' => $user2->id,
            'status' => 'completed',
            'file_path' => 'reports/test.pdf',
        ]);

        $response = $this->getJson("/api/v1/reports/jobs/{$job->id}/download", $this->getAuthHeaders($user1));

        $response->assertStatus(403);
    }

    public function test_generate_report_job_processes_successfully(): void
    {
        Storage::fake('local');

        $user = $this->actingAsUser();
        Lab::factory()->count(3)->create();

        $job = ReportJob::factory()->create([
            'user_id' => $user->id,
            'type' => 'labs',
            'format' => 'pdf',
            'status' => 'pending',
        ]);

        $reportJob = new GenerateReportJob($job->id, 'labs', 'pdf', []);
        $reportJob->handle();

        $job->refresh();
        $this->assertEquals('completed', $job->status);
        $this->assertNotNull($job->file_path);
        $this->assertNotNull($job->completed_at);
        Storage::assertExists($job->file_path);
    }

    public function test_generate_report_job_handles_failure(): void
    {
        $user = $this->actingAsUser();

        // Create job with invalid type to trigger failure
        $job = ReportJob::factory()->create([
            'user_id' => $user->id,
            'type' => 'invalid_type',
            'format' => 'pdf',
            'status' => 'pending',
        ]);

        $reportJob = new GenerateReportJob($job->id, 'invalid_type', 'pdf', []);

        try {
            $reportJob->handle();
        } catch (\Exception $e) {
            // Expected to fail
        }

        $job->refresh();
        $this->assertEquals('failed', $job->status);
        $this->assertNotNull($job->error_message);
        $this->assertNotNull($job->failed_at);
    }

    public function test_synchronous_export_still_works(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(3)->create();

        $response = $this->postJson('/api/v1/reports/labs', [
            'format' => 'pdf',
            'async' => false,
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_job_filters_are_stored_correctly(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(3)->create();

        Queue::fake();

        $response = $this->postJson('/api/v1/reports/computers', [
            'format' => 'csv',
            'async' => true,
            'search' => 'test',
            'lab_id' => 1,
            'status' => 'online',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(202);

        $job = ReportJob::where('user_id', $user->id)->first();
        $this->assertNotNull($job);
        $this->assertEquals('computers', $job->type);
        $this->assertArrayHasKey('search', $job->filters);
        $this->assertArrayHasKey('lab_id', $job->filters);
        $this->assertArrayHasKey('status', $job->filters);
    }
}
