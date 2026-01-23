<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\LabController;
use App\Http\Controllers\Api\V1\ComputerController;
use App\Http\Controllers\Api\V1\SoftwareController;
use App\Http\Controllers\Api\V1\PublicController;
use App\Http\Controllers\Api\V1\ReportController;

Route::prefix('v1')->group(function () {
    // Public Routes (no authentication required)
    Route::prefix('public')->group(function () {
        Route::get('/computers/{hash}', [PublicController::class, 'show']);
        Route::get('/computers/{hash}/softwares', [PublicController::class, 'getSoftwares']);
    });

    // Auth - Admin
    Route::post('/login', [AuthController::class, 'login']);

    // Protected Routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        // Labs
        Route::apiResource('labs', LabController::class);
        Route::get('/labs/{lab}/computers', [LabController::class, 'getComputers']);
        Route::get('/labs/{lab}/softwares', [LabController::class, 'getSoftwares']);

        // Computers
        Route::apiResource('computers', ComputerController::class);
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
    });
});

Route::get('/up', function (Request $request) {
    return response()->json(['status' => 'ok']);
});
