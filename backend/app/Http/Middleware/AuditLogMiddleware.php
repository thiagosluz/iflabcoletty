<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuditLogMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only log authenticated requests
        if (Auth::check() && $this->shouldLog($request)) {
            $this->logRequest($request, $response);
        }

        return $response;
    }

    /**
     * Determine if the request should be logged
     */
    private function shouldLog(Request $request): bool
    {
        // Skip logging for certain routes
        $skipRoutes = [
            'api/v1/me',
            'api/v1/dashboard',
            'api/v1/notifications',
        ];

        $path = $request->path();

        foreach ($skipRoutes as $skipRoute) {
            if (str_contains($path, $skipRoute)) {
                return false;
            }
        }

        // Only log write operations (POST, PUT, PATCH, DELETE)
        return in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE']);
    }

    /**
     * Log the request
     */
    private function logRequest(Request $request, Response $response): void
    {
        try {
            $action = $this->getAction($request);
            $resourceType = $this->getResourceType($request);
            $resourceId = $this->getResourceId($request, $response);

            // Only log if we can determine the resource type
            if (! $resourceType) {
                return;
            }

            AuditLog::create([
                'user_id' => Auth::id(),
                'action' => $action,
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'old_values' => $this->getOldValues($request),
                'new_values' => $this->getNewValues($request, $response),
                'description' => $this->getDescription($request, $action, $resourceType),
            ]);
        } catch (\Exception $e) {
            // Don't break the request if logging fails
            \Log::error('Failed to create audit log: '.$e->getMessage());
        }
    }

    /**
     * Get the action from the request
     */
    private function getAction(Request $request): string
    {
        $method = $request->method();

        return match ($method) {
            'POST' => 'create',
            'PUT', 'PATCH' => 'update',
            'DELETE' => 'delete',
            default => 'unknown',
        };
    }

    /**
     * Get the resource type from the request
     */
    private function getResourceType(Request $request): ?string
    {
        $path = $request->path();

        // Extract resource type from path like /api/v1/labs, /api/v1/computers, etc.
        if (preg_match('/\/api\/v1\/(\w+)/', $path, $matches)) {
            $resource = $matches[1];

            // Map to model names
            return match ($resource) {
                'labs' => 'Lab',
                'computers' => 'Computer',
                'softwares' => 'Software',
                default => null,
            };
        }

        return null;
    }

    /**
     * Get the resource ID from the request or response
     */
    private function getResourceId(Request $request, Response $response): ?int
    {
        // Try to get from route parameters
        $resourceId = $request->route('lab')?->id
                   ?? $request->route('computer')?->id
                   ?? $request->route('software')?->id;

        if ($resourceId) {
            return $resourceId;
        }

        // Try to get from response (for create operations)
        if ($response->getStatusCode() === 201 || $response->getStatusCode() === 200) {
            $content = $response->getContent();
            if ($content) {
                $data = json_decode($content, true);
                if (isset($data['id']) || isset($data['data']['id'])) {
                    return $data['id'] ?? $data['data']['id'];
                }
            }
        }

        return null;
    }

    /**
     * Get old values (for update operations)
     */
    private function getOldValues(Request $request): ?array
    {
        // For update operations, we'd need to fetch the model first
        // This is better handled in the controller using a trait
        return null;
    }

    /**
     * Get new values from request
     */
    private function getNewValues(Request $request, Response $response): ?array
    {
        if ($request->method() === 'DELETE') {
            return null;
        }

        $data = $request->all();

        // Remove sensitive data
        unset($data['password'], $data['password_confirmation']);

        return ! empty($data) ? $data : null;
    }

    /**
     * Generate description
     */
    private function getDescription(Request $request, string $action, string $resourceType): string
    {
        $user = Auth::user();
        $userName = $user->name ?? $user->email;

        return sprintf(
            '%s %s %s',
            $userName,
            $action === 'create' ? 'criou' : ($action === 'update' ? 'atualizou' : 'removeu'),
            strtolower($resourceType)
        );
    }
}
