<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\LabController;
use App\Http\Controllers\Api\V1\ComputerController;
use App\Http\Controllers\Api\V1\SoftwareController;
use App\Http\Controllers\Api\V1\PublicController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\BackupController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\NotificationController;

Route::prefix('v1')->group(function () {
    // Public Routes (no authentication required) - Higher rate limit
    // These routes bypass throttleApi middleware
    Route::prefix('public')->middleware('throttle:120,1')->group(function () {
        Route::get('/computers/{hash}', [PublicController::class, 'show']);
        Route::get('/computers/{hash}/softwares', [PublicController::class, 'getSoftwares']);
    });

    // Auth - Admin - Rate limit for login (10 attempts per minute per IP)
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1'); // 10 attempts per minute

    // Protected Routes - Rate limit of 60 requests per minute
    Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
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
        Route::get('/computers/{computer}/qrcode', [ComputerController::class, 'generateQrCode']);
        Route::post('/computers/export-qrcodes', [ComputerController::class, 'exportQrCodes']);
        Route::get('/computers/{computer}/softwares', [ComputerController::class, 'getSoftwares']);

        // Software
        Route::apiResource('softwares', SoftwareController::class)->only(['index', 'show']);

        // Dashboard
        Route::get('/dashboard/stats', [\App\Http\Controllers\Api\V1\DashboardController::class, 'stats']);

        // Reports
        Route::post('/reports/labs', [ReportController::class, 'exportLabs']);
        Route::post('/reports/computers', [ReportController::class, 'exportComputers']);
        Route::post('/reports/softwares', [ReportController::class, 'exportSoftwares']);
        Route::get('/reports/jobs', [ReportController::class, 'listJobs']);
        Route::get('/reports/jobs/{reportJob}', [ReportController::class, 'getJobStatus']);
        Route::get('/reports/jobs/{reportJob}/download', [ReportController::class, 'downloadReport'])->name('api.v1.reports.download');

        // Audit Logs
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
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
    });
});

Route::get('/up', function (Request $request) {
    return response()->json(['status' => 'ok']);
});
