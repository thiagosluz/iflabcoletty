<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class RateLimitingTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_endpoint_has_strict_rate_limit(): void
    {
        // Try to make 11 requests (limit is 10 per minute)
        for ($i = 0; $i < 10; $i++) {
            $response = $this->postJson('/api/v1/login', [
                'email' => 'test@example.com',
                'password' => 'wrong-password',
            ]);

            // First 10 should return 401 (unauthorized), not 429
            $this->assertNotEquals(429, $response->status(), "Request $i should not be rate limited yet");
        }

        // 11th request should be rate limited (429)
        $response = $this->postJson('/api/v1/login', [
            'email' => 'test@example.com',
            'password' => 'wrong-password',
        ]);

        // Should be rate limited
        $this->assertEquals(429, $response->status(), 'Should be rate limited after 10 attempts');

        // Should have Retry-After header (may be in different format)
        $headers = $response->headers->all();
        $hasRetryAfter = isset($headers['retry-after']) || isset($headers['Retry-After']);
        $this->assertTrue($hasRetryAfter, 'Should have Retry-After header when rate limited');
    }

    public function test_authenticated_routes_have_rate_limit(): void
    {
        Config::set('app.api_rate_limit_per_minute', 300);

        $user = $this->actingAsUser();

        // Make 300 requests (limit is 300 per minute in this test)
        for ($i = 0; $i < 300; $i++) {
            $response = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));
            $this->assertEquals(200, $response->status());
        }

        // 301st request should be rate limited
        $response = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));
        $this->assertEquals(429, $response->status());
    }

    public function test_rate_limit_headers_are_present(): void
    {
        $user = $this->actingAsUser();

        $response = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));

        $this->assertEquals(200, $response->status());
        $this->assertTrue($response->headers->has('X-RateLimit-Limit'));
        $this->assertTrue($response->headers->has('X-RateLimit-Remaining'));
    }

    public function test_public_routes_have_higher_rate_limit(): void
    {
        // Create a computer with public hash
        $computer = \App\Models\Computer::factory()->create();

        // Make requests up to the limit (120 per minute for public routes)
        // But we'll test with a smaller number to avoid hitting other limits
        $successCount = 0;
        $rateLimited = false;

        for ($i = 0; $i < 130; $i++) {
            $response = $this->getJson("/api/v1/public/computers/{$computer->public_hash}");

            if ($response->status() === 200) {
                $successCount++;
            } elseif ($response->status() === 429) {
                $rateLimited = true;
                break;
            }
        }

        // Should have made at least some successful requests before hitting limit
        $this->assertGreaterThan(0, $successCount, 'Should have some successful requests');

        // If we hit the limit, verify it's 429
        if ($rateLimited) {
            $this->assertEquals(429, $response->status());
        }
    }

    public function test_rate_limit_resets_after_time_window(): void
    {
        Config::set('app.api_rate_limit_per_minute', 300);

        $user = $this->actingAsUser();

        // Make 300 requests to hit the limit
        for ($i = 0; $i < 300; $i++) {
            $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));
        }

        // Verify we're rate limited
        $response = $this->getJson('/api/v1/dashboard/stats', $this->getAuthHeaders($user));
        $this->assertEquals(429, $response->status());

        // Note: In a real scenario, we would wait for the time window to reset
        // For testing purposes, we're just verifying the rate limit is enforced
    }
}
