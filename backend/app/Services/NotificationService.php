<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class NotificationService
{
    /**
     * Create a notification for a specific user.
     */
    public function create(User $user, string $type, string $title, string $message, array $data = []): Notification
    {
        return Notification::create([
            'user_id' => $user->id,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data,
            'read' => false,
        ]);
    }

    /**
     * Create notifications for all admin users.
     */
    public function notifyAdmins(string $type, string $title, string $message, array $data = []): void
    {
        $admins = User::role('admin')->get();
        
        foreach ($admins as $admin) {
            $this->create($admin, $type, $title, $message, $data);
        }
    }

    /**
     * Create notifications for all users with a specific permission.
     */
    public function notifyUsersWithPermission(string $permission, string $type, string $title, string $message, array $data = []): void
    {
        $users = User::permission($permission)->get();
        
        foreach ($users as $user) {
            $this->create($user, $type, $title, $message, $data);
        }
    }

    /**
     * Create notification for users who can view a specific resource.
     */
    public function notifyResourceViewers(string $resourceType, int $resourceId, string $type, string $title, string $message, array $data = []): void
    {
        $permission = "{$resourceType}.view";
        $this->notifyUsersWithPermission($permission, $type, $title, $message, array_merge($data, [
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
        ]));
    }
}
