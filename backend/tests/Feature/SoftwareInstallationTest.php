<?php

namespace Tests\Feature;

use App\Models\Computer;
use App\Models\SoftwareInstallation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SoftwareInstallationTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_list_installations(): void
    {
        $user = $this->actingAsUser();
        // Manually create installations since factory is missing
        $computer = Computer::factory()->create();
        SoftwareInstallation::create([
            'computer_id' => $computer->id,
            'user_id' => $user->id,
            'software_name' => 'Test Soft',
            'installer_type' => 'upload',
            'status' => 'pending',
            'method' => 'upload' // deprecated/dup column? Controller uses installer_type in create, but validation checks method input. Model fillable?
        ]);

        $response = $this->getJson('/api/v1/software-installations', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'software_name', 'status', 'created_at'],
                ],
            ]);
    }

    public function test_authenticated_user_can_upload_installer(): void
    {
        Storage::fake('local');
        $user = $this->actingAsUser();
        $file = UploadedFile::fake()->create('setup.exe', 1000); // 1000kb

        $response = $this->postJson('/api/v1/software-installations/upload', [
            'file' => $file,
        ], $this->getAuthHeaders($user));

        $response->assertStatus(201)
            ->assertJsonStructure(['file_id', 'filename']);
    }

    public function test_authenticated_user_can_create_installation(): void
    {
        $user = $this->actingAsUser();
        $computers = Computer::factory()->count(3)->create([
            'hardware_info' => ['os' => ['system' => 'Windows']] // Mock Windows OS
        ]);

        $response = $this->postJson('/api/v1/software-installations', [
            'software_name' => 'New App',
            'method' => 'network',
            'network_path' => '\\\\server\\share\\setup.exe',
            'install_args' => '/S',
            'computer_ids' => $computers->pluck('id')->toArray()
        ], $this->getAuthHeaders($user));

        $response->assertStatus(201);

        // Check DB for command creation, as SoftwareInstallation is created via command logic
        $this->assertDatabaseHas('software_installations', ['software_name' => 'New App']);
    }

    public function test_authenticated_user_can_delete_installation(): void
    {
        $user = $this->actingAsUser();
        // Manually create
        $computer = Computer::factory()->create();
        $installation = SoftwareInstallation::create([
            'computer_id' => $computer->id,
            'user_id' => $user->id,
            'software_name' => 'To Delete',
            'installer_type' => 'url', // or upload/network
            'status' => 'pending',
            'method' => 'url'
        ]);

        $response = $this->deleteJson("/api/v1/software-installations/{$installation->id}", [], $this->getAuthHeaders($user));

        $response->assertStatus(200);

        $this->assertDatabaseMissing('software_installations', ['id' => $installation->id]);
    }
}
