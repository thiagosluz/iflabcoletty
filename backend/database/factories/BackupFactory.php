<?php

namespace Database\Factories;

use App\Models\Backup;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Backup>
 */
class BackupFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = Backup::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $timestamp = fake()->dateTimeBetween('-1 year', 'now')->format('Y-m-d_His');
        $extension = fake()->randomElement(['dump', 'sql']);
        $filename = "backup_database_{$timestamp}.{$extension}";

        return [
            'filename' => $filename,
            'file_path' => "backups/{$filename}",
            'file_size' => (string) fake()->numberBetween(1024, 10485760), // 1KB to 10MB
            'type' => fake()->randomElement(['database', 'full']),
            'status' => fake()->randomElement(['pending', 'completed', 'failed']),
            'error_message' => fake()->optional()->sentence(),
            'user_id' => User::factory(),
            'completed_at' => fake()->optional()->dateTimeBetween('-1 year', 'now'),
        ];
    }

    /**
     * Indicate that the backup is completed.
     */
    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'completed',
            'completed_at' => now(),
            'error_message' => null,
        ]);
    }

    /**
     * Indicate that the backup failed.
     */
    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'failed',
            'error_message' => 'Backup failed due to an error',
            'completed_at' => null,
        ]);
    }

    /**
     * Indicate that the backup is pending.
     */
    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'pending',
            'error_message' => null,
            'completed_at' => null,
        ]);
    }
}
