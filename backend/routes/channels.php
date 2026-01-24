<?php

use Illuminate\Support\Facades\Broadcast;

// User-specific private channel
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// User-specific notification channel
Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// Private channel for computers (users with computers.view permission)
Broadcast::channel('computers', function ($user) {
    return $user->can('computers.view') ? ['id' => $user->id, 'name' => $user->name] : null;
});

// Private channel for dashboard (users with dashboard.view permission)
Broadcast::channel('dashboard', function ($user) {
    return $user->can('dashboard.view') ? ['id' => $user->id, 'name' => $user->name] : null;
});

// Private channel for notifications (users with notifications.view permission)
Broadcast::channel('notifications', function ($user) {
    return $user->can('notifications.view') ? ['id' => $user->id, 'name' => $user->name] : null;
});
