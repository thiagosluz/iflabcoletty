<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\Software;
use App\Models\Computer;
use Illuminate\Foundation\Testing\RefreshDatabase;

class SoftwareTest extends TestCase
{
    use RefreshDatabase;

    public function test_software_belongs_to_many_computers(): void
    {
        $software = Software::factory()->create();
        $computer1 = Computer::factory()->create();
        $computer2 = Computer::factory()->create();

        $software->computers()->attach($computer1->id, ['installed_at' => now()]);
        $software->computers()->attach($computer2->id, ['installed_at' => now()]);

        $this->assertEquals(2, $software->computers->count());
        $this->assertTrue($software->computers->contains($computer1));
        $this->assertTrue($software->computers->contains($computer2));
    }

    public function test_software_can_have_version(): void
    {
        $software = Software::factory()->create([
            'name' => 'Test Software',
            'version' => '1.0.0',
        ]);

        $this->assertEquals('Test Software', $software->name);
        $this->assertEquals('1.0.0', $software->version);
    }

    public function test_software_can_have_vendor(): void
    {
        $software = Software::factory()->create([
            'name' => 'Test Software',
            'vendor' => 'Test Vendor',
        ]);

        $this->assertEquals('Test Vendor', $software->vendor);
    }

    public function test_software_can_be_created_without_version(): void
    {
        $software = Software::factory()->create([
            'name' => 'Test Software',
            'version' => null,
        ]);

        $this->assertNull($software->version);
    }
}
