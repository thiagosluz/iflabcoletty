<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\ComputerActivity;
use App\Models\Computer;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ComputerActivityTest extends TestCase
{
    use RefreshDatabase;

    public function test_activity_belongs_to_computer(): void
    {
        $computer = Computer::factory()->create();
        $activity = ComputerActivity::factory()->create(['computer_id' => $computer->id]);

        $this->assertInstanceOf(Computer::class, $activity->computer);
        $this->assertEquals($computer->id, $activity->computer->id);
    }

    public function test_activity_payload_is_cast_to_array(): void
    {
        $payload = [
            'key' => 'value',
            'number' => 123,
        ];

        $activity = ComputerActivity::factory()->create(['payload' => $payload]);

        $this->assertIsArray($activity->payload);
        $this->assertEquals('value', $activity->payload['key']);
        $this->assertEquals(123, $activity->payload['number']);
    }

    public function test_activity_can_have_null_payload(): void
    {
        $activity = ComputerActivity::factory()->create(['payload' => null]);

        $this->assertNull($activity->payload);
    }

    public function test_activity_can_have_different_types(): void
    {
        $types = ['agent_report', 'boot', 'shutdown', 'software_change'];

        foreach ($types as $type) {
            $activity = ComputerActivity::factory()->create(['type' => $type]);
            $this->assertEquals($type, $activity->type);
        }
    }
}
