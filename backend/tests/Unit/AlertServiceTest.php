<?php

namespace Tests\Unit;

use App\Models\Alert;
use App\Models\AlertRule;
use App\Models\Computer;
use App\Models\ComputerActivity;
use App\Services\AlertService;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class AlertServiceTest extends TestCase
{
    use RefreshDatabase;

    protected $notificationService;

    protected $alertService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->notificationService = Mockery::mock(NotificationService::class);
        $this->notificationService->shouldReceive('notifyAdmin')->byDefault();

        $this->alertService = new AlertService($this->notificationService);
    }

    public function test_it_triggers_cpu_usage_alert()
    {
        $computer = Computer::factory()->create();

        // Create rule: CPU > 90%
        $rule = AlertRule::factory()->create([
            'type' => 'metric',
            'metric' => 'cpu_usage',
            'condition' => '>',
            'threshold' => 90,
            'is_active' => true,
        ]);

        // Create activity with high CPU
        ComputerActivity::create([
            'computer_id' => $computer->id,
            'type' => 'heartbeat',
            'payload' => ['cpu_percent' => 95, 'memory_percent' => 50],
        ]);

        $this->alertService->processComputer($computer);

        $this->assertDatabaseHas('alerts', [
            'computer_id' => $computer->id,
            'alert_rule_id' => $rule->id,
            'status' => 'active',
        ]);
    }

    public function test_it_does_not_trigger_alert_if_below_threshold()
    {
        $computer = Computer::factory()->create();

        // Create rule: CPU > 90%
        $rule = AlertRule::factory()->create([
            'type' => 'metric',
            'metric' => 'cpu_usage',
            'condition' => '>',
            'threshold' => 90,
            'is_active' => true,
        ]);

        // Create activity with low CPU
        ComputerActivity::create([
            'computer_id' => $computer->id,
            'type' => 'heartbeat',
            'payload' => ['cpu_percent' => 50],
        ]);

        $this->alertService->processComputer($computer);

        $this->assertDatabaseMissing('alerts', [
            'computer_id' => $computer->id,
            'alert_rule_id' => $rule->id,
        ]);
    }

    public function test_it_triggers_offline_alert()
    {
        $computer = Computer::factory()->create();

        // Create rule: Offline > 10 mins
        $rule = AlertRule::factory()->create([
            'type' => 'status',
            'metric' => 'offline',
            'duration_minutes' => 10,
            'is_active' => true,
        ]);

        // Create activity 20 mins ago
        $activity = ComputerActivity::create([
            'computer_id' => $computer->id,
            'type' => 'heartbeat',
            'payload' => [],
        ]);

        $activity->created_at = now()->subMinutes(20);
        $activity->save();

        $this->alertService->processComputer($computer);

        $this->assertDatabaseHas('alerts', [
            'computer_id' => $computer->id,
            'alert_rule_id' => $rule->id,
            'status' => 'active',
        ]);
    }

    public function test_it_resolves_alert_when_condition_clears()
    {
        $computer = Computer::factory()->create();
        $rule = AlertRule::factory()->create([
            'type' => 'metric',
            'metric' => 'cpu_usage',
            'condition' => '>',
            'threshold' => 90,
        ]);

        // Existing active alert
        Alert::factory()->create([
            'computer_id' => $computer->id,
            'alert_rule_id' => $rule->id,
            'status' => 'active',
        ]);

        // New activity with normal CPU
        ComputerActivity::create([
            'computer_id' => $computer->id,
            'type' => 'heartbeat',
            'payload' => ['cpu_percent' => 50],
        ]);

        $this->alertService->processComputer($computer);

        $this->assertDatabaseHas('alerts', [
            'computer_id' => $computer->id,
            'alert_rule_id' => $rule->id,
            'status' => 'resolved',
        ]);
    }
}
