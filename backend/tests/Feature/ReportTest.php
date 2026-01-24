<?php

namespace Tests\Feature;

use App\Models\Computer;
use App\Models\Lab;
use App\Models\Software;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_export_labs_as_pdf(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(3)->create();

        $response = $this->postJson('/api/v1/reports/labs', [
            'format' => 'pdf',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_authenticated_user_can_export_labs_as_csv(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(3)->create();

        $response = $this->postJson('/api/v1/reports/labs', [
            'format' => 'csv',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_authenticated_user_can_export_labs_as_xlsx(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(3)->create();

        $response = $this->postJson('/api/v1/reports/labs', [
            'format' => 'xlsx',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200);
        // XLSX files have specific content type
        $this->assertStringContainsString('spreadsheet', $response->headers->get('Content-Type'));
    }

    public function test_labs_export_supports_search_filter(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->create(['name' => 'Lab Teste']);
        Lab::factory()->create(['name' => 'Outro Lab']);

        $response = $this->postJson('/api/v1/reports/labs', [
            'format' => 'pdf',
            'search' => 'Teste',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200);
    }

    public function test_labs_export_requires_format(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/v1/reports/labs', [], $this->getAuthHeaders($user));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['format']);
    }

    public function test_labs_export_returns_404_when_no_data(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/v1/reports/labs', [
            'format' => 'pdf',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(404);
    }

    public function test_authenticated_user_can_export_computers_as_pdf(): void
    {
        $user = $this->actingAsUser();
        Computer::factory()->count(3)->create();

        $response = $this->postJson('/api/v1/reports/computers', [
            'format' => 'pdf',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_computers_export_supports_filters(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        // Create computers that match the search filter
        Computer::factory()->count(2)->create([
            'lab_id' => $lab->id,
            'hostname' => 'test-computer-1',
        ]);
        Computer::factory()->online()->count(1)->create([
            'lab_id' => $lab->id,
            'hostname' => 'test-computer-2',
        ]);
        Computer::factory()->count(3)->create();

        $response = $this->postJson('/api/v1/reports/computers', [
            'format' => 'pdf',
            'lab_id' => $lab->id,
            'search' => 'test',
            'status' => 'online',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_export_softwares_as_pdf(): void
    {
        $user = $this->actingAsUser();
        Software::factory()->count(3)->create();

        $response = $this->postJson('/api/v1/reports/softwares', [
            'format' => 'pdf',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_softwares_export_supports_search_filter(): void
    {
        $user = $this->actingAsUser();
        Software::factory()->create(['name' => 'Software Teste']);
        Software::factory()->create(['name' => 'Outro Software']);

        $response = $this->postJson('/api/v1/reports/softwares', [
            'format' => 'pdf',
            'search' => 'Teste',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200);
    }

    public function test_unauthenticated_user_cannot_export_reports(): void
    {
        $response = $this->postJson('/api/v1/reports/labs', [
            'format' => 'pdf',
        ]);

        $response->assertStatus(401);
    }
}
