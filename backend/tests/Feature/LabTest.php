<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Lab;
use App\Models\Computer;
use App\Models\Software;
use Illuminate\Foundation\Testing\RefreshDatabase;

class LabTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_list_labs(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(3)->create();

        $response = $this->getJson('/api/v1/labs', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'name', 'description', 'computers_count'],
                ],
                'current_page',
                'per_page',
            ]);

        $this->assertCount(3, $response->json('data'));
    }

    public function test_labs_list_supports_pagination(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->count(25)->create();

        $response = $this->getJson('/api/v1/labs?per_page=10', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertEquals(10, $response->json('per_page'));
        $this->assertCount(10, $response->json('data'));
    }

    public function test_authenticated_user_can_create_lab(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/v1/labs', [
            'name' => 'Novo Laboratório',
            'description' => 'Descrição do laboratório',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(201)
            ->assertJson([
                'name' => 'Novo Laboratório',
                'description' => 'Descrição do laboratório',
            ]);

        $this->assertDatabaseHas('labs', [
            'name' => 'Novo Laboratório',
        ]);
    }

    public function test_lab_creation_requires_name(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/v1/labs', [
            'description' => 'Descrição',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_lab_name_must_be_unique(): void
    {
        $user = $this->actingAsUser();
        Lab::factory()->create(['name' => 'Lab Existente']);

        $response = $this->postJson('/api/v1/labs', [
            'name' => 'Lab Existente',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_authenticated_user_can_view_lab_details(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        Computer::factory()->count(3)->create(['lab_id' => $lab->id]);

        $response = $this->getJson("/api/v1/labs/{$lab->id}", $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'lab' => ['id', 'name', 'description', 'created_at'],
                'stats' => [
                    'total_computers',
                    'online_computers',
                    'offline_computers',
                    'total_softwares',
                ],
            ]);
    }

    public function test_authenticated_user_can_update_lab(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create(['name' => 'Lab Original']);

        $response = $this->putJson("/api/v1/labs/{$lab->id}", [
            'name' => 'Lab Atualizado',
            'description' => 'Nova descrição',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJson([
                'name' => 'Lab Atualizado',
                'description' => 'Nova descrição',
            ]);

        $this->assertDatabaseHas('labs', [
            'id' => $lab->id,
            'name' => 'Lab Atualizado',
        ]);
    }

    public function test_authenticated_user_can_delete_lab(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();

        $response = $this->deleteJson("/api/v1/labs/{$lab->id}", [], $this->getAuthHeaders($user));

        $response->assertStatus(204);

        $this->assertDatabaseMissing('labs', ['id' => $lab->id]);
    }

    public function test_authenticated_user_can_get_lab_computers(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        Computer::factory()->count(5)->create(['lab_id' => $lab->id]);

        $response = $this->getJson("/api/v1/labs/{$lab->id}/computers", $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'machine_id', 'hostname', 'lab'],
                ],
            ]);

        $this->assertCount(5, $response->json('data'));
    }

    public function test_lab_computers_supports_search(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        Computer::factory()->create([
            'lab_id' => $lab->id,
            'hostname' => 'computador-teste',
        ]);
        Computer::factory()->create([
            'lab_id' => $lab->id,
            'hostname' => 'outro-computador',
        ]);

        $response = $this->getJson("/api/v1/labs/{$lab->id}/computers?search=teste", $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertStringContainsString('teste', $response->json('data.0.hostname'));
    }

    public function test_lab_computers_supports_status_filter(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        Computer::factory()->online()->create(['lab_id' => $lab->id]);
        Computer::factory()->offline()->create(['lab_id' => $lab->id]);

        $response = $this->getJson("/api/v1/labs/{$lab->id}/computers?status=online", $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
    }

    public function test_authenticated_user_can_get_lab_softwares(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        $computer = Computer::factory()->create(['lab_id' => $lab->id]);
        $software1 = Software::factory()->create();
        $software2 = Software::factory()->create();

        $computer->softwares()->attach([$software1->id, $software2->id], ['installed_at' => now()]);

        $response = $this->getJson("/api/v1/labs/{$lab->id}/softwares", $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'name', 'version', 'vendor', 'computers_count'],
                ],
            ]);

        $this->assertCount(2, $response->json('data'));
    }

    public function test_lab_softwares_supports_search(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        $computer = Computer::factory()->create(['lab_id' => $lab->id]);
        $software1 = Software::factory()->create(['name' => 'Software Teste']);
        $software2 = Software::factory()->create(['name' => 'Outro Software']);

        $computer->softwares()->attach([$software1->id, $software2->id], ['installed_at' => now()]);

        $response = $this->getJson("/api/v1/labs/{$lab->id}/softwares?search=Teste", $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertStringContainsString('Teste', $response->json('data.0.name'));
    }

    public function test_unauthenticated_user_cannot_access_labs(): void
    {
        $response = $this->getJson('/api/v1/labs');

        $response->assertStatus(401);
    }
}
