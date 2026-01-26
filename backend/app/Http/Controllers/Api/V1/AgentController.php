<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class AgentController extends Controller
{
    /**
     * Check for agent updates
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function checkUpdate(Request $request)
    {
        // This endpoint can be accessed by agents (no auth required for now)
        // In production, you might want to add authentication

        $currentVersion = $request->query('current_version', '0.0.0');

        // Get the latest version from config or storage
        // For now, we'll use a simple version file or config
        $latestVersion = $this->getLatestVersion();

        // Compare versions (simple string comparison, can be improved with semver)
        $updateAvailable = version_compare($latestVersion, $currentVersion, '>');

        $response = [
            'available' => $updateAvailable,
            'current_version' => $currentVersion,
            'latest_version' => $latestVersion,
        ];

        if ($updateAvailable) {
            // Get download URL
            $downloadUrl = $this->getDownloadUrl($latestVersion);
            $response['download_url'] = $downloadUrl;
            $response['changelog'] = $this->getChangelog($latestVersion);
            $response['size'] = $this->getUpdateSize($latestVersion);
        }

        return response()->json($response);
    }

    /**
     * Download agent update package
     *
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
     */
    public function downloadUpdate(Request $request, string $version)
    {
        // Requer autenticação e permissão para baixar atualizações
        if (! auth()->check()) {
            return response()->json(['message' => 'Não autenticado'], 401);
        }

        // Verificar se tem permissão (agentes autenticados ou usuários com permissão)
        if (! auth()->user()->can('computers.view')) {
            return response()->json(['message' => 'Sem permissão'], 403);
        }

        // Verify version exists
        $packagePath = $this->getPackagePath($version);

        if (! $packagePath || ! file_exists($packagePath)) {
            return response()->json([
                'message' => 'Update package not found',
            ], 404);
        }

        return response()->download($packagePath, "iflab-agent-{$version}.zip", [
            'Content-Type' => 'application/zip',
        ]);
    }

    /**
     * Get the latest agent version
     */
    private function getLatestVersion(): string
    {
        // Option 1: Read from config file
        $versionFile = storage_path('app/agent/latest_version.txt');

        if (file_exists($versionFile)) {
            return trim(file_get_contents($versionFile));
        }

        // Option 2: Read from config
        $version = config('app.agent_latest_version', '1.0.0');

        return $version;
    }

    /**
     * Get download URL for a version
     */
    private function getDownloadUrl(string $version): string
    {
        // Generate URL to download endpoint
        return url("/api/v1/agent/download/{$version}");
    }

    /**
     * Get changelog for a version
     */
    private function getChangelog(string $version): ?string
    {
        $changelogFile = storage_path("app/agent/changelogs/{$version}.md");

        if (file_exists($changelogFile)) {
            return file_get_contents($changelogFile);
        }

        return null;
    }

    /**
     * Get update package size
     */
    private function getUpdateSize(string $version): int
    {
        $packagePath = $this->getPackagePath($version);

        if ($packagePath && file_exists($packagePath)) {
            return filesize($packagePath);
        }

        return 0;
    }

    /**
     * Get package file path for a version
     */
    private function getPackagePath(string $version): ?string
    {
        // Look for package in storage
        $packagePath = storage_path("app/agent/packages/iflab-agent-{$version}.zip");

        if (file_exists($packagePath)) {
            return $packagePath;
        }

        return null;
    }

    /**
     * Get agent version info (for admin)
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function versionInfo(Request $request)
    {
        $this->authorize('computers.view');

        return response()->json([
            'latest_version' => $this->getLatestVersion(),
            'package_exists' => $this->getPackagePath($this->getLatestVersion()) !== null,
            'package_size' => $this->getUpdateSize($this->getLatestVersion()),
        ]);
    }
}
