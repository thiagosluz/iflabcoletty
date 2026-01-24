<?php

namespace Database\Factories;

use App\Models\ReportJob;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ReportJob>
 */
class ReportJobFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = ReportJob::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'type' => fake()->randomElement(['labs', 'computers', 'softwares']),
            'format' => fake()->randomElement(['pdf', 'csv', 'xlsx']),
            'filters' => [],
            'status' => fake()->randomElement(['pending', 'processing', 'completed', 'failed']),
            'file_path' => null,
            'error_message' => null,
            'started_at' => null,
            'completed_at' => null,
            'failed_at' => null,
        ];
    }

    /**
     * Indicate that the job is pending.
     */
    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'pending',
        ]);
    }

    /**
     * Indicate that the job is processing.
     */
    public function processing(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'processing',
            'started_at' => now(),
        ]);
    }

    /**
     * Indicate that the job is completed.
     */
    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'completed',
            'file_path' => 'reports/test-' . fake()->uuid() . '.pdf',
            'started_at' => now()->subMinutes(5),
            'completed_at' => now(),
        ]);
    }

    /**
     * Indicate that the job failed.
     */
    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'failed',
            'error_message' => 'Test error message',
            'started_at' => now()->subMinutes(5),
            'failed_at' => now(),
        ]);
    }
}
