<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Computer;
use App\Models\Lab;
use App\Models\Software;
use Illuminate\Foundation\Testing\RefreshDatabase;

class PublicTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_can_view_computer_by_hash(): void
    {
        $lab = Lab::factory()->create();
        $computer = Computer::factory()->withHardwareInfo()->create([
            'lab_id' => $lab->id,
            'hostname' => 'computador-publico',
        ]);

        $response = $this->getJson("/api/v1/public/computers/{$computer->public_hash}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'hostname',
                'lab',
                'hardware_info',
                'status',
                'last_seen',
            ])
            ->assertJson([
                'hostname' => 'computador-publico',
            ]);
    }

    public function test_public_cannot_view_nonexistent_computer(): void
    {
        $response = $this->getJson('/api/v1/public/computers/invalid-hash');

        $response->assertStatus(404)
            ->assertJson([
                'message' => 'Computador não encontrado',
            ]);
    }

    public function test_public_computer_view_shows_online_status(): void
    {
        $computer = Computer::factory()->online()->create();

        $response = $this->getJson("/api/v1/public/computers/{$computer->public_hash}");

        $response->assertStatus(200);
        $this->assertEquals('online', $response->json('status'));
    }

    public function test_public_computer_view_shows_offline_status(): void
    {
        // Create computer with updated_at set to 10 minutes ago (more than 5 minute threshold)
        $computer = Computer::factory()->create();
        // Use DB::table to bypass model timestamps and set updated_at to 10 minutes ago
        $offlineTime = now()->subMinutes(10);
        \DB::table('computers')->where('id', $computer->id)->update(['updated_at' => $offlineTime]);
        
        // Refresh the model to get the updated timestamp
        $computer->refresh();

        $response = $this->getJson("/api/v1/public/computers/{$computer->public_hash}");

        $response->assertStatus(200);
        // Verify the status is offline (more than 5 minutes since update)
        $this->assertEquals('offline', $response->json('status'));
    }

    public function test_public_can_view_computer_softwares(): void
    {
        $computer = Computer::factory()->create();
        $software1 = Software::factory()->create();
        $software2 = Software::factory()->create();
        $computer->softwares()->attach([$software1->id, $software2->id], ['installed_at' => now()]);

        $response = $this->getJson("/api/v1/public/computers/{$computer->public_hash}/softwares");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'name', 'version', 'vendor'],
                ],
            ]);

        $this->assertCount(2, $response->json('data'));
    }

    public function test_public_computer_softwares_supports_search(): void
    {
        $computer = Computer::factory()->create();
        $software1 = Software::factory()->create(['name' => 'Software Teste']);
        $software2 = Software::factory()->create(['name' => 'Outro Software']);
        $computer->softwares()->attach([$software1->id, $software2->id], ['installed_at' => now()]);

        $response = $this->getJson("/api/v1/public/computers/{$computer->public_hash}/softwares?search=Teste");

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
    }

    public function test_public_computer_softwares_supports_pagination(): void
    {
        $computer = Computer::factory()->create();
        $softwares = Software::factory()->count(15)->create();
        $computer->softwares()->attach($softwares->pluck('id')->toArray(), ['installed_at' => now()]);

        $response = $this->getJson("/api/v1/public/computers/{$computer->public_hash}/softwares?per_page=10");

        $response->assertStatus(200);
        $this->assertEquals(10, $response->json('per_page'));
        $this->assertCount(10, $response->json('data'));
    }

    public function test_public_cannot_view_softwares_for_nonexistent_computer(): void
    {
        $response = $this->getJson('/api/v1/public/computers/invalid-hash/softwares');

        $response->assertStatus(404)
            ->assertJson([
                'message' => 'Computador não encontrado',
            ]);
    }

    public function test_public_endpoints_do_not_require_authentication(): void
    {
        $computer = Computer::factory()->create();

        // Should work without authentication
        $response = $this->getJson("/api/v1/public/computers/{$computer->public_hash}");

        $response->assertStatus(200);
    }
}
