<?php

namespace Database\Factories;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AuditLog>
 */
class AuditLogFactory extends Factory
{
    protected $model = AuditLog::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $actions = ['create', 'update', 'delete', 'view'];
        $resourceTypes = ['Lab', 'Computer', 'Software'];

        return [
            'user_id' => User::factory(),
            'action' => fake()->randomElement($actions),
            'resource_type' => fake()->randomElement($resourceTypes),
            'resource_id' => fake()->numberBetween(1, 100),
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'old_values' => null,
            'new_values' => [
                'name' => fake()->words(3, true),
                'description' => fake()->sentence(),
            ],
            'description' => fake()->sentence(),
            'created_at' => fake()->dateTimeBetween('-30 days', 'now'),
            'updated_at' => now(),
        ];
    }
}
