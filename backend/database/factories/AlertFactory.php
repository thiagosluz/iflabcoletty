<?php

namespace Database\Factories;

use App\Models\AlertRule;
use App\Models\Computer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Alert>
 */
class AlertFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'alert_rule_id' => AlertRule::factory(),
            'computer_id' => Computer::factory(),
            'title' => $this->faker->sentence,
            'description' => $this->faker->paragraph,
            'severity' => 'warning',
            'status' => 'active',
            'trigger_value' => 95.5,
        ];
    }
}
