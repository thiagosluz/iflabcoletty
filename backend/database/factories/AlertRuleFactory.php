<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AlertRule>
 */
class AlertRuleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->sentence(3),
            'description' => $this->faker->sentence,
            'type' => 'metric',
            'metric' => 'cpu_usage',
            'condition' => '>',
            'threshold' => 90,
            'duration_minutes' => 5,
            'severity' => 'warning',
            'is_active' => true,
            'notification_channels' => ['database'],
        ];
    }
}
