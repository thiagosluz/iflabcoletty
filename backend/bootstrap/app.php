<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->redirectGuestsTo(fn() => throw new \Illuminate\Auth\AuthenticationException());
        
        // CORS configuration
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
        
        // Audit logging for authenticated API routes
        $middleware->api(append: [
            \App\Http\Middleware\AuditLogMiddleware::class,
        ]);
        
        // Register permission middleware alias
        $middleware->alias([
            'permission' => \App\Http\Middleware\CheckPermission::class,
        ]);
        
        // Rate limiting is applied per route in routes/api.php
        // throttleApi is not applied globally to allow custom limits per endpoint
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
