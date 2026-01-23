<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Software;
use App\Models\Computer;
use Illuminate\Foundation\Testing\RefreshDatabase;

class SoftwareTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_list_softwares(): void
    {
        $user = $this->actingAsUser();
        Software::factory()->count(5)->create();

        $response = $this->getJson('/api/v1/softwares', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'name', 'version', 'vendor', 'computers_count'],
                ],
            ]);

        $this->assertCount(5, $response->json('data'));
    }

    public function test_softwares_list_supports_pagination(): void
    {
        $user = $this->actingAsUser();
        Software::factory()->count(25)->create();

        $response = $this->getJson('/api/v1/softwares?per_page=10', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertEquals(10, $response->json('per_page'));
        $this->assertCount(10, $response->json('data'));
    }

    public function test_softwares_list_supports_search(): void
    {
        $user = $this->actingAsUser();
        Software::factory()->create(['name' => 'Software Teste']);
        Software::factory()->create(['name' => 'Outro Software']);

        $response = $this->getJson('/api/v1/softwares?search=Teste', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
    }

    public function test_authenticated_user_can_view_software_details(): void
    {
        $user = $this->actingAsUser();
        $software = Software::factory()->create();
        $computer = Computer::factory()->create();
        $software->computers()->attach($computer->id, ['installed_at' => now()]);

        $response = $this->getJson("/api/v1/softwares/{$software->id}", $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'id',
                'name',
                'version',
                'vendor',
                'computers',
            ]);

        $this->assertCount(1, $response->json('computers'));
    }

    public function test_softwares_list_includes_computers_count(): void
    {
        $user = $this->actingAsUser();
        $software = Software::factory()->create();
        $computer1 = Computer::factory()->create();
        $computer2 = Computer::factory()->create();
        $software->computers()->attach([$computer1->id, $computer2->id], ['installed_at' => now()]);

        $response = $this->getJson('/api/v1/softwares', $this->getAuthHeaders($user));

        $response->assertStatus(200);
        $softwareData = collect($response->json('data'))->firstWhere('id', $software->id);
        $this->assertEquals(2, $softwareData['computers_count']);
    }

    public function test_unauthenticated_user_cannot_access_softwares(): void
    {
        $response = $this->getJson('/api/v1/softwares');

        $response->assertStatus(401);
    }
}
