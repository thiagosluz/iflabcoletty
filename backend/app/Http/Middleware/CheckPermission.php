<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        if (! auth()->check()) {
            return response()->json([
                'message' => 'Não autenticado',
            ], 401);
        }

        $user = auth()->user();

        if (! $user->can($permission)) {
            return response()->json([
                'message' => 'Você não tem permissão para realizar esta ação',
            ], 403);
        }

        return $next($request);
    }
}
