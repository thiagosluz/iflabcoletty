<?php

namespace Database\Factories;

use App\Models\Computer;
use App\Models\Lab;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Computer>
 */
class ComputerFactory extends Factory
{
    protected $model = Computer::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lab_id' => Lab::factory(),
            'machine_id' => fake()->unique()->uuid(),
            'hostname' => fake()->optional()->domainName(),
            'public_hash' => bin2hex(random_bytes(32)),
            'hardware_info' => null,
        ];
    }

    /**
     * Indicate that the computer has hardware info
     */
    public function withHardwareInfo(): static
    {
        return $this->state(fn (array $attributes) => [
            'hardware_info' => [
                'cpu' => [
                    'physical_cores' => fake()->numberBetween(2, 16),
                    'logical_cores' => fake()->numberBetween(4, 32),
                    'model' => fake()->words(3, true),
                ],
                'memory' => [
                    'total_gb' => fake()->randomFloat(2, 4, 64),
                ],
                'disk' => [
                    'total_gb' => fake()->randomFloat(2, 100, 2000),
                    'used_gb' => fake()->randomFloat(2, 10, 1500),
                    'free_gb' => fake()->randomFloat(2, 10, 500),
                ],
                'os' => [
                    'system' => fake()->randomElement(['Linux', 'Windows', 'macOS']),
                    'release' => fake()->numerify('#.#'),
                ],
            ],
        ]);
    }

    /**
     * Indicate that the computer is online (recently updated)
     */
    public function online(): static
    {
        return $this->state(fn (array $attributes) => [
            'updated_at' => now(),
        ]);
    }

    /**
     * Indicate that the computer is offline (not updated recently)
     */
    public function offline(): static
    {
        return $this->state(fn (array $attributes) => [
            'updated_at' => now()->subHours(2),
        ]);
    }
}
