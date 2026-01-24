export interface AlertRule {
    id: number;
    name: string;
    description?: string;
    type: 'metric' | 'status' | 'software';
    metric?: string;
    condition?: string;
    threshold?: number;
    duration_minutes?: number;
    severity: 'info' | 'warning' | 'critical';
    lab_id?: number;
    lab?: { id: number; name: string };
    notification_channels?: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Alert {
    id: number;
    alert_rule_id: number;
    rule?: AlertRule;
    computer_id: number;
    computer?: { id: number; hostname: string; machine_id: string };
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
    status: 'active' | 'resolved' | 'acknowledged';
    resolved_at?: string;
    trigger_value?: number;
    created_at: string;
    updated_at: string;
}
