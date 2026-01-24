<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\AlertRule;
use App\Models\Computer;
use Illuminate\Support\Facades\Log;

class AlertService
{
    protected $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * Process alerts for a specific computer
     */
    public function processComputer(Computer $computer)
    {
        // Get active rules applicable to this computer (global or specific to its lab)
        $rules = AlertRule::where('is_active', true)
            ->where(function ($query) use ($computer) {
                $query->whereNull('lab_id')
                    ->orWhere('lab_id', $computer->lab_id);
            })
            ->get();

        foreach ($rules as $rule) {
            try {
                $this->evaluateRule($rule, $computer);
            } catch (\Exception $e) {
                Log::error("Error evaluating alert rule {$rule->id} for computer {$computer->id}: ".$e->getMessage());
            }
        }
    }

    protected function evaluateRule(AlertRule $rule, Computer $computer)
    {
        $isTriggered = false;
        $triggerValue = null;

        switch ($rule->type) {
            case 'metric':
                [$isTriggered, $triggerValue] = $this->evaluateMetric($rule, $computer);
                break;
            case 'status':
                [$isTriggered, $triggerValue] = $this->evaluateStatus($rule, $computer);
                break;
                // TODO: Software changes
        }

        if ($isTriggered) {
            $this->triggerAlert($rule, $computer, $triggerValue);
        } else {
            $this->resolveAlert($rule, $computer);
        }
    }

    protected function evaluateMetric(AlertRule $rule, Computer $computer): array
    {
        // Get last activity with metrics (assuming type 'heartbeat' or 'metrics')
        $lastActivity = $computer->activities()
            ->whereIn('type', ['heartbeat', 'metrics'])
            ->latest()
            ->first();

        if (! $lastActivity || empty($lastActivity->payload)) {
            return [false, null];
        }

        $metrics = $lastActivity->payload;
        $value = null;

        switch ($rule->metric) {
            case 'cpu_usage':
                $value = $metrics['cpu_percent'] ?? null;
                break;
            case 'memory_usage':
                $value = $metrics['memory_percent'] ?? null;
                break;
            case 'disk_usage':
                $value = $metrics['disk_percent'] ?? null;
                break;
        }

        if ($value === null) {
            return [false, null];
        }

        $triggered = false;
        switch ($rule->condition) {
            case '>':
                $triggered = $value > $rule->threshold;
                break;
            case '>=':
                $triggered = $value >= $rule->threshold;
                break;
            case '<':
                $triggered = $value < $rule->threshold;
                break;
            case '<=':
                $triggered = $value <= $rule->threshold;
                break;
        }

        return [$triggered, $value];
    }

    protected function evaluateStatus(AlertRule $rule, Computer $computer): array
    {
        if ($rule->metric === 'offline') {
            $lastActivity = $computer->activities()->latest()->first();

            // If never seen, assume online to avoid spam or handle as specific case
            if (! $lastActivity) {
                return [false, null];
            }

            // Check time since last activity
            $minutesSinceLastSeen = $lastActivity->created_at->diffInMinutes(now());

            // If recently seen (within 5 mins), it is considered online
            // But if the rule has a duration, we respect that.
            // If rule duration is 0, any offline (e.g. > 5 mins no contact) triggers it.

            $defaultOfflineThreshold = 5;

            if ($minutesSinceLastSeen < $defaultOfflineThreshold) {
                return [false, 0]; // It is online
            }

            // It is offline (more than 5 mins). Now check rule duration.
            // If rule says "Offline for > 30 mins", we check $minutesSinceLastSeen >= 30
            $duration = $rule->duration_minutes > 0 ? $rule->duration_minutes : $defaultOfflineThreshold;

            if ($minutesSinceLastSeen >= $duration) {
                return [true, $minutesSinceLastSeen];
            }

            return [false, $minutesSinceLastSeen];
        }

        return [false, null];
    }

    protected function triggerAlert(AlertRule $rule, Computer $computer, $value)
    {
        // Check if active alert already exists
        $existingAlert = Alert::where('alert_rule_id', $rule->id)
            ->where('computer_id', $computer->id)
            ->active()
            ->first();

        if ($existingAlert) {
            // Update trigger value if changed significantly?
            // For now, just leave it active.
            return;
        }

        // Create new alert
        $alert = Alert::create([
            'alert_rule_id' => $rule->id,
            'computer_id' => $computer->id,
            'title' => "Alert: {$rule->name} on {$computer->name}",
            'description' => $this->generateAlertDescription($rule, $computer, $value),
            'severity' => $rule->severity,
            'status' => 'active',
            'trigger_value' => $value,
        ]);

        // Send notifications
        $this->sendNotifications($alert, $rule);
    }

    protected function resolveAlert(AlertRule $rule, Computer $computer)
    {
        // Check if there is an active alert to resolve
        $existingAlert = Alert::where('alert_rule_id', $rule->id)
            ->where('computer_id', $computer->id)
            ->active()
            ->first();

        if ($existingAlert) {
            $existingAlert->update([
                'status' => 'resolved',
                'resolved_at' => now(),
            ]);

            // Optionally notify resolution
        }
    }

    protected function generateAlertDescription(AlertRule $rule, Computer $computer, $value)
    {
        $metricName = str_replace('_', ' ', $rule->metric);

        return "The {$metricName} is {$value} (Threshold: {$rule->condition} {$rule->threshold})";
    }

    protected function sendNotifications(Alert $alert, AlertRule $rule)
    {
        $channels = $rule->notification_channels ?? [];

        if (in_array('database', $channels)) {
            $this->notificationService->notifyAdmin(
                $alert->title,
                $alert->description,
                'alert', // type
                ['alert_id' => $alert->id, 'computer_id' => $alert->computer_id]
            );
        }

        // Future: Implement email, webhook
    }
}
