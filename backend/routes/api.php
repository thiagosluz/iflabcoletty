<?php

use App\Http\Controllers\Api\V1\AgentController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BackupController;
use App\Http\Controllers\Api\V1\ComputerController;
use App\Http\Controllers\Api\V1\HealthCheckController;
use App\Http\Controllers\Api\V1\LabController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PublicController;
use App\Http\Controllers\Api\V1\RemoteControlController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SoftwareController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Routes (no authentication required) - Higher rate limit
    // These routes bypass throttleApi middleware
    Route::prefix('public')->middleware('throttle:120,1')->group(function () {
        Route::get('/computers/{hash}', [PublicController::class, 'show']);
        Route::get('/computers/{hash}/softwares', [PublicController::class, 'getSoftwares']);
    });

    // Auth - Admin - Rate limit for login (10 attempts per minute per IP)
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1'); // 10 attempts per minute

    // Broadcasting authentication route - needs to be outside the auth group to handle auth manually
    Route::post('/broadcasting/auth', function (Request $request) {
        Log::info('Broadcasting auth hit', [
            'headers' => $request->headers->all(),
            'bearer_token' => $request->bearerToken(),
            'authorization_header' => $request->header('Authorization'),
            'input' => $request->all(),
        ]);

        // Manually authenticate the user
        $user = null;
        if ($request->bearerToken()) {
            try {
                $user = \Laravel\Sanctum\PersonalAccessToken::findToken($request->bearerToken())?->tokenable;
                Log::info('Broadcasting auth token parsed', ['user_id' => $user?->id]);
            } catch (\Exception $e) {
                Log::warning('Broadcasting auth token validation failed', ['error' => $e->getMessage()]);
            }
        } else {
            Log::warning('Broadcasting auth no bearer token found');
        }

        if (! $user) {
            Log::warning('Broadcasting auth failed: User not found or unauthenticated');

            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Set the authenticated user
        auth()->setUser($user);

        // Log all request data for debugging
        Log::info('Broadcasting auth request', [
            'channel_name' => $request->input('channel_name'),
            'socket_id' => $request->input('socket_id'),
            'all_input' => $request->all(),
            'raw_content' => $request->getContent(),
            'content_type' => $request->header('Content-Type'),
            'user_id' => auth()->id(),
            'has_token' => $request->bearerToken() !== null,
            'authorization_header' => $request->header('Authorization'),
            'request_method' => $request->method(),
        ]);

        // Ensure channel_name and socket_id are present
        if (! $request->has('channel_name') || ! $request->has('socket_id')) {
            Log::error('Broadcasting auth missing required parameters', [
                'has_channel_name' => $request->has('channel_name'),
                'has_socket_id' => $request->has('socket_id'),
                'all_input' => $request->all(),
            ]);

            return response()->json([
                'error' => 'Missing required parameters: channel_name and socket_id are required',
            ], 400);
        }

        try {
            // Use Broadcast::auth() which handles the authentication
            $response = Broadcast::auth($request);
            Log::info('Broadcasting auth success', [
                'channel_name' => $request->input('channel_name'),
            ]);

            return $response;
        } catch (\Exception $e) {
            Log::error('Broadcasting auth error', [
                'channel_name' => $request->input('channel_name'),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    })->middleware('throttle:60,1');

    // Protected Routes - Rate limit of 300 requests per minute
    Route::middleware(['auth:sanctum', 'throttle:300,1'])->group(function () {

        // Global Search
        Route::get('/search', [\App\Http\Controllers\Api\V1\SearchController::class, 'globalSearch']);

        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        // Labs
        Route::apiResource('labs', LabController::class);
        Route::get('/labs/{lab}/computers', [LabController::class, 'getComputers']);
        Route::get('/labs/{lab}/softwares', [LabController::class, 'getSoftwares']);

        // Computers
        Route::apiResource('computers', ComputerController::class);
        Route::get('/computers/by-machine-id/{machineId}', [ComputerController::class, 'findByMachineId']);
        Route::post('/computers/{computer}/report', [ComputerController::class, 'report']);
        Route::post('/computers/{computer}/metrics', [ComputerController::class, 'storeMetrics']);
        Route::get('/computers/{computer}/metrics', [ComputerController::class, 'getMetrics']);
        Route::get('/computers/{computer}/qrcode', [ComputerController::class, 'generateQrCode']);
        Route::post('/computers/export-qrcodes', [ComputerController::class, 'exportQrCodes']);
        Route::get('/computers/{computer}/softwares', [ComputerController::class, 'getSoftwares']);
        Route::get('/computers/{computer}/activities', [ComputerController::class, 'getActivities']);
        Route::post('/computers/{computer}/rotate-hash', [ComputerController::class, 'rotatePublicHash']);

        // Remote Control
        Route::get('/computers/{computer}/commands', [RemoteControlController::class, 'index']);
        Route::post('/computers/{computer}/commands', [RemoteControlController::class, 'store']);
        Route::post('/computers/bulk-commands', [RemoteControlController::class, 'storeBulk']);
        Route::post('/labs/{lab}/commands', [RemoteControlController::class, 'storeLab']);
        Route::post('/labs/{lab}/positions', [LabController::class, 'updatePositions']);
        Route::get('/computers/{computer}/commands/pending', [RemoteControlController::class, 'pending']);
        Route::put('/commands/{command}/status', [RemoteControlController::class, 'updateStatus']);

        // Agent Updates
        Route::get('/agent/check-update', [AgentController::class, 'checkUpdate']);
        Route::get('/agent/download/{version}', [AgentController::class, 'downloadUpdate']);
        Route::get('/agent/version-info', [AgentController::class, 'versionInfo']);

        // Agent Downloads
        Route::get('/agent/files', [AgentController::class, 'listFiles']);
        Route::get('/agent/installer/{platform}', [AgentController::class, 'downloadInstaller']);
        Route::get('/agent/source-code', [AgentController::class, 'downloadSourceCode']);
        Route::post('/agent/build-package', [AgentController::class, 'buildPackage']);
        Route::delete('/agent/packages/{version}', [AgentController::class, 'deletePackage']);

        // Software
        Route::apiResource('softwares', SoftwareController::class)->only(['index', 'show']);

        // Dashboard
        Route::get('/dashboard/stats', [\App\Http\Controllers\Api\V1\DashboardController::class, 'stats']);
        Route::get('/dashboard/history', [\App\Http\Controllers\Api\V1\DashboardController::class, 'history']);

        // System Health
        Route::get('/system/health', [HealthCheckController::class, 'health']);

        // Reports
        Route::post('/reports/labs', [ReportController::class, 'exportLabs']);
        Route::post('/reports/computers', [ReportController::class, 'exportComputers']);
        Route::post('/reports/softwares', [ReportController::class, 'exportSoftwares']);
        Route::get('/reports/jobs', [ReportController::class, 'listJobs']);
        Route::get('/reports/jobs/{reportJob}', [ReportController::class, 'getJobStatus']);
        Route::get('/reports/jobs/{reportJob}/download', [ReportController::class, 'downloadReport'])->name('api.v1.reports.download');

        // Audit Logs
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
        Route::delete('/audit-logs', [AuditLogController::class, 'destroyAll']);
        Route::get('/audit-logs/stats', [AuditLogController::class, 'stats']);
        Route::get('/audit-logs/{id}', [AuditLogController::class, 'show']);

        // Backups
        Route::get('/backups', [BackupController::class, 'index']);
        Route::get('/backups/stats', [BackupController::class, 'stats']);
        Route::post('/backups', [BackupController::class, 'store']);
        Route::get('/backups/{backup}', [BackupController::class, 'show']);
        Route::delete('/backups/{backup}', [BackupController::class, 'destroy']);
        Route::get('/backups/{backup}/download', [BackupController::class, 'download'])->name('api.v1.backups.download');
        Route::post('/backups/{backup}/restore', [BackupController::class, 'restore']);
        Route::post('/backups/clean', [BackupController::class, 'clean']);

        // Users (requires users.* permissions)
        Route::apiResource('users', UserController::class);

        // Roles and Permissions (requires roles.* permissions)
        Route::get('/roles', [RoleController::class, 'index']);
        Route::get('/permissions', [RoleController::class, 'permissions']);
        Route::post('/roles', [RoleController::class, 'store']);
        Route::get('/roles/{role}', [RoleController::class, 'show']);
        Route::put('/roles/{role}', [RoleController::class, 'update']);
        Route::delete('/roles/{role}', [RoleController::class, 'destroy']);

        // Notifications
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::get('/notifications/{notification}', [NotificationController::class, 'show']);
        Route::put('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
        Route::put('/notifications/{notification}/unread', [NotificationController::class, 'markAsUnread']);
        Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead']);
        Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);
        Route::post('/notifications/delete-multiple', [NotificationController::class, 'deleteMultiple']);
        Route::post('/notifications/delete-all', [NotificationController::class, 'deleteAll']);

        // Alerts & Rules
        Route::get('/alerts', [\App\Http\Controllers\Api\V1\AlertController::class, 'index']);
        Route::get('/alerts/stats', [\App\Http\Controllers\Api\V1\AlertController::class, 'stats']);
        Route::get('/alerts/{alert}', [\App\Http\Controllers\Api\V1\AlertController::class, 'show']);
        Route::post('/alerts/{alert}/resolve', [\App\Http\Controllers\Api\V1\AlertController::class, 'resolve']);

        Route::get('/alert-rules', [\App\Http\Controllers\Api\V1\AlertController::class, 'rulesIndex']);
        Route::post('/alert-rules', [\App\Http\Controllers\Api\V1\AlertController::class, 'rulesStore']);
        Route::put('/alert-rules/{rule}', [\App\Http\Controllers\Api\V1\AlertController::class, 'rulesUpdate']);
        Route::delete('/alert-rules/{rule}', [\App\Http\Controllers\Api\V1\AlertController::class, 'rulesDestroy']);

        // Scheduled Tasks
        Route::post('/scheduled-tasks/{scheduledTask}/execute', [\App\Http\Controllers\Api\V1\ScheduledTaskController::class, 'execute']);
        Route::apiResource('scheduled-tasks', \App\Http\Controllers\Api\V1\ScheduledTaskController::class);

        // System Logs
        Route::get('/system/logs', [\App\Http\Controllers\Api\V1\LogViewerController::class, 'index']);
        Route::get('/system/logs/{filename}', [\App\Http\Controllers\Api\V1\LogViewerController::class, 'show']);

        // Queue Management
        Route::post('/system/queue/retry-failed', [\App\Http\Controllers\Api\V1\HealthCheckController::class, 'retryFailedJobs']);
        Route::post('/system/queue/clear', [\App\Http\Controllers\Api\V1\HealthCheckController::class, 'clearQueue']);
        Route::post('/system/queue/delete', [\App\Http\Controllers\Api\V1\HealthCheckController::class, 'deleteQueue']);

        // Software Installations
        Route::post('/software-installations', [\App\Http\Controllers\Api\V1\SoftwareInstallationController::class, 'store']);
        Route::post('/software-installations/upload', [\App\Http\Controllers\Api\V1\SoftwareInstallationController::class, 'upload']);
        Route::get('/software-installations', [\App\Http\Controllers\Api\V1\SoftwareInstallationController::class, 'index']);
        Route::get('/software-installations/{softwareInstallation}', [\App\Http\Controllers\Api\V1\SoftwareInstallationController::class, 'show']);
        Route::delete('/software-installations/{softwareInstallation}', [\App\Http\Controllers\Api\V1\SoftwareInstallationController::class, 'destroy']);
        Route::get('/installers/{fileId}/download', [\App\Http\Controllers\Api\V1\SoftwareInstallationController::class, 'download']);
    });
});

Route::get('/up', function (Request $request) {
    return response()->json(['status' => 'ok']);
});
