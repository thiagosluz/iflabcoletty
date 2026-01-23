<?php

namespace Database\Factories;

use App\Models\Software;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Software>
 */
class SoftwareFactory extends Factory
{
    protected $model = Software::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->words(2, true),
            'version' => fake()->optional()->semver(),
            'vendor' => fake()->optional()->company(),
        ];
    }
}
