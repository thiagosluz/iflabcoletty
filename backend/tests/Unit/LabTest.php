<?php

namespace Tests\Unit;

use App\Models\Computer;
use App\Models\Lab;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LabTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_has_many_computers(): void
    {
        $lab = Lab::factory()->create();
        $computer1 = Computer::factory()->create(['lab_id' => $lab->id]);
        $computer2 = Computer::factory()->create(['lab_id' => $lab->id]);

        $this->assertEquals(2, $lab->computers->count());
        $this->assertTrue($lab->computers->contains($computer1));
        $this->assertTrue($lab->computers->contains($computer2));
    }

    public function test_lab_can_be_created_with_description(): void
    {
        $lab = Lab::factory()->create([
            'name' => 'Lab de Teste',
            'description' => 'Descrição do laboratório',
        ]);

        $this->assertEquals('Lab de Teste', $lab->name);
        $this->assertEquals('Descrição do laboratório', $lab->description);
    }

    public function test_lab_can_be_created_without_description(): void
    {
        $lab = Lab::factory()->create([
            'name' => 'Lab sem Descrição',
            'description' => null,
        ]);

        $this->assertEquals('Lab sem Descrição', $lab->name);
        $this->assertNull($lab->description);
    }
}
