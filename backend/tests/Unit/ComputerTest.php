<?php

namespace Tests\Unit;

use App\Models\Computer;
use App\Models\ComputerActivity;
use App\Models\Lab;
use App\Models\Software;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ComputerTest extends TestCase
{
    use RefreshDatabase;

    public function test_computer_belongs_to_lab(): void
    {
        $lab = Lab::factory()->create();
        $computer = Computer::factory()->create(['lab_id' => $lab->id]);

        $this->assertInstanceOf(Lab::class, $computer->lab);
        $this->assertEquals($lab->id, $computer->lab->id);
    }

    public function test_computer_has_many_activities(): void
    {
        $computer = Computer::factory()->create();
        $activity = ComputerActivity::factory()->create(['computer_id' => $computer->id]);

        $this->assertTrue($computer->activities->contains($activity));
        $this->assertEquals(1, $computer->activities->count());
    }

    public function test_computer_belongs_to_many_softwares(): void
    {
        $computer = Computer::factory()->create();
        $software1 = Software::factory()->create();
        $software2 = Software::factory()->create();

        $computer->softwares()->attach($software1->id, ['installed_at' => now()]);
        $computer->softwares()->attach($software2->id, ['installed_at' => now()]);

        $this->assertEquals(2, $computer->softwares->count());
        $this->assertTrue($computer->softwares->contains($software1));
        $this->assertTrue($computer->softwares->contains($software2));
    }

    public function test_computer_generates_public_hash_on_creation(): void
    {
        $computer = Computer::factory()->create(['public_hash' => null]);

        $this->assertNotNull($computer->public_hash);
        $this->assertEquals(64, strlen($computer->public_hash)); // 32 bytes = 64 hex chars
    }

    public function test_computer_generate_public_hash_method(): void
    {
        $computer = Computer::factory()->make();
        $hash = $computer->generatePublicHash();

        $this->assertIsString($hash);
        $this->assertEquals(64, strlen($hash));
    }

    public function test_computer_hardware_info_is_cast_to_array(): void
    {
        $hardwareInfo = [
            'cpu' => ['physical_cores' => 4],
            'memory' => ['total_gb' => 8],
        ];

        $computer = Computer::factory()->create(['hardware_info' => $hardwareInfo]);

        $this->assertIsArray($computer->hardware_info);
        $this->assertEquals(4, $computer->hardware_info['cpu']['physical_cores']);
    }

    public function test_computer_can_be_created_without_public_hash(): void
    {
        $computer = Computer::factory()->make(['public_hash' => null]);
        $computer->save();

        $this->assertNotNull($computer->public_hash);
    }
}
