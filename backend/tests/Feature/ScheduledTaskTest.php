<?php

namespace Tests\Feature;

use App\Models\Computer;
use App\Models\ScheduledTask;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ScheduledTaskTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_list_scheduled_tasks(): void
    {
        $user = $this->actingAsUser();

        $computer = Computer::factory()->create();
        ScheduledTask::create([
            'name' => 'Task 1',
            'command' => 'shutdown',
            'target_type' => 'computer',
            'target_id' => $computer->id,
            'frequency' => 'daily',
            'time' => '12:00',
            'user_id' => $user->id
        ]);

        $response = $this->getJson('/api/v1/scheduled-tasks', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                '*' => ['id', 'name', 'command', 'frequency', 'created_at'],
            ]);
    }

    public function test_authenticated_user_can_create_scheduled_task(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create(); // Create a computer for the target_id

        $response = $this->postJson('/api/v1/scheduled-tasks', [
            'name' => 'New Task',
            'command' => 'shutdown', // or whatever valid command
            'target_type' => 'computer',
            'target_id' => $computer->id,
            'frequency' => 'daily',
            'time' => '12:00', // Added time
        ], $this->getAuthHeaders($user));

        $response->assertStatus(201)
            ->assertJson([
                'name' => 'New Task',
            ]);

        $this->assertDatabaseHas('scheduled_tasks', ['name' => 'New Task']);
    }

    public function test_authenticated_user_can_execute_scheduled_task(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();
        $task = ScheduledTask::create([
            'name' => 'Task To Run',
            'command' => 'shutdown',
            'target_type' => 'computer',
            'target_id' => $computer->id,
            'frequency' => 'once',
            'time' => '12:00',
            'user_id' => $user->id
        ]);

        // Mocking the actual execution logic might be complex if it involves jobs/queues.
        // Assuming the controller dispatches a job or runs it.
        // For now, let's just assert the endpoint responds correctly.

        $response = $this->postJson("/api/v1/scheduled-tasks/{$task->id}/execute", [], $this->getAuthHeaders($user));

        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_delete_scheduled_task(): void
    {
        $user = $this->actingAsUser();
        $computer = Computer::factory()->create();
        $task = ScheduledTask::create([
            'name' => 'Task To Delete',
            'command' => 'shutdown',
            'target_type' => 'computer',
            'target_id' => $computer->id,
            'frequency' => 'once',
            'time' => '12:00',
            'user_id' => $user->id
        ]);

        $response = $this->deleteJson("/api/v1/scheduled-tasks/{$task->id}", [], $this->getAuthHeaders($user));

        $response->assertStatus(204);
        $this->assertDatabaseMissing('scheduled_tasks', ['id' => $task->id]);
    }
}
