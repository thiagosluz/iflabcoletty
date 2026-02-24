<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AgentAuthMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['message' => 'Agent Token not provided'], 401);
        }

        // Hashing the provided token to compare with DB
        $hashedToken = hash('sha256', $token);

        $computer = \App\Models\Computer::where('agent_api_key', $hashedToken)->first();

        if (! $computer) {
            return response()->json(['message' => 'Invalid Agent Token'], 401);
        }

        // Add the computer instance to the request for easy access
        $request->merge(['computer' => $computer]);

        return $next($request);
    }
}
