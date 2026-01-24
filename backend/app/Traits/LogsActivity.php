<?php

namespace App\Traits;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

trait LogsActivity
{
    /**
     * Log an activity
     */
    protected function logActivity(
        string $action,
        $resource = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?string $description = null
    ): void {
        if (!Auth::check()) {
            return;
        }

        try {
            $resourceType = $resource ? class_basename(get_class($resource)) : $this->getResourceType();
            
            if (!$resourceType) {
                return; // Can't log without resource type
            }
            
            $resourceId = $resource?->id;

            AuditLog::create([
                'user_id' => Auth::id(),
                'action' => $action,
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'old_values' => $oldValues,
                'new_values' => $newValues,
                'description' => $description ?? $this->generateDescription($action, $resourceType, $resource),
            ]);
        } catch (\Exception $e) {
            // Don't break the request if logging fails
            \Log::error('Failed to create audit log: ' . $e->getMessage());
        }
    }

    /**
     * Get resource type from controller
     */
    protected function getResourceType(): ?string
    {
        $className = class_basename($this);
        $resourceType = str_replace('Controller', '', $className);
        
        // Map controller names to model names
        return match($resourceType) {
            'Lab' => 'Lab',
            'Computer' => 'Computer',
            'Software' => 'Software',
            default => $resourceType,
        };
    }

    /**
     * Generate description for the log
     */
    protected function generateDescription(string $action, string $resourceType, $resource = null): string
    {
        $user = Auth::user();
        if (!$user) {
            return "Ação {$action} em {$resourceType}";
        }
        
        $userName = $user->name ?? $user->email;
        
        $actionText = match($action) {
            'create' => 'criou',
            'update' => 'atualizou',
            'delete' => 'removeu',
            'view' => 'visualizou',
            default => $action,
        };

        $resourceName = $resource?->name ?? $resource?->hostname ?? ($resource?->id ? "ID: {$resource->id}" : '');

        return sprintf(
            '%s %s %s%s',
            $userName,
            $actionText,
            strtolower($resourceType),
            $resourceName ? " ({$resourceName})" : ''
        );
    }
}
