<?php

namespace Tests\Feature;

use App\Models\Computer;
use App\Models\Lab;
use App\Models\Software;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class ComputerTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_list_computers(): void
    {
        $user = $this->actingAsUser();
        Computer::factory()->count(5)->create();

        $response = $this->getJson('/api/v1/computers', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'machine_id', 'hostname', 'lab'],
                ],
            ]);

        $this->assertCount(5, $response->json('data'));
    }

    public function test_computers_list_supports_pagination(): void
    {
        $user = $this->actingAsUser();
        Computer::factory()->count(25)->create();

        $response = $this->getJson('/api/v1/computers?per_page=10', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertEquals(10, $response->json('per_page'));
        $this->assertCount(10, $response->json('data'));
    }

    public function test_computers_list_supports_lab_filter(): void
    {
        $user = $this->actingAsUser();
        $lab1 = Lab::factory()->create();
        $lab2 = Lab::factory()->create();
        Computer::factory()->count(3)->create(['lab_id' => $lab1->id]);
        Computer::factory()->count(2)->create(['lab_id' => $lab2->id]);

        $response = $this->getJson("/api/v1/computers?lab_id={$lab1->id}", $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertCount(3, $response->json('data'));
    }

    public function test_computers_list_supports_search(): void
    {
        $user = $this->actingAsUser();
        Computer::factory()->create(['hostname' => 'computador-teste']);
        Computer::factory()->create(['hostname' => 'outro-computador']);

        $response = $this->getJson('/api/v1/computers?search=teste', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
    }

    public function test_authenticated_user_can_create_computer(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();

        $response = $this->postJson('/api/v1/computers', [
            'lab_id' => $lab->id,
            'machine_id' => 'unique-machine-id-123',
            'hostname' => 'computador-teste',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(201)
            ->assertJson([
                'machine_id' => 'unique-machine-id-123',
                'hostname' => 'computador-teste',
            ]);

        $this->assertDatabaseHas('computers', [
            'machine_id' => 'unique-machine-id-123',
        ]);
    }

    public function test_computer_creation_requires_lab_id(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/v1/computers', [
            'machine_id' => 'test-machine',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['lab_id']);
    }

    public function test_computer_creation_requires_machine_id(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();

        $response = $this->postJson('/api/v1/computers', [
            'lab_id' => $lab->id,
        ], $this->getAuthHeaders($user));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['machine_id']);
    }

    public function test_machine_id_must_be_unique(): void
    {
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        Computer::factory()->create(['machine_id' => 'existing-id']);

        $response = $this->postJson('/api/v1/computers', [
            'lab_id' => $lab->id,
            'machine_id' => 'existing-id',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['machine_id']);
    }

    public function test_authenticated_user_can_view_computer_details(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();

        $response = $this->getJson("/api/v1/computers/{$computer->id}", $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'id',
                'machine_id',
                'hostname',
                'lab',
            ]);
    }

    public function test_authenticated_user_can_update_computer(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create(['hostname' => 'hostname-original']);

        $response = $this->putJson("/api/v1/computers/{$computer->id}", [
            'hostname' => 'hostname-atualizado',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJson([
                'hostname' => 'hostname-atualizado',
            ]);

        $this->assertDatabaseHas('computers', [
            'id' => $computer->id,
            'hostname' => 'hostname-atualizado',
        ]);
    }

    public function test_authenticated_user_can_delete_computer(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();

        $response = $this->deleteJson("/api/v1/computers/{$computer->id}", [], $this->getAuthHeaders($user));

        $response->assertStatus(204);

        $this->assertDatabaseMissing('computers', ['id' => $computer->id]);
    }

    public function test_authenticated_user_can_get_computer_softwares(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();
        $software1 = Software::factory()->create();
        $software2 = Software::factory()->create();

        $computer->softwares()->attach([$software1->id, $software2->id], ['installed_at' => now()]);

        $response = $this->getJson("/api/v1/computers/{$computer->id}/softwares", $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'name', 'version', 'vendor', 'pivot'],
                ],
            ]);

        $this->assertCount(2, $response->json('data'));
    }

    public function test_computer_softwares_supports_search(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();
        $software1 = Software::factory()->create(['name' => 'Software Teste']);
        $software2 = Software::factory()->create(['name' => 'Outro Software']);

        $computer->softwares()->attach([$software1->id, $software2->id], ['installed_at' => now()]);

        $response = $this->getJson("/api/v1/computers/{$computer->id}/softwares?search=Teste", $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
    }

    public function test_computer_can_receive_agent_report(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();

        $hardwareInfo = [
            'cpu' => ['physical_cores' => 4, 'logical_cores' => 8],
            'memory' => ['total_gb' => 16],
            'disk' => ['total_gb' => 500],
            'os' => ['system' => 'Linux', 'release' => '5.4'],
        ];

        $softwares = [
            ['name' => 'Software 1', 'version' => '1.0.0', 'vendor' => 'Vendor 1'],
            ['name' => 'Software 2', 'version' => '2.0.0'],
        ];

        $response = $this->postJson("/api/v1/computers/{$computer->id}/report", [
            'hardware_info' => $hardwareInfo,
            'softwares' => $softwares,
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJson(['message' => 'Relatório recebido com sucesso']);

        $computer->refresh();
        $this->assertEquals($hardwareInfo, $computer->hardware_info);
        $this->assertEquals(2, $computer->softwares->count());
        $this->assertEquals(1, $computer->activities->count());
    }

    public function test_computer_can_generate_qr_code(): void
    {
        Config::set('app.frontend_url', 'http://localhost');
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();

        $response = $this->getJson("/api/v1/computers/{$computer->id}/qrcode", $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'image/png');
    }

    public function test_computer_qr_code_requires_public_hash(): void
    {
        Config::set('app.frontend_url', 'http://localhost');
        $user = $this->actingAsUser();
        // Create computer and then manually set public_hash to empty string
        // Since the DB constraint doesn't allow null, we'll use empty string which should also fail validation
        $computer = Computer::factory()->create();
        // Use raw SQL to bypass model and set empty string
        \DB::table('computers')->where('id', $computer->id)->update(['public_hash' => '']);

        $response = $this->getJson("/api/v1/computers/{$computer->id}/qrcode", $this->getAuthHeaders($user));

        $response->assertStatus(400);
    }

    public function test_computer_qr_code_requires_frontend_url(): void
    {
        Config::set('app.frontend_url', '');
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();

        $response = $this->getJson("/api/v1/computers/{$computer->id}/qrcode", $this->getAuthHeaders($user));

        $response->assertStatus(500);
    }

    public function test_authenticated_user_can_export_qr_codes_as_pdf(): void
    {
        Config::set('app.frontend_url', 'http://localhost');
        $user = $this->actingAsUser();
        Computer::factory()->count(3)->create();

        $response = $this->postJson('/api/v1/computers/export-qrcodes', [
            'format' => 'pdf',
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_export_qr_codes_requires_format(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/v1/computers/export-qrcodes', [], $this->getAuthHeaders($user));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['format']);
    }

    public function test_export_qr_codes_supports_lab_filter(): void
    {
        Config::set('app.frontend_url', 'http://localhost');
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        Computer::factory()->count(2)->create(['lab_id' => $lab->id]);
        Computer::factory()->count(3)->create();

        $response = $this->postJson('/api/v1/computers/export-qrcodes', [
            'format' => 'pdf',
            'lab_id' => $lab->id,
        ], $this->getAuthHeaders($user));

        $response->assertStatus(200);
    }

    public function test_unauthenticated_user_cannot_access_computers(): void
    {
        $response = $this->getJson('/api/v1/computers');

        $response->assertStatus(401);
    }
}
