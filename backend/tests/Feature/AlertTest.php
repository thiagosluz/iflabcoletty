<?php

namespace Tests\Feature;

use App\Models\Alert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlertTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_list_alerts(): void
    {
        $user = $this->actingAsUser();
        Alert::factory()->count(5)->create();

        $response = $this->getJson('/api/v1/alerts', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'title', 'description', 'status', 'severity', 'created_at'],
                ],
            ]);

        $this->assertCount(5, $response->json('data'));
    }

    public function test_authenticated_user_can_view_alert_details(): void
    {
        $user = $this->actingAsUser();
        $alert = Alert::factory()->create();

        $response = $this->getJson("/api/v1/alerts/{$alert->id}", $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJson([
                'id' => $alert->id,
                'title' => $alert->title,
                'description' => $alert->description,
            ]);
    }

    public function test_authenticated_user_can_resolve_alert(): void
    {
        $user = $this->actingAsUser();
        $alert = Alert::factory()->create(['status' => 'active']);

        $response = $this->postJson("/api/v1/alerts/{$alert->id}/resolve", [], $this->getAuthHeaders($user));

        $response->assertStatus(200);

        $alert->refresh();
        $this->assertEquals('resolved', $alert->status);
    }

    public function test_authenticated_user_can_get_alert_stats(): void
    {
        $user = $this->actingAsUser();
        Alert::factory()->create(['status' => 'active']);
        Alert::factory()->create(['status' => 'resolved']);

        $response = $this->getJson('/api/v1/alerts/stats', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure(['total_active', 'by_severity', 'recent']);
    }
}
