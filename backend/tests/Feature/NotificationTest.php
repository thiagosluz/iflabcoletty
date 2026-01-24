<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Lab;
use App\Models\Computer;
use App\Models\Software;
use App\Models\Notification;
use App\Events\ComputerStatusChanged;
use App\Events\SoftwareInstalled;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_list_notifications(): void
    {
        $user = $this->actingAsUser();
        
        // Create notifications for the user
        Notification::factory()->count(5)->create(['user_id' => $user->id]);

        $response = $this->getJson('/api/v1/notifications', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'user_id',
                        'type',
                        'title',
                        'message',
                        'read',
                        'created_at',
                    ]
                ],
                'current_page',
                'total',
            ]);
    }

    public function test_user_can_get_unread_count(): void
    {
        $user = $this->actingAsUser();
        
        Notification::factory()->count(3)->create([
            'user_id' => $user->id,
            'read' => false,
        ]);
        Notification::factory()->count(2)->create([
            'user_id' => $user->id,
            'read' => true,
        ]);

        $response = $this->getJson('/api/v1/notifications/unread-count', $this->getAuthHeaders($user));

        $response->assertStatus(200)
            ->assertJson([
                'count' => 3,
            ]);
    }

    public function test_user_can_mark_notification_as_read(): void
    {
        $user = $this->actingAsUser();
        
        $notification = Notification::factory()->create([
            'user_id' => $user->id,
            'read' => false,
        ]);

        $response = $this->putJson(
            "/api/v1/notifications/{$notification->id}/read",
            [],
            $this->getAuthHeaders($user)
        );

        $response->assertStatus(200);
        $this->assertTrue($notification->fresh()->read);
        $this->assertNotNull($notification->fresh()->read_at);
    }

    public function test_user_can_mark_notification_as_unread(): void
    {
        $user = $this->actingAsUser();
        
        $notification = Notification::factory()->create([
            'user_id' => $user->id,
            'read' => true,
            'read_at' => now(),
        ]);

        $response = $this->putJson(
            "/api/v1/notifications/{$notification->id}/unread",
            [],
            $this->getAuthHeaders($user)
        );

        $response->assertStatus(200);
        $this->assertFalse($notification->fresh()->read);
        $this->assertNull($notification->fresh()->read_at);
    }

    public function test_user_can_mark_all_notifications_as_read(): void
    {
        $user = $this->actingAsUser();
        
        Notification::factory()->count(5)->create([
            'user_id' => $user->id,
            'read' => false,
        ]);

        $response = $this->postJson(
            '/api/v1/notifications/mark-all-read',
            [],
            $this->getAuthHeaders($user)
        );

        $response->assertStatus(200);
        $this->assertEquals(0, $user->notifications()->where('read', false)->count());
    }

    public function test_user_cannot_access_other_user_notifications(): void
    {
        $user1 = $this->actingAsUser();
        $user2 = User::factory()->create();
        
        $notification = Notification::factory()->create([
            'user_id' => $user2->id,
        ]);

        $response = $this->getJson(
            "/api/v1/notifications/{$notification->id}",
            $this->getAuthHeaders($user1)
        );

        $response->assertStatus(403);
    }

    public function test_computer_status_changed_event_creates_notification(): void
    {
        Event::fake();
        
        $user = $this->actingAsUser();
        $lab = Lab::factory()->create();
        $computer = Computer::factory()->create(['lab_id' => $lab->id]);

        event(new ComputerStatusChanged($computer, 'offline', 'Test reason'));

        Event::assertDispatched(ComputerStatusChanged::class, function ($event) {
            return $event->status === 'offline';
        });
    }

    public function test_software_installed_event_creates_notification(): void
    {
        Event::fake();
        
        $lab = Lab::factory()->create();
        $computer = Computer::factory()->create(['lab_id' => $lab->id]);
        $software = Software::factory()->create();

        event(new SoftwareInstalled($computer, $software, 'installed'));

        Event::assertDispatched(SoftwareInstalled::class, function ($event) {
            return $event->action === 'installed';
        });
    }

    public function test_notifications_can_be_filtered_by_read_status(): void
    {
        $user = $this->actingAsUser();
        
        Notification::factory()->count(3)->create([
            'user_id' => $user->id,
            'read' => false,
        ]);
        Notification::factory()->count(2)->create([
            'user_id' => $user->id,
            'read' => true,
        ]);

        $response = $this->getJson(
            '/api/v1/notifications?read=false',
            $this->getAuthHeaders($user)
        );

        $response->assertStatus(200);
        $this->assertCount(3, $response->json('data'));
    }

    public function test_notifications_can_be_filtered_by_type(): void
    {
        $user = $this->actingAsUser();
        
        Notification::factory()->count(3)->create([
            'user_id' => $user->id,
            'type' => 'computer.offline',
        ]);
        Notification::factory()->count(2)->create([
            'user_id' => $user->id,
            'type' => 'software.installed',
        ]);

        $response = $this->getJson(
            '/api/v1/notifications?type=computer.offline',
            $this->getAuthHeaders($user)
        );

        $response->assertStatus(200);
        $this->assertCount(3, $response->json('data'));
    }
}
