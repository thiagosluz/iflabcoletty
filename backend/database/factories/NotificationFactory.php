<?php

namespace Database\Factories;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Notification>
 */
class NotificationFactory extends Factory
{
    protected $model = Notification::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $types = [
            'computer.offline',
            'computer.online',
            'software.installed',
            'software.removed',
            'hardware.cpu_high',
            'hardware.memory_high',
            'hardware.disk_full',
        ];

        return [
            'user_id' => User::factory(),
            'type' => $this->faker->randomElement($types),
            'title' => $this->faker->sentence(3),
            'message' => $this->faker->sentence(10),
            'data' => [
                'computer_id' => $this->faker->numberBetween(1, 100),
                'lab_id' => $this->faker->numberBetween(1, 10),
            ],
            'read' => $this->faker->boolean(30), // 30% chance of being read
            'read_at' => function (array $attributes) {
                return $attributes['read'] ? $this->faker->dateTimeBetween('-1 week', 'now') : null;
            },
        ];
    }
}
