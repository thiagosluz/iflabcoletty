<?php

namespace Database\Factories;

use App\Models\Computer;
use App\Models\ComputerActivity;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ComputerActivity>
 */
class ComputerActivityFactory extends Factory
{
    protected $model = ComputerActivity::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'computer_id' => Computer::factory(),
            'type' => fake()->randomElement(['agent_report', 'boot', 'shutdown', 'software_change']),
            'description' => fake()->sentence(),
            'payload' => null,
        ];
    }

    /**
     * Indicate that the activity is an agent report
     */
    public function agentReport(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'agent_report',
            'description' => 'Agente enviou relatório detalhado do sistema',
            'payload' => [
                'hardware_info' => true,
                'softwares_count' => fake()->numberBetween(10, 100),
            ],
        ]);
    }
}
